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
  note: string
}

export type Page = 'dashboard' | 'add' | 'accounts' | 'categories' | 'log'
