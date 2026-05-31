# Expense Tracker

Personal expense tracker with accounts, categories, income/expense/transfer transactions, spending charts, and a full activity log. React frontend, Express API, SQLite database.

## Docker (production)

```bash
git clone https://github.com/aliosayle/money-manager.git
cd money-manager
docker compose up --build -d
```

Open `http://YOUR_SERVER:3000`.

Data is stored in the Docker volume `money-manager-data`.

### Breaking schema upgrade

If you previously ran the zero-based budget version, reset the database after pulling:

```bash
git pull
docker compose down -v
docker compose up --build -d
```

The `-v` flag removes the old volume (buckets/allocate schema). Without a reset, the server logs a legacy-database warning and the new API may not work correctly.

### Reset database (remove all data)

```bash
docker compose down -v
docker compose up --build -d
```

New databases start **empty** with no demo accounts or transactions.

### Update after code changes

```bash
git pull
docker compose up --build -d
```

Use `docker compose down -v` when the release notes mention a schema change.

## Local development

Terminal 1 — API:

```bash
npm install
npm run dev:server
```

Terminal 2 — frontend:

```bash
npm run dev
```

Vite proxies `/api` to `http://localhost:3000`.

## Features

- Multiple accounts with balances
- Categories with optional colors (for chart segments)
- Expense (category required), income (optional category), and transfer between accounts
- Dashboard with period filter (month, 30 days, year, all time)
- Pie chart: spending by category; bar chart: monthly expenses
- Full activity log with search, type, and category filters
- Export data as JSON
- Delete zero-balance accounts and unused categories
