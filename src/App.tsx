import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  ActionIcon,
  Alert,
  AppShell,
  Badge,
  Burger,
  Button,
  Card,
  ColorInput,
  Container,
  Grid,
  Group,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconArrowDownLeft,
  IconArrowRight,
  IconArrowUpRight,
  IconBook2,
  IconCategory,
  IconCreditCard,
  IconDownload,
  IconHistory,
  IconHome,
  IconInfoCircle,
  IconPlus,
  IconTrash,
  IconTransfer,
  IconWallet,
} from '@tabler/icons-react'
import {
  deleteState,
  deleteTransaction,
  fetchBook,
  fetchState,
  fetchSummary,
  fetchVendors,
  formatMoney,
  parseAmount,
  postState,
  updateTransaction,
} from './api'
import { getWeekStartDay, setWeekStartDay } from './bookPrefs'
import { Book } from './components/Book'
import { BookTransactionModal } from './components/BookTransactionModal'
import { Dashboard } from './components/Dashboard'
import { TransactionForm } from './components/TransactionForm'
import { inputValue, stringFromInput } from './formUtils'
import type {
  BookGranularity,
  BookView,
  MoneyState,
  Page,
  Period,
  Summary,
  Transaction,
  TransactionForm as TransactionFormState,
  WeekStartDay,
} from './types'
import './App.css'

const pages = [
  { id: 'dashboard', label: 'Dashboard', icon: IconHome },
  { id: 'book', label: 'Book', icon: IconBook2 },
  { id: 'add', label: 'Add', icon: IconTransfer },
  { id: 'accounts', label: 'Accounts', icon: IconCreditCard },
  { id: 'categories', label: 'Categories', icon: IconCategory },
  { id: 'log', label: 'Activity log', icon: IconHistory },
] as const

const pageTitles: Record<Page, string> = {
  dashboard: 'Dashboard',
  book: 'Transaction book',
  add: 'Add transaction',
  accounts: 'Accounts',
  categories: 'Categories',
  log: 'Activity log',
}

const emptyState: MoneyState = {
  accounts: [],
  categories: [],
  transactions: [],
}

const blankTransactionForm: TransactionFormState = {
  type: 'expense',
  amount: '',
  accountId: '',
  fromAccountId: '',
  toAccountId: '',
  categoryId: '',
  vendor: '',
  note: '',
}

const DEFAULT_CATEGORY_COLOR = '#228be6'

function App() {
  const [opened, { toggle }] = useDisclosure()
  const [activePage, setActivePage] = useState<Page>('dashboard')
  const [moneyState, setMoneyState] = useState<MoneyState>(emptyState)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [period, setPeriod] = useState<Period>('month')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [transactionForm, setTransactionForm] = useState<TransactionFormState>(blankTransactionForm)
  const [newAccount, setNewAccount] = useState({ name: '', balance: '' })
  const [newCategory, setNewCategory] = useState({ name: '', color: DEFAULT_CATEGORY_COLOR })
  const [logSearch, setLogSearch] = useState('')
  const [logType, setLogType] = useState('all')
  const [logCategory, setLogCategory] = useState('all')
  const [bookView, setBookView] = useState<BookView | null>(null)
  const [bookLoading, setBookLoading] = useState(false)
  const [bookGranularity, setBookGranularity] = useState<BookGranularity>('week')
  const [bookOffset, setBookOffset] = useState(0)
  const [bookWeekStartDay, setBookWeekStartDay] = useState<WeekStartDay>(() => getWeekStartDay())
  const [vendorSuggestions, setVendorSuggestions] = useState<string[]>([])
  const [bookModalOpen, setBookModalOpen] = useState(false)
  const [bookModalMode, setBookModalMode] = useState<'create' | 'edit'>('create')
  const [bookModalTransaction, setBookModalTransaction] = useState<Transaction | undefined>()
  const [bookModalDate, setBookModalDate] = useState<string | undefined>()
  const [bookSaving, setBookSaving] = useState(false)
  const bookRequestId = useRef(0)

  const applyMoneyState = useCallback((state: MoneyState) => {
    setMoneyState(state)
  }, [])

  const refreshSummary = useCallback(async (selectedPeriod: Period) => {
    setSummaryLoading(true)
    try {
      const data = await fetchSummary(selectedPeriod)
      setSummary(data)
    } catch {
      setSummary(null)
    } finally {
      setSummaryLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void fetchState()
      .then((state) => {
        if (!cancelled) {
          applyMoneyState(state)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNotice('Could not load data from the server.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    void fetchVendors()
      .then((result) => {
        if (!cancelled) {
          setVendorSuggestions(result.vendors)
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [applyMoneyState])

  const loadBook = useCallback(
    async (granularity: BookGranularity, offset: number, weekStartDay: WeekStartDay) => {
      const requestId = ++bookRequestId.current
      setBookLoading(true)

      try {
        const data = await fetchBook(granularity, offset, weekStartDay)
        if (bookRequestId.current !== requestId) {
          return
        }
        setBookView(data)
      } catch {
        if (bookRequestId.current !== requestId) {
          return
        }
        setBookView(null)
      } finally {
        if (bookRequestId.current === requestId) {
          setBookLoading(false)
        }
      }
    },
    [],
  )

  useEffect(() => {
    if (activePage !== 'book') {
      return
    }

    void loadBook(bookGranularity, bookOffset, bookWeekStartDay)
  }, [
    activePage,
    bookGranularity,
    bookOffset,
    bookWeekStartDay,
    moneyState.transactions.length,
    loadBook,
  ])

  useEffect(() => {
    if (activePage !== 'dashboard') {
      return
    }

    let cancelled = false

    void (async () => {
      setSummaryLoading(true)

      try {
        const data = await fetchSummary(period)
        if (!cancelled) {
          setSummary(data)
        }
      } catch {
        if (!cancelled) {
          setSummary(null)
        }
      } finally {
        if (!cancelled) {
          setSummaryLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activePage, period])

  const showPage = (page: Page) => {
    setActivePage(page)
    setNotice('')
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      toggle()
    }
  }

  const startTransaction = (type: TransactionFormState['type']) => {
    setTransactionForm({ ...blankTransactionForm, type })
    showPage('add')
  }

  const handleTransactionSubmit = async () => {
    const amount = parseAmount(transactionForm.amount)

    if (!amount) {
      setNotice('Enter an amount greater than zero.')
      return
    }

    try {
      const body =
        transactionForm.type === 'transfer'
          ? {
              type: 'transfer',
              amount,
              fromAccountId: transactionForm.fromAccountId,
              toAccountId: transactionForm.toAccountId,
              note: transactionForm.note,
            }
          : {
              type: transactionForm.type,
              amount,
              accountId: transactionForm.accountId,
              categoryId: transactionForm.categoryId || undefined,
              vendor: transactionForm.vendor.trim() || undefined,
              note: transactionForm.note,
            }

      const savedVendor = transactionForm.vendor.trim()
      const state = await postState('/api/transactions', body)
      applyMoneyState(state)
      setTransactionForm(blankTransactionForm)
      setNotice('')
      if (savedVendor) {
        setVendorSuggestions((current) => {
          const next = savedVendor
          if (current.includes(next)) {
            return current
          }
          return [...current, next].sort((a, b) => a.localeCompare(b))
        })
      }
      if (activePage === 'dashboard') {
        void refreshSummary(period)
      }
      if (activePage === 'book') {
        void loadBook(bookGranularity, bookOffset, bookWeekStartDay)
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save transaction.')
    }
  }

  const handleAddAccount = async (event: FormEvent) => {
    event.preventDefault()
    const balance = newAccount.balance === '' ? 0 : parseAmount(newAccount.balance)

    if (balance === null && newAccount.balance !== '') {
      setNotice('Starting balance must be zero or a positive amount.')
      return
    }

    try {
      const state = await postState('/api/accounts', {
        name: newAccount.name.trim(),
        balance: balance ?? 0,
      })
      applyMoneyState(state)
      setNewAccount({ name: '', balance: '' })
      setNotice('')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not create account.')
    }
  }

  const handleAddCategory = async (event: FormEvent) => {
    event.preventDefault()

    try {
      const state = await postState('/api/categories', {
        name: newCategory.name.trim(),
        color: newCategory.color,
      })
      applyMoneyState(state)
      setNewCategory({ name: '', color: DEFAULT_CATEGORY_COLOR })
      setNotice('')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not create category.')
    }
  }

  const handleDeleteAccount = async (id: string) => {
    try {
      const state = await deleteState(`/api/accounts/${id}`)
      applyMoneyState(state)
      setNotice('')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not delete account.')
    }
  }

  const handleDeleteCategory = async (id: string) => {
    try {
      const state = await deleteState(`/api/categories/${id}`)
      applyMoneyState(state)
      setNotice('')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not delete category.')
    }
  }

  const openBookCreate = (dateKey: string) => {
    setBookModalMode('create')
    setBookModalTransaction(undefined)
    setBookModalDate(dateKey)
    setBookModalOpen(true)
  }

  const openBookEdit = (transaction: Transaction) => {
    setBookModalMode('edit')
    setBookModalTransaction(transaction)
    setBookModalDate(undefined)
    setBookModalOpen(true)
  }

  const closeBookModal = (force = false) => {
    if (!force && bookSaving) {
      return
    }

    setBookModalOpen(false)
    setBookModalTransaction(undefined)
    setBookModalDate(undefined)
  }

  const buildTransactionBody = (form: TransactionFormState, date: string) => {
    const amount = parseAmount(form.amount)

    if (!amount) {
      throw new Error('Enter an amount greater than zero.')
    }

    return form.type === 'transfer'
      ? {
          type: 'transfer' as const,
          amount,
          fromAccountId: form.fromAccountId,
          toAccountId: form.toAccountId,
          note: form.note,
          date,
        }
      : {
          type: form.type,
          amount,
          accountId: form.accountId,
          categoryId: form.categoryId || undefined,
          vendor: form.vendor.trim() || undefined,
          note: form.note,
          date,
        }
  }

  const handleBookSave = async (form: TransactionFormState, date: string) => {
    setBookSaving(true)

    try {
      const body = buildTransactionBody(form, date)
      const state =
        bookModalMode === 'edit' && bookModalTransaction
          ? await updateTransaction(bookModalTransaction.id, body)
          : await postState('/api/transactions', body)

      applyMoneyState(state)
      setNotice('')
      closeBookModal(true)

      const savedVendor = form.vendor.trim()
      if (savedVendor) {
        setVendorSuggestions((current) => {
          if (current.includes(savedVendor)) {
            return current
          }
          return [...current, savedVendor].sort((a, b) => a.localeCompare(b))
        })
      }

      if (activePage === 'dashboard') {
        void refreshSummary(period)
      }
      if (activePage === 'book') {
        void loadBook(bookGranularity, bookOffset, bookWeekStartDay)
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save entry.')
    } finally {
      setBookSaving(false)
    }
  }

  const handleBookDelete = async (transaction: Transaction) => {
    if (!window.confirm('Delete this entry? Account balances will be updated.')) {
      return
    }

    setBookSaving(true)

    try {
      const state = await deleteTransaction(transaction.id)
      applyMoneyState(state)
      setNotice('')
      closeBookModal(true)

      if (activePage === 'dashboard') {
        void refreshSummary(period)
      }
      if (activePage === 'book') {
        void loadBook(bookGranularity, bookOffset, bookWeekStartDay)
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not delete entry.')
    } finally {
      setBookSaving(false)
    }
  }

  const handleWeekStartDayChange = (day: WeekStartDay) => {
    setBookWeekStartDay(day)
    setWeekStartDay(day)
    setBookOffset(0)
  }

  const exportData = () => {
    const blob = new Blob([JSON.stringify(moneyState, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `block-n201-jam3eyye-track-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const hasAccounts = moneyState.accounts.length > 0
  const hasCategories = moneyState.categories.length > 0
  const totalBalance = moneyState.accounts.reduce((sum, account) => sum + account.balance, 0)

  const accountName = (id?: string) => moneyState.accounts.find((a) => a.id === id)?.name ?? '—'
  const categoryName = (id?: string) =>
    moneyState.categories.find((c) => c.id === id)?.name ?? '—'

  const describeTransaction = (transaction: Transaction) => {
    const place = transaction.vendor ? `${transaction.vendor} · ` : ''

    if (transaction.type === 'expense') {
      return `${place}${categoryName(transaction.categoryId)} from ${accountName(transaction.accountId)}`
    }

    if (transaction.type === 'income') {
      const cat = transaction.categoryId ? categoryName(transaction.categoryId) : 'Income'
      return `${place}${cat} to ${accountName(transaction.accountId)}`
    }

    if (transaction.type === 'transfer') {
      return `${accountName(transaction.fromAccountId)} → ${accountName(transaction.toAccountId)}`
    }

    return transaction.note || 'Account change'
  }

  const filteredTransactions = useMemo(() => {
    const query = logSearch.trim().toLowerCase()
    const accounts = moneyState.accounts
    const categories = moneyState.categories

    const nameForAccount = (id?: string) => accounts.find((a) => a.id === id)?.name ?? '—'
    const nameForCategory = (id?: string) => categories.find((c) => c.id === id)?.name ?? '—'

    const labelFor = (transaction: Transaction) => {
      const place = transaction.vendor ? `${transaction.vendor} · ` : ''

      if (transaction.type === 'expense') {
        return `${place}${nameForCategory(transaction.categoryId)} from ${nameForAccount(transaction.accountId)}`
      }

      if (transaction.type === 'income') {
        const cat = transaction.categoryId ? nameForCategory(transaction.categoryId) : 'Income'
        return `${place}${cat} to ${nameForAccount(transaction.accountId)}`
      }

      if (transaction.type === 'transfer') {
        return `${nameForAccount(transaction.fromAccountId)} → ${nameForAccount(transaction.toAccountId)}`
      }

      return transaction.note || 'Account change'
    }

    return moneyState.transactions.filter((transaction) => {
      if (logType !== 'all' && transaction.type !== logType) {
        return false
      }

      if (logCategory !== 'all' && transaction.categoryId !== logCategory) {
        return false
      }

      if (!query) {
        return true
      }

      const haystack = `${labelFor(transaction)} ${transaction.note} ${transaction.type}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [logSearch, logType, logCategory, moneyState.transactions, moneyState.accounts, moneyState.categories])

  const transactionsTable = (rows: Transaction[]) => {
    if (rows.length === 0) {
      return <Text c="dimmed">No transactions yet.</Text>
    }

    return (
      <Table.ScrollContainer minWidth={500}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Date</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Description</Table.Th>
              <Table.Th ta="right">Amount</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((transaction) => (
              <Table.Tr key={transaction.id}>
                <Table.Td>{new Date(transaction.date).toLocaleDateString()}</Table.Td>
                <Table.Td>
                  <Badge size="sm" variant="light" color={typeColor(transaction.type)}>
                    {transaction.type}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{describeTransaction(transaction)}</Text>
                  {transaction.note && (
                    <Text size="xs" c="dimmed">
                      {transaction.note}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td ta="right">
                  <Text
                    fw={600}
                    c={
                      transaction.type === 'expense'
                        ? 'red'
                        : transaction.type === 'income'
                          ? 'teal'
                          : undefined
                    }
                  >
                    {transaction.type === 'expense' ? '−' : transaction.type === 'income' ? '+' : ''}
                    {formatMoney(transaction.amount)}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    )
  }

  const emptySetup = (
    <Alert variant="light" icon={<IconInfoCircle size={18} />}>
      <Stack gap="xs">
        <Text fw={600}>Get started</Text>
        <Text size="sm">
          Create an account, add categories, then log your first expense to see spending charts.
        </Text>
        <Group>
          <Button size="xs" onClick={() => showPage('accounts')}>
            Add account
          </Button>
          <Button size="xs" variant="light" onClick={() => showPage('categories')}>
            Add categories
          </Button>
        </Group>
      </Stack>
    </Alert>
  )

  const accountsTable = (
    <Table.ScrollContainer minWidth={400}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Account</Table.Th>
            <Table.Th ta="right">Balance</Table.Th>
            <Table.Th w={50} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {moneyState.accounts.map((account) => (
            <Table.Tr key={account.id}>
              <Table.Td>{account.name}</Table.Td>
              <Table.Td ta="right">
                <Text c={account.balance < 0 ? 'red' : undefined} fw={account.balance < 0 ? 600 : undefined}>
                  {formatMoney(account.balance)}
                </Text>
              </Table.Td>
              <Table.Td>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  aria-label={`Delete ${account.name}`}
                  onClick={() => handleDeleteAccount(account.id)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )

  const categoriesTable = (
    <Table.ScrollContainer minWidth={400}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Category</Table.Th>
            <Table.Th>Color</Table.Th>
            <Table.Th w={50} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {moneyState.categories.map((category) => (
            <Table.Tr key={category.id}>
              <Table.Td>{category.name}</Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      backgroundColor: category.color,
                      display: 'inline-block',
                    }}
                  />
                  <Text size="xs" c="dimmed">
                    {category.color}
                  </Text>
                </Group>
              </Table.Td>
              <Table.Td>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  aria-label={`Delete ${category.name}`}
                  onClick={() => handleDeleteCategory(category.id)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )

  const addAccountForm = (
    <Card withBorder radius="md">
      <Title order={4} mb="md">
        New account
      </Title>
      <form onSubmit={handleAddAccount}>
        <Stack gap="md">
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <TextInput
                label="Name"
                required
                value={newAccount.name}
                onChange={(event) => {
                  const name = inputValue(event)
                  setNewAccount((c) => ({ ...c, name }))
                }}
                placeholder="Checking, Cash..."
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <TextInput
                label="Starting balance"
                inputMode="decimal"
                value={newAccount.balance}
                onChange={(event) => {
                  const balance = inputValue(event)
                  setNewAccount((c) => ({ ...c, balance }))
                }}
                placeholder="0.00"
                description="Optional. Leave blank for $0.00."
              />
            </Grid.Col>
          </Grid>
          <Button type="submit" w={{ base: '100%', sm: 'auto' }}>
            Create account
          </Button>
        </Stack>
      </form>
    </Card>
  )

  const addCategoryForm = (
    <Card withBorder radius="md">
      <Title order={4} mb="md">
        New category
      </Title>
      <form onSubmit={handleAddCategory}>
        <Stack gap="md">
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <TextInput
                label="Name"
                required
                value={newCategory.name}
                onChange={(event) => {
                  const name = inputValue(event)
                  setNewCategory((c) => ({ ...c, name }))
                }}
                placeholder="Groceries, Rent..."
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <ColorInput
                label="Chart color"
                value={newCategory.color}
                onChange={(value) =>
                  setNewCategory((c) => ({
                    ...c,
                    color: stringFromInput(value, DEFAULT_CATEGORY_COLOR),
                  }))
                }
              />
            </Grid.Col>
          </Grid>
          <Button type="submit" w={{ base: '100%', sm: 'auto' }}>
            Create category
          </Button>
        </Stack>
      </form>
    </Card>
  )

  const transactionCard = (
    <Card withBorder radius="md">
      <Title order={3} mb="md">
        {transactionForm.type === 'expense'
          ? 'Record expense'
          : transactionForm.type === 'income'
            ? 'Record income'
            : 'Transfer funds'}
      </Title>
      {!hasAccounts ? (
        emptySetup
      ) : transactionForm.type === 'expense' && !hasCategories ? (
        <Stack gap="sm">
          <Text c="dimmed">Add at least one category before logging expenses.</Text>
          <Button size="xs" onClick={() => showPage('categories')}>
            Go to categories
          </Button>
        </Stack>
      ) : (
        <TransactionForm
          form={transactionForm}
          accounts={moneyState.accounts}
          categories={moneyState.categories}
          vendorSuggestions={vendorSuggestions}
          onChange={(patch) => setTransactionForm((current) => ({ ...current, ...patch }))}
          onSubmit={handleTransactionSubmit}
        />
      )}
    </Card>
  )

  const renderPage = () => {
    if (isLoading) {
      return (
        <Card withBorder radius="md">
          <Text c="dimmed">Loading...</Text>
        </Card>
      )
    }

    if (activePage === 'dashboard') {
      return (
        <Stack gap="md">
          {!hasAccounts && emptySetup}
          <Dashboard
            summary={summary}
            accounts={moneyState.accounts}
            totalBalance={totalBalance}
            period={period}
            onPeriodChange={setPeriod}
            loading={summaryLoading}
          />
          {hasAccounts && (
            <Card withBorder radius="md">
              <Group justify="space-between" mb="md">
                <Title order={3}>Recent activity</Title>
                <Button variant="subtle" onClick={() => showPage('log')}>
                  View all
                </Button>
              </Group>
              {transactionsTable(moneyState.transactions.slice(0, 5))}
            </Card>
          )}
        </Stack>
      )
    }

    if (activePage === 'book') {
      return (
        <>
          <Book
            book={bookView}
            offset={bookOffset}
            loading={bookLoading}
            granularity={bookGranularity}
            weekStartDay={bookWeekStartDay}
            onGranularityChange={(granularity) => {
              setBookGranularity(granularity)
              setBookOffset(0)
            }}
            onWeekStartDayChange={handleWeekStartDayChange}
            onPrevious={() => setBookOffset((current) => current - 1)}
            onNext={() => setBookOffset((current) => current + 1)}
            onToday={() => setBookOffset(0)}
            accounts={moneyState.accounts}
            categories={moneyState.categories}
            canManageEntries={hasAccounts}
            onAddEntry={openBookCreate}
            onEditEntry={openBookEdit}
            onDeleteEntry={handleBookDelete}
          />
          <BookTransactionModal
            opened={bookModalOpen}
            mode={bookModalMode}
            transaction={bookModalTransaction}
            defaultDate={bookModalDate}
            accounts={moneyState.accounts}
            categories={moneyState.categories}
            vendorSuggestions={vendorSuggestions}
            saving={bookSaving}
            onClose={closeBookModal}
            onSave={handleBookSave}
            onDelete={
              bookModalMode === 'edit' && bookModalTransaction
                ? () => handleBookDelete(bookModalTransaction)
                : undefined
            }
          />
        </>
      )
    }

    if (activePage === 'add') {
      return (
        <Stack gap="md">
          {transactionCard}
          {hasAccounts && (
            <Card withBorder radius="md">
              <Title order={3} mb="md">
                Recent transactions
              </Title>
              {transactionsTable(moneyState.transactions.slice(0, 5))}
            </Card>
          )}
        </Stack>
      )
    }

    if (activePage === 'accounts') {
      return (
        <Stack gap="md">
          <Card withBorder radius="md">
            <Group justify="space-between" mb="md">
              <Title order={3}>Accounts</Title>
              <Badge>{moneyState.accounts.length} total</Badge>
            </Group>
            {moneyState.accounts.length === 0 ? (
              <Text c="dimmed">No accounts yet.</Text>
            ) : (
              accountsTable
            )}
          </Card>
          {addAccountForm}
        </Stack>
      )
    }

    if (activePage === 'categories') {
      return (
        <Stack gap="md">
          <Card withBorder radius="md">
            <Group justify="space-between" mb="md">
              <Title order={3}>Categories</Title>
              <Badge>{moneyState.categories.length} total</Badge>
            </Group>
            {moneyState.categories.length === 0 ? (
              <Text c="dimmed">No categories yet. Expenses require a category.</Text>
            ) : (
              categoriesTable
            )}
          </Card>
          {addCategoryForm}
        </Stack>
      )
    }

    return (
      <Card withBorder radius="md">
        <Group justify="space-between" mb="md">
          <Title order={3}>Activity log</Title>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconDownload size={16} />}
            onClick={exportData}
          >
            Export JSON
          </Button>
        </Group>
        <Grid className="compact-grid" mb="md">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <TextInput
              size="xs"
              placeholder="Search note or description..."
              value={logSearch}
              onChange={(event) => setLogSearch(inputValue(event))}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Select
              size="xs"
              value={logType}
              onChange={(value) => setLogType(value ?? 'all')}
              data={[
                { value: 'all', label: 'All types' },
                { value: 'expense', label: 'Expense' },
                { value: 'income', label: 'Income' },
                { value: 'transfer', label: 'Transfer' },
                { value: 'account', label: 'Account' },
              ]}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Select
              size="xs"
              value={logCategory}
              onChange={(value) => setLogCategory(value ?? 'all')}
              data={[
                { value: 'all', label: 'All categories' },
                ...moneyState.categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </Grid.Col>
        </Grid>
        {transactionsTable(filteredTransactions)}
      </Card>
    )
  }

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{
        width: 260,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding={0}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <ThemeIcon size="lg" radius="md">
              <IconWallet size={22} />
            </ThemeIcon>
            <div>
              <Text fw={800} lh={1}>
                Block N201 jam3eyye track
              </Text>
              <Text size="xs" c="dimmed" visibleFrom="xs">
                jam3eyye · accounts & spending
              </Text>
            </div>
          </Group>
          <Button
            size="xs"
            leftSection={<IconPlus size={16} />}
            disabled={!hasAccounts}
            onClick={() => startTransaction('expense')}
          >
            New
          </Button>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section grow component={ScrollArea}>
          <Stack gap={4}>
            {pages.map((page) => {
              const Icon = page.icon

              return (
                <Button
                  key={page.id}
                  variant={activePage === page.id ? 'light' : 'subtle'}
                  color={activePage === page.id ? 'blue' : 'gray'}
                  justify="flex-start"
                  leftSection={<Icon size={18} />}
                  onClick={() => showPage(page.id)}
                >
                  {page.label}
                </Button>
              )
            })}
          </Stack>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Container fluid px={{ base: 'xs', sm: 'md' }} py="md">
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <Title order={1}>{pageTitles[activePage]}</Title>
              <Group gap="xs">
                <Button
                  variant="light"
                  color="red"
                  disabled={!hasAccounts || !hasCategories}
                  leftSection={<IconArrowUpRight size={18} />}
                  onClick={() => startTransaction('expense')}
                >
                  Expense
                </Button>
                <Button
                  variant="light"
                  color="teal"
                  disabled={!hasAccounts}
                  leftSection={<IconArrowDownLeft size={18} />}
                  onClick={() => startTransaction('income')}
                >
                  Income
                </Button>
                <Button
                  variant="light"
                  disabled={moneyState.accounts.length < 2}
                  leftSection={<IconArrowRight size={18} />}
                  onClick={() => startTransaction('transfer')}
                >
                  Transfer
                </Button>
              </Group>
            </Group>

            {notice && (
              <Alert variant="light" color="red" icon={<IconInfoCircle size={18} />}>
                {notice}
              </Alert>
            )}

            {renderPage()}
          </Stack>
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}

function typeColor(type: Transaction['type']) {
  if (type === 'expense') return 'red'
  if (type === 'income') return 'teal'
  if (type === 'transfer') return 'blue'
  return 'gray'
}

export default App
