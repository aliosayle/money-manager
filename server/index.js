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

  CREATE TABLE IF NOT EXISTS buckets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    balance_cents INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('deposit', 'withdraw', 'transfer', 'allocate', 'account')),
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
    note TEXT NOT NULL DEFAULT '',
    account_id TEXT,
    from_account_id TEXT,
    to_account_id TEXT,
    bucket_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
    FOREIGN KEY (from_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
    FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
    FOREIGN KEY (bucket_id) REFERENCES buckets(id) ON DELETE SET NULL
  );
`)

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

const getTotals = () => {
  const accountsTotal = db
    .prepare('SELECT COALESCE(SUM(balance_cents), 0) AS total FROM accounts')
    .get().total
  const bucketsTotal = db
    .prepare('SELECT COALESCE(SUM(balance_cents), 0) AS total FROM buckets')
    .get().total

  return {
    accountsTotal,
    bucketsTotal,
    leftToAssign: accountsTotal - bucketsTotal,
  }
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

  const buckets = db
    .prepare('SELECT id, name, balance_cents FROM buckets ORDER BY created_at ASC')
    .all()
    .map((bucket) => ({
      id: bucket.id,
      name: bucket.name,
      balance: centsToAmount(bucket.balance_cents),
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
        bucket_id,
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
      bucketId: transaction.bucket_id ?? undefined,
    }))

  return { accounts, buckets, transactions }
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
    bucket_id,
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
  bucketId = null,
}) => {
  insertTransaction.run(
    randomUUID(),
    type,
    amountCents,
    note ?? '',
    accountId,
    fromAccountId,
    toAccountId,
    bucketId,
    new Date().toISOString(),
  )
}

const seedDatabase = () => {
  const accountCount = db.prepare('SELECT COUNT(*) AS count FROM accounts').get().count

  if (accountCount > 0) {
    return
  }

  const insertAccount = db.prepare(
    'INSERT INTO accounts (id, name, balance_cents, created_at) VALUES (?, ?, ?, ?)',
  )
  const insertBucket = db.prepare(
    'INSERT INTO buckets (id, name, balance_cents, created_at) VALUES (?, ?, ?, ?)',
  )
  const now = new Date().toISOString()

  db.transaction(() => {
    insertAccount.run('checking', 'Everyday checking', 125000, now)
    insertAccount.run('cash', 'Cash wallet', 14000, now)
    insertBucket.run('rent', 'Rent', 90000, now)
    insertBucket.run('food', 'Food', 26000, now)
    insertBucket.run('savings', 'Emergency fund', 15000, now)
    createTransaction({
      type: 'account',
      amountCents: 139000,
      note: 'Starter balances added. Replace these with your own accounts and budget.',
    })
  })()
}

seedDatabase()

const app = express()
app.use(express.json())

const sendState = (res, status = 200) => res.status(status).json(getState())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/state', (_req, res) => {
  sendState(res)
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

app.post('/api/buckets', (req, res) => {
  const name = String(req.body.name ?? '').trim()
  const balanceCents = normalizeInitialCents(req.body.balance ?? 0)

  if (!name) {
    return res.status(400).json({ error: 'Give the bucket a name first.' })
  }

  if (balanceCents === null) {
    return res.status(400).json({ error: 'Bucket starting balance must be zero or a positive amount.' })
  }

  if (balanceCents > getTotals().leftToAssign) {
    return res.status(400).json({
      error: `You only have ${centsToAmount(getTotals().leftToAssign)} left to assign.`,
    })
  }

  db.transaction(() => {
    const id = randomUUID()
    db.prepare('INSERT INTO buckets (id, name, balance_cents, created_at) VALUES (?, ?, ?, ?)').run(
      id,
      name,
      balanceCents,
      new Date().toISOString(),
    )
    createTransaction({
      type: 'allocate',
      amountCents: balanceCents,
      bucketId: id,
      note: `${name} bucket created${balanceCents > 0 ? ` with ${centsToAmount(balanceCents)}` : ''}.`,
    })
  })()

  return sendState(res, 201)
})

app.post('/api/transactions', (req, res) => {
  const type = req.body.type
  const amountCents = amountToCents(req.body.amount)
  const note = String(req.body.note ?? '').trim()

  if (!['deposit', 'withdraw', 'transfer'].includes(type)) {
    return res.status(400).json({ error: 'Choose a valid transaction type.' })
  }

  if (!amountCents) {
    return res.status(400).json({ error: 'Enter an amount greater than zero.' })
  }

  try {
    db.transaction(() => {
      if (type === 'deposit') {
        const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.body.accountId)

        if (!account) {
          throw new Error('Choose an account for the deposit.')
        }

        db.prepare('UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?').run(
          amountCents,
          account.id,
        )
        createTransaction({
          type: 'deposit',
          amountCents,
          accountId: account.id,
          note: note || `Deposit into ${account.name}.`,
        })
        return
      }

      if (type === 'withdraw') {
        const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.body.accountId)
        const bucket = req.body.bucketId
          ? db.prepare('SELECT * FROM buckets WHERE id = ?').get(req.body.bucketId)
          : null

        if (!account) {
          throw new Error('Choose an account for the withdrawal.')
        }

        if (account.balance_cents < amountCents) {
          throw new Error(`${account.name} only has ${centsToAmount(account.balance_cents)} available.`)
        }

        if (bucket && bucket.balance_cents < amountCents) {
          throw new Error(`${bucket.name} only has ${centsToAmount(bucket.balance_cents)} assigned.`)
        }

        db.prepare('UPDATE accounts SET balance_cents = balance_cents - ? WHERE id = ?').run(
          amountCents,
          account.id,
        )

        if (bucket) {
          db.prepare('UPDATE buckets SET balance_cents = balance_cents - ? WHERE id = ?').run(
            amountCents,
            bucket.id,
          )
        }

        createTransaction({
          type: 'withdraw',
          amountCents,
          accountId: account.id,
          bucketId: bucket?.id,
          note: note || `Withdrawal from ${account.name}${bucket ? ` for ${bucket.name}` : ''}.`,
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

app.post('/api/allocations', (req, res) => {
  const amountCents = amountToCents(req.body.amount)
  const direction = req.body.direction
  const note = String(req.body.note ?? '').trim()

  if (!amountCents) {
    return res.status(400).json({ error: 'Enter an allocation amount greater than zero.' })
  }

  if (!['assign', 'release'].includes(direction)) {
    return res.status(400).json({ error: 'Choose assign or release.' })
  }

  try {
    db.transaction(() => {
      const bucket = db.prepare('SELECT * FROM buckets WHERE id = ?').get(req.body.bucketId)

      if (!bucket) {
        throw new Error('Choose a bucket to adjust.')
      }

      if (direction === 'assign' && amountCents > getTotals().leftToAssign) {
        throw new Error(`You only have ${centsToAmount(getTotals().leftToAssign)} left to assign.`)
      }

      if (direction === 'release' && amountCents > bucket.balance_cents) {
        throw new Error(`${bucket.name} only has ${centsToAmount(bucket.balance_cents)} assigned.`)
      }

      const multiplier = direction === 'assign' ? 1 : -1
      db.prepare('UPDATE buckets SET balance_cents = balance_cents + ? WHERE id = ?').run(
        amountCents * multiplier,
        bucket.id,
      )
      createTransaction({
        type: 'allocate',
        amountCents,
        bucketId: bucket.id,
        note: note || `${direction === 'assign' ? 'Assigned to' : 'Released from'} ${bucket.name}.`,
      })
    })()
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }

  return sendState(res, 201)
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
  console.log(`Money Manager listening on port ${port}`)
  console.log(`Database: ${dbPath}`)
})
