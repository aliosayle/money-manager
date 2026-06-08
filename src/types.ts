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

export type MonthFlowSummary = {
  month: string
  income: number
  expenses: number
}

export type CashFlowPoint = {
  key: string
  label: string
  income: number
  expenses: number
  net: number
}

export type AccountSpendSummary = {
  id: string
  name: string
  amount: number
  percent: number
}

export type TopExpense = {
  id: string
  amount: number
  vendor?: string
  categoryName: string
  date: string
  note: string
}

export type SummaryInsights = {
  expenseCount: number
  incomeCount: number
  avgDailySpend: number
  savingsRate: number | null
  expenseChangePercent: number | null
  comparisonLabel: string | null
  previousExpenses: number | null
}

export type Summary = {
  period: Period
  totalIncome: number
  totalExpenses: number
  net: number
  byCategory: CategorySummary[]
  byMonth: MonthSummary[]
  byMonthFlow: MonthFlowSummary[]
  byVendor: VendorSummary[]
  byAccount: AccountSpendSummary[]
  cashFlow: CashFlowPoint[]
  topExpenses: TopExpense[]
  insights: SummaryInsights
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

export type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6

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

export type TransactionPayload = {
  type: 'expense' | 'income' | 'transfer'
  amount: number
  accountId?: string
  fromAccountId?: string
  toAccountId?: string
  categoryId?: string
  vendor?: string
  note?: string
  date?: string
}

export type BookView = {
  granularity: BookGranularity
  offset: number
  weekStartDay: WeekStartDay
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
