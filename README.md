# Expense Tracker

Personal expense tracker with accounts, categories, income/expense/transfer transactions, spending charts, and a full activity log. React frontend, Express API, SQLite database.

## Docker (production)

```bash
git clone https://github.com/aliosayle/money-manager.git
cd money-manager
docker compose up --build -d
```

Open `http://YOUR_SERVER:3000`.

### Data persistence

The database file is stored on the host at **`./data/money-manager.sqlite`** (bind-mounted into the container). It survives:

- `docker compose restart`
- `docker compose down` then `docker compose up -d`
- `docker compose up --build -d`

Data is **only deleted** if you run `docker compose down -v` or manually delete the `data/` folder.

After changing `docker-compose.yml` from a named volume to `./data`, recreate the container once (without `-v`):

```bash
docker compose down
docker compose up --build -d
```

Your old data may still be in the previous Docker named volume `money-manager-data`. To copy it out once:

```bash
docker run --rm -v money-manager_money-manager-data:/from -v "%cd%/data":/to alpine cp /from/money-manager.sqlite /to/
```

(Use `$(pwd)/data` instead of `%cd%/data` on Linux/macOS.)

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
- **Transaction book**: flip through weeks or months with prev/next; each day lists entries like a ledger
- Optional **Place** on expenses/income (stores, supermarkets) with spending-by-place on the book page
- Export data as JSON
- Delete zero-balance accounts and unused categories
