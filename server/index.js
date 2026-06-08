import Database from 'better-sqlite3'
import express from 'express'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const dataDir = process.env.DATA_DIR ?? path.join(projectRoot, 'data')
const dbPath = process.env.DATABASE_PATH ?? path.join(dataDir, 'money-manager.sqlite')
const port = Number(process.env.PORT ?? 3000)

const DEFAULT_CATEGORY_COLOR = '#868e96'

mkdirSync(path.dirname(dbPath), { recursive: true })

const db = new Database(dbPath)
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    balance_cents INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '${DEFAULT_CATEGORY_COLOR}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer', 'account')),
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
    note TEXT NOT NULL DEFAULT '',
    account_id TEXT,
    from_account_id TEXT,
    to_account_id TEXT,
    category_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
    FOREIGN KEY (from_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
    FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
  );
`)

const transactionColumns = db.prepare('PRAGMA table_info(transactions)').all()
if (!transactionColumns.some((column) => column.name === 'vendor')) {
  db.exec(`ALTER TABLE transactions ADD COLUMN vendor TEXT NOT NULL DEFAULT ''`)
}

const legacyBuckets = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='buckets'")
  .get()

if (legacyBuckets) {
  console.warn(
    '[money-manager] Legacy budget database detected. Reset with: docker compose down -v && docker compose up --build -d',
  )
}

const centsToAmount = (cents) => cents / 100

const amountToCents = (value) => {
  const amount = Number(value)

  if (!Number.isFinite(amount) || amount <= 0) {
    return null
  }

  return Math.round(amount * 100)
}

const normalizeInitialCents = (value) => {
  const amount = Number(value)

  if (!Number.isFinite(amount) || amount < 0) {
    return null
  }

  return Math.round(amount * 100)
}

const normalizeVendor = (value) => String(value ?? '').trim()

const mapTransactionRow = (transaction) => ({
  id: transaction.id,
  type: transaction.type,
  amount: centsToAmount(transaction.amount_cents),
  date: transaction.created_at,
  note: transaction.note,
  vendor: normalizeVendor(transaction.vendor) || undefined,
  accountId: transaction.account_id ?? undefined,
  fromAccountId: transaction.from_account_id ?? undefined,
  toAccountId: transaction.to_account_id ?? undefined,
  categoryId: transaction.category_id ?? undefined,
})

const normalizeWeekStartDay = (value) => {
  const day = Number(value)
  if (!Number.isInteger(day) || day < 0 || day > 6) {
    return 1
  }
  return day
}

const startOfWeek = (date, weekStartDay = 1) => {
  const start = new Date(date)
  const day = start.getDay()
  const diff = (day - weekStartDay + 7) % 7
  start.setDate(start.getDate() - diff)
  start.setHours(0, 0, 0, 0)
  return start
}

const getBookRange = (granularity, offset, weekStartDay = 1) => {
  const parsedOffset = Number(offset) || 0
  const normalizedWeekStart = normalizeWeekStartDay(weekStartDay)
  const now = new Date()

  if (granularity === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth() + parsedOffset, 1)
    const end = new Date(now.getFullYear(), now.getMonth() + parsedOffset + 1, 1)
    return { granularity, offset: parsedOffset, start, end, weekStartDay: normalizedWeekStart }
  }

  const start = startOfWeek(now, normalizedWeekStart)
  start.setDate(start.getDate() + parsedOffset * 7)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)

  return { granularity: 'week', offset: parsedOffset, start, end, weekStartDay: normalizedWeekStart }
}

const formatBookTitle = (granularity, start, end) => {
  if (granularity === 'month') {
    return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const endInclusive = new Date(end)
  endInclusive.setDate(endInclusive.getDate() - 1)

  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endLabel = endInclusive.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: start.getFullYear() === endInclusive.getFullYear() ? undefined : 'numeric',
  })

  return `${startLabel} – ${endLabel}`
}

const toDateKey = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const eachDayInRange = (start, end) => {
  const days = []
  const cursor = new Date(start)

  while (cursor < end) {
    days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return days
}

const parseTransactionDate = (value) => {
  if (value === undefined || value === null || value === '') {
    return new Date().toISOString()
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString()
}

const applyTransactionBalances = (transaction) => {
  const amountCents = transaction.amount_cents

  if (transaction.type === 'expense') {
    db.prepare('UPDATE accounts SET balance_cents = balance_cents - ? WHERE id = ?').run(
      amountCents,
      transaction.account_id,
    )
    return
  }

  if (transaction.type === 'income') {
    db.prepare('UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?').run(
      amountCents,
      transaction.account_id,
    )
    return
  }

  if (transaction.type === 'transfer') {
    db.prepare('UPDATE accounts SET balance_cents = balance_cents - ? WHERE id = ?').run(
      amountCents,
      transaction.from_account_id,
    )
    db.prepare('UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?').run(
      amountCents,
      transaction.to_account_id,
    )
  }
}

const reverseTransactionBalances = (transaction) => {
  const amountCents = transaction.amount_cents

  if (transaction.type === 'expense') {
    db.prepare('UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?').run(
      amountCents,
      transaction.account_id,
    )
    return
  }

  if (transaction.type === 'income') {
    db.prepare('UPDATE accounts SET balance_cents = balance_cents - ? WHERE id = ?').run(
      amountCents,
      transaction.account_id,
    )
    return
  }

  if (transaction.type === 'transfer') {
    db.prepare('UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?').run(
      amountCents,
      transaction.from_account_id,
    )
    db.prepare('UPDATE accounts SET balance_cents = balance_cents - ? WHERE id = ?').run(
      amountCents,
      transaction.to_account_id,
    )
  }
}

const getEditableTransaction = (id) => {
  const transaction = db
    .prepare(
      `SELECT
        id,
        type,
        amount_cents,
        note,
        vendor,
        account_id,
        from_account_id,
        to_account_id,
        category_id,
        created_at
      FROM transactions
      WHERE id = ?`,
    )
    .get(id)

  if (!transaction) {
    return null
  }

  if (!['expense', 'income', 'transfer'].includes(transaction.type)) {
    return null
  }

  return transaction
}

const getBook = (granularity, offset, weekStartDay = 1) => {
  const range = getBookRange(granularity, offset, weekStartDay)
  const startIso = range.start.toISOString()
  const endIso = range.end.toISOString()

  const rows = db
    .prepare(
      `SELECT
        id,
        type,
        amount_cents,
        note,
        vendor,
        account_id,
        from_account_id,
        to_account_id,
        category_id,
        created_at
      FROM transactions
      WHERE type IN ('expense', 'income', 'transfer')
        AND datetime(created_at) >= datetime(?)
        AND datetime(created_at) < datetime(?)
      ORDER BY datetime(created_at) ASC, rowid ASC`,
    )
    .all(startIso, endIso)
    .map(mapTransactionRow)

  const byDate = new Map()
  for (const transaction of rows) {
    const key = toDateKey(new Date(transaction.date))
    if (!byDate.has(key)) {
      byDate.set(key, [])
    }
    byDate.get(key).push(transaction)
  }

  let totalIncome = 0
  let totalExpenses = 0

  const days = eachDayInRange(range.start, range.end).map((day) => {
    const key = toDateKey(day)
    const transactions = byDate.get(key) ?? []

    let income = 0
    let expenses = 0

    for (const transaction of transactions) {
      if (transaction.type === 'income') {
        income += transaction.amount
        totalIncome += transaction.amount
      } else if (transaction.type === 'expense') {
        expenses += transaction.amount
        totalExpenses += transaction.amount
      }
    }

    return {
      date: key,
      label: day.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
      transactions,
      income,
      expenses,
    }
  })

  const byVendor = db
    .prepare(
      `SELECT
        TRIM(vendor) AS vendor,
        COALESCE(SUM(amount_cents), 0) AS total_cents,
        COUNT(*) AS count
      FROM transactions
      WHERE type = 'expense'
        AND TRIM(vendor) != ''
        AND datetime(created_at) >= datetime(?)
        AND datetime(created_at) < datetime(?)
      GROUP BY TRIM(vendor)
      ORDER BY total_cents DESC, vendor ASC`,
    )
    .all(startIso, endIso)
    .map((row) => ({
      vendor: row.vendor,
      amount: centsToAmount(row.total_cents),
      count: row.count,
    }))

  return {
    granularity: range.granularity,
    offset: range.offset,
    weekStartDay: range.weekStartDay,
    title: formatBookTitle(range.granularity, range.start, range.end),
    start: startIso,
    end: endIso,
    days,
    totals: {
      income: Math.round(totalIncome * 100) / 100,
      expenses: Math.round(totalExpenses * 100) / 100,
      net: Math.round((totalIncome - totalExpenses) * 100) / 100,
    },
    byVendor,
  }
}

const getPeriodBounds = (period) => {
  const now = new Date()

  if (period === 'all') {
    return { clause: '', params: [] }
  }

  if (period === '30d') {
    const start = new Date(now)
    start.setDate(start.getDate() - 30)
    return { clause: 'AND datetime(created_at) >= datetime(?)', params: [start.toISOString()] }
  }

  if (period === 'year') {
    const start = new Date(now.getFullYear(), 0, 1)
    return { clause: 'AND datetime(created_at) >= datetime(?)', params: [start.toISOString()] }
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return { clause: 'AND datetime(created_at) >= datetime(?)', params: [start.toISOString()] }
}

const getState = () => {
  const accounts = db
    .prepare('SELECT id, name, balance_cents FROM accounts ORDER BY created_at ASC')
    .all()
    .map((account) => ({
      id: account.id,
      name: account.name,
      balance: centsToAmount(account.balance_cents),
    }))

  const categories = db
    .prepare('SELECT id, name, color FROM categories ORDER BY created_at ASC')
    .all()
    .map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
    }))

  const transactions = db
    .prepare(
      `SELECT
        id,
        type,
        amount_cents,
        note,
        vendor,
        account_id,
        from_account_id,
        to_account_id,
        category_id,
        created_at
      FROM transactions
      ORDER BY datetime(created_at) DESC, rowid DESC`,
    )
    .all()
    .map(mapTransactionRow)

  return { accounts, categories, transactions }
}

const getSummary = (period) => {
  const { clause, params } = getPeriodBounds(period)

  const incomeRow = db
    .prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total
       FROM transactions
       WHERE type = 'income' ${clause}`,
    )
    .get(...params)

  const expenseRow = db
    .prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total
       FROM transactions
       WHERE type = 'expense' ${clause}`,
    )
    .get(...params)

  const totalIncome = incomeRow.total
  const totalExpenses = expenseRow.total

  const expensePeriodClause = clause ? clause.replace('created_at', 't.created_at') : ''

  const byCategory = db
    .prepare(
      `SELECT
        c.id,
        c.name,
        c.color,
        COALESCE(SUM(t.amount_cents), 0) AS total_cents
      FROM categories c
      LEFT JOIN transactions t
        ON t.category_id = c.id
        AND t.type = 'expense'
        ${expensePeriodClause}
      GROUP BY c.id
      HAVING total_cents > 0
      ORDER BY total_cents DESC`,
    )
    .all(...params)
    .map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      amount: centsToAmount(row.total_cents),
      percent: totalExpenses > 0 ? Math.round((row.total_cents / totalExpenses) * 1000) / 10 : 0,
    }))

  const uncategorized = db
    .prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total
       FROM transactions
       WHERE type = 'expense' AND category_id IS NULL ${clause}`,
    )
    .get(...params)

  if (uncategorized.total > 0) {
    byCategory.push({
      id: 'uncategorized',
      name: 'Uncategorized',
      color: DEFAULT_CATEGORY_COLOR,
      amount: centsToAmount(uncategorized.total),
      percent: totalExpenses > 0 ? Math.round((uncategorized.total / totalExpenses) * 1000) / 10 : 0,
    })
  }

  const byMonth = db
    .prepare(
      `SELECT
        strftime('%Y-%m', created_at) AS month,
        COALESCE(SUM(amount_cents), 0) AS total_cents
      FROM transactions
      WHERE type = 'expense' ${clause}
      GROUP BY month
      ORDER BY month ASC`,
    )
    .all(...params)
    .map((row) => ({
      month: row.month,
      amount: centsToAmount(row.total_cents),
    }))

  return {
    period,
    totalIncome: centsToAmount(totalIncome),
    totalExpenses: centsToAmount(totalExpenses),
    net: centsToAmount(totalIncome - totalExpenses),
    byCategory,
    byMonth,
  }
}

const insertTransaction = db.prepare(`
  INSERT INTO transactions (
    id,
    type,
    amount_cents,
    note,
    vendor,
    account_id,
    from_account_id,
    to_account_id,
    category_id,
    created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const createTransaction = ({
  type,
  amountCents,
  note,
  vendor = '',
  accountId = null,
  fromAccountId = null,
  toAccountId = null,
  categoryId = null,
  createdAt = new Date().toISOString(),
}) => {
  insertTransaction.run(
    randomUUID(),
    type,
    amountCents,
    note ?? '',
    normalizeVendor(vendor),
    accountId,
    fromAccountId,
    toAccountId,
    categoryId,
    createdAt,
  )
}

const app = express()
app.use(express.json())

const sendState = (res, status = 200) => res.status(status).json(getState())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/state', (_req, res) => {
  sendState(res)
})

app.get('/api/summary', (req, res) => {
  const period = String(req.query.period ?? 'month')
  const allowed = ['month', '30d', 'year', 'all']

  if (!allowed.includes(period)) {
    return res.status(400).json({ error: 'Invalid period. Use month, 30d, year, or all.' })
  }

  return res.json(getSummary(period))
})

app.get('/api/book', (req, res) => {
  const granularity = String(req.query.granularity ?? 'week')
  const offset = Number(req.query.offset ?? 0)
  const weekStartDay = normalizeWeekStartDay(req.query.weekStartDay ?? 1)

  if (!['week', 'month'].includes(granularity)) {
    return res.status(400).json({ error: 'Invalid granularity. Use week or month.' })
  }

  if (!Number.isFinite(offset)) {
    return res.status(400).json({ error: 'Invalid offset.' })
  }

  return res.json(getBook(granularity, offset, weekStartDay))
})

app.get('/api/vendors', (_req, res) => {
  const vendors = db
    .prepare(
      `SELECT DISTINCT TRIM(vendor) AS name
       FROM transactions
       WHERE TRIM(vendor) != ''
       ORDER BY name COLLATE NOCASE ASC`,
    )
    .all()
    .map((row) => row.name)

  return res.json({ vendors })
})

app.post('/api/accounts', (req, res) => {
  const name = String(req.body.name ?? '').trim()
  const balanceCents = normalizeInitialCents(req.body.balance ?? 0)

  if (!name) {
    return res.status(400).json({ error: 'Give the account a name first.' })
  }

  if (balanceCents === null) {
    return res.status(400).json({ error: 'Starting balance must be zero or a positive amount.' })
  }

  db.transaction(() => {
    const id = randomUUID()
    db.prepare('INSERT INTO accounts (id, name, balance_cents, created_at) VALUES (?, ?, ?, ?)').run(
      id,
      name,
      balanceCents,
      new Date().toISOString(),
    )
    createTransaction({
      type: 'account',
      amountCents: balanceCents,
      accountId: id,
      note: `${name} account created${balanceCents > 0 ? ` with ${centsToAmount(balanceCents)}` : ''}.`,
    })
  })()

  return sendState(res, 201)
})

app.post('/api/categories', (req, res) => {
  const name = String(req.body.name ?? '').trim()
  const color = String(req.body.color ?? DEFAULT_CATEGORY_COLOR).trim() || DEFAULT_CATEGORY_COLOR

  if (!name) {
    return res.status(400).json({ error: 'Give the category a name first.' })
  }

  const id = randomUUID()
  db.prepare('INSERT INTO categories (id, name, color, created_at) VALUES (?, ?, ?, ?)').run(
    id,
    name,
    color,
    new Date().toISOString(),
  )

  return sendState(res, 201)
})

const buildTransactionPayload = (body) => {
  const type = body.type
  const amountCents = amountToCents(body.amount)
  const note = String(body.note ?? '').trim()
  const vendor = normalizeVendor(body.vendor)
  const createdAt = parseTransactionDate(body.date)

  if (!['expense', 'income', 'transfer'].includes(type)) {
    throw new Error('Choose a valid transaction type.')
  }

  if (!amountCents) {
    throw new Error('Enter an amount greater than zero.')
  }

  if (!createdAt) {
    throw new Error('Choose a valid date and time.')
  }

  if (type === 'expense') {
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(body.accountId)
    const category = body.categoryId
      ? db.prepare('SELECT * FROM categories WHERE id = ?').get(body.categoryId)
      : null

    if (!account) {
      throw new Error('Choose an account for this expense.')
    }

    if (!category) {
      throw new Error('Choose a category for this expense.')
    }

    return {
      type: 'expense',
      amountCents,
      accountId: account.id,
      fromAccountId: null,
      toAccountId: null,
      categoryId: category.id,
      vendor,
      note: note || `${category.name} expense from ${account.name}.`,
      createdAt,
    }
  }

  if (type === 'income') {
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(body.accountId)
    const category = body.categoryId
      ? db.prepare('SELECT * FROM categories WHERE id = ?').get(body.categoryId)
      : null

    if (!account) {
      throw new Error('Choose an account for this income.')
    }

    return {
      type: 'income',
      amountCents,
      accountId: account.id,
      fromAccountId: null,
      toAccountId: null,
      categoryId: category?.id ?? null,
      vendor,
      note: note || `${category ? category.name : 'Income'} received in ${account.name}.`,
      createdAt,
    }
  }

  const fromAccount = db.prepare('SELECT * FROM accounts WHERE id = ?').get(body.fromAccountId)
  const toAccount = db.prepare('SELECT * FROM accounts WHERE id = ?').get(body.toAccountId)

  if (!fromAccount || !toAccount) {
    throw new Error('Choose both transfer accounts.')
  }

  if (fromAccount.id === toAccount.id) {
    throw new Error('Transfer accounts must be different.')
  }

  return {
    type: 'transfer',
    amountCents,
    accountId: null,
    fromAccountId: fromAccount.id,
    toAccountId: toAccount.id,
    categoryId: null,
    vendor: '',
    note: note || `Transfer from ${fromAccount.name} to ${toAccount.name}.`,
    createdAt,
  }
}

app.post('/api/transactions', (req, res) => {
  try {
    db.transaction(() => {
      const payload = buildTransactionPayload(req.body)
      applyTransactionBalances({
        type: payload.type,
        amount_cents: payload.amountCents,
        account_id: payload.accountId,
        from_account_id: payload.fromAccountId,
        to_account_id: payload.toAccountId,
      })
      createTransaction(payload)
    })()
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }

  return sendState(res, 201)
})

app.put('/api/transactions/:id', (req, res) => {
  const existing = getEditableTransaction(req.params.id)

  if (!existing) {
    return res.status(404).json({ error: 'Transaction not found.' })
  }

  try {
    db.transaction(() => {
      reverseTransactionBalances(existing)
      const payload = buildTransactionPayload(req.body)

      db.prepare(
        `UPDATE transactions
         SET type = ?,
             amount_cents = ?,
             note = ?,
             vendor = ?,
             account_id = ?,
             from_account_id = ?,
             to_account_id = ?,
             category_id = ?,
             created_at = ?
         WHERE id = ?`,
      ).run(
        payload.type,
        payload.amountCents,
        payload.note,
        normalizeVendor(payload.vendor),
        payload.accountId,
        payload.fromAccountId,
        payload.toAccountId,
        payload.categoryId,
        payload.createdAt,
        existing.id,
      )

      applyTransactionBalances({
        type: payload.type,
        amount_cents: payload.amountCents,
        account_id: payload.accountId,
        from_account_id: payload.fromAccountId,
        to_account_id: payload.toAccountId,
      })
    })()
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }

  return sendState(res)
})

app.delete('/api/transactions/:id', (req, res) => {
  const existing = getEditableTransaction(req.params.id)

  if (!existing) {
    return res.status(404).json({ error: 'Transaction not found.' })
  }

  try {
    db.transaction(() => {
      reverseTransactionBalances(existing)
      db.prepare('DELETE FROM transactions WHERE id = ?').run(existing.id)
    })()
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }

  return sendState(res)
})

app.delete('/api/accounts/:id', (req, res) => {
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id)

  if (!account) {
    return res.status(404).json({ error: 'Account not found.' })
  }

  if (account.balance_cents !== 0) {
    return res.status(400).json({
      error: `Empty ${account.name} before deleting it. Current balance: ${centsToAmount(account.balance_cents)}.`,
    })
  }

  db.transaction(() => {
    db.prepare('DELETE FROM accounts WHERE id = ?').run(account.id)
    createTransaction({
      type: 'account',
      amountCents: 0,
      accountId: account.id,
      note: `${account.name} account removed.`,
    })
  })()

  return sendState(res)
})

app.delete('/api/categories/:id', (req, res) => {
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id)

  if (!category) {
    return res.status(404).json({ error: 'Category not found.' })
  }

  const usage = db
    .prepare(
      `SELECT COUNT(*) AS count FROM transactions
       WHERE category_id = ? AND type IN ('expense', 'income')`,
    )
    .get(category.id)

  if (usage.count > 0) {
    return res.status(400).json({
      error: `${category.name} is used in ${usage.count} transaction(s). Remove or reassign them first.`,
    })
  }

  db.prepare('DELETE FROM categories WHERE id = ?').run(category.id)

  return sendState(res)
})

const distPath = path.join(projectRoot, 'dist')

if (existsSync(distPath)) {
  app.use(express.static(distPath))
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
      res.sendFile(path.join(distPath, 'index.html'))
      return
    }

    next()
  })
}

app.listen(port, () => {
  console.log(`Block N201 jam3eyye track listening on port ${port}`)
  console.log(`Database: ${dbPath}`)
  if (!existsSync(dbPath)) {
    console.log('Database file will be created on first write.')
  }
})
