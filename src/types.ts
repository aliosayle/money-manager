export type Account = {
  id: string
  name: string
  balance: number
}

export type Category = {
  id: string
  name: string
  color: string
}

export type TransactionType = 'expense' | 'income' | 'transfer' | 'account'

export type Transaction = {
  id: string
  type: TransactionType
  amount: number
  date: string
  note: string
  vendor?: string
  accountId?: string
  fromAccountId?: string
  toAccountId?: string
  categoryId?: string
}

export type MoneyState = {
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
}

export type Period = 'month' | '30d' | 'year' | 'all'

export type CategorySummary = {
  id: string
  name: string
  color: string
  amount: number
  percent: number
}

export type MonthSummary = {
  month: string
  amount: number
}

export type Summary = {
  period: Period
  totalIncome: number
  totalExpenses: number
  net: number
  byCategory: CategorySummary[]
  byMonth: MonthSummary[]
}

export type TransactionForm = {
  type: 'expense' | 'income' | 'transfer'
  amount: string
  accountId: string
  fromAccountId: string
  toAccountId: string
  categoryId: string
  vendor: string
  note: string
}

export type BookGranularity = 'week' | 'month'

export type BookDay = {
  date: string
  label: string
  transactions: Transaction[]
  income: number
  expenses: number
}

export type VendorSummary = {
  vendor: string
  amount: number
  count: number
}

export type BookView = {
  granularity: BookGranularity
  offset: number
  title: string
  start: string
  end: string
  days: BookDay[]
  totals: {
    income: number
    expenses: number
    net: number
  }
  byVendor: VendorSummary[]
}

export type Page = 'dashboard' | 'book' | 'add' | 'accounts' | 'categories' | 'log'
