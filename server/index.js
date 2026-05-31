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
        account_id,
        from_account_id,
        to_account_id,
        category_id,
        created_at
      FROM transactions
      ORDER BY datetime(created_at) DESC, rowid DESC`,
    )
    .all()
    .map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      amount: centsToAmount(transaction.amount_cents),
      date: transaction.created_at,
      note: transaction.note,
      accountId: transaction.account_id ?? undefined,
      fromAccountId: transaction.from_account_id ?? undefined,
      toAccountId: transaction.to_account_id ?? undefined,
      categoryId: transaction.category_id ?? undefined,
    }))

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
    account_id,
    from_account_id,
    to_account_id,
    category_id,
    created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const createTransaction = ({
  type,
  amountCents,
  note,
  accountId = null,
  fromAccountId = null,
  toAccountId = null,
  categoryId = null,
}) => {
  insertTransaction.run(
    randomUUID(),
    type,
    amountCents,
    note ?? '',
    accountId,
    fromAccountId,
    toAccountId,
    categoryId,
    new Date().toISOString(),
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

app.post('/api/transactions', (req, res) => {
  const type = req.body.type
  const amountCents = amountToCents(req.body.amount)
  const note = String(req.body.note ?? '').trim()

  if (!['expense', 'income', 'transfer'].includes(type)) {
    return res.status(400).json({ error: 'Choose a valid transaction type.' })
  }

  if (!amountCents) {
    return res.status(400).json({ error: 'Enter an amount greater than zero.' })
  }

  try {
    db.transaction(() => {
      if (type === 'expense') {
        const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.body.accountId)
        const category = req.body.categoryId
          ? db.prepare('SELECT * FROM categories WHERE id = ?').get(req.body.categoryId)
          : null

        if (!account) {
          throw new Error('Choose an account for this expense.')
        }

        if (!category) {
          throw new Error('Choose a category for this expense.')
        }

        if (account.balance_cents < amountCents) {
          throw new Error(`${account.name} only has ${centsToAmount(account.balance_cents)} available.`)
        }

        db.prepare('UPDATE accounts SET balance_cents = balance_cents - ? WHERE id = ?').run(
          amountCents,
          account.id,
        )
        createTransaction({
          type: 'expense',
          amountCents,
          accountId: account.id,
          categoryId: category.id,
          note: note || `${category.name} expense from ${account.name}.`,
        })
        return
      }

      if (type === 'income') {
        const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.body.accountId)
        const category = req.body.categoryId
          ? db.prepare('SELECT * FROM categories WHERE id = ?').get(req.body.categoryId)
          : null

        if (!account) {
          throw new Error('Choose an account for this income.')
        }

        db.prepare('UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?').run(
          amountCents,
          account.id,
        )
        createTransaction({
          type: 'income',
          amountCents,
          accountId: account.id,
          categoryId: category?.id ?? null,
          note:
            note ||
            `${category ? category.name : 'Income'} received in ${account.name}.`,
        })
        return
      }

      const fromAccount = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.body.fromAccountId)
      const toAccount = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.body.toAccountId)

      if (!fromAccount || !toAccount) {
        throw new Error('Choose both transfer accounts.')
      }

      if (fromAccount.id === toAccount.id) {
        throw new Error('Transfer accounts must be different.')
      }

      if (fromAccount.balance_cents < amountCents) {
        throw new Error(`${fromAccount.name} only has ${centsToAmount(fromAccount.balance_cents)} available.`)
      }

      db.prepare('UPDATE accounts SET balance_cents = balance_cents - ? WHERE id = ?').run(
        amountCents,
        fromAccount.id,
      )
      db.prepare('UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?').run(
        amountCents,
        toAccount.id,
      )
      createTransaction({
        type: 'transfer',
        amountCents,
        fromAccountId: fromAccount.id,
        toAccountId: toAccount.id,
        note: note || `Transfer from ${fromAccount.name} to ${toAccount.name}.`,
      })
    })()
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }

  return sendState(res, 201)
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
  console.log(`Expense Tracker listening on port ${port}`)
  console.log(`Database: ${dbPath}`)
  if (!existsSync(dbPath)) {
    console.log('Database file will be created on first write.')
  }
})
