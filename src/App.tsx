import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
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
  SimpleGrid,
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
import { deleteState, fetchState, fetchSummary, formatMoney, parseAmount, postState } from './api'
import { stringFromInput } from './formUtils'
import { Dashboard } from './components/Dashboard'
import { TransactionForm } from './components/TransactionForm'
import type {
  MoneyState,
  Page,
  Period,
  Summary,
  Transaction,
  TransactionForm as TransactionFormState,
} from './types'
import './App.css'

const pages = [
  { id: 'dashboard', label: 'Dashboard', icon: IconHome },
  { id: 'add', label: 'Add', icon: IconTransfer },
  { id: 'accounts', label: 'Accounts', icon: IconCreditCard },
  { id: 'categories', label: 'Categories', icon: IconCategory },
  { id: 'log', label: 'Activity log', icon: IconHistory },
] as const

const pageTitles: Record<Page, string> = {
  dashboard: 'Dashboard',
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

    return () => {
      cancelled = true
    }
  }, [applyMoneyState])

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
              note: transactionForm.note,
            }

      const state = await postState('/api/transactions', body)
      applyMoneyState(state)
      setTransactionForm(blankTransactionForm)
      setNotice('')
      if (activePage === 'dashboard') {
        void refreshSummary(period)
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

  const exportData = () => {
    const blob = new Blob([JSON.stringify(moneyState, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `money-manager-${new Date().toISOString().slice(0, 10)}.json`
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
    if (transaction.type === 'expense') {
      return `${categoryName(transaction.categoryId)} from ${accountName(transaction.accountId)}`
    }

    if (transaction.type === 'income') {
      const cat = transaction.categoryId ? categoryName(transaction.categoryId) : 'Income'
      return `${cat} to ${accountName(transaction.accountId)}`
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
      if (transaction.type === 'expense') {
        return `${nameForCategory(transaction.categoryId)} from ${nameForAccount(transaction.accountId)}`
      }

      if (transaction.type === 'income') {
        const cat = transaction.categoryId ? nameForCategory(transaction.categoryId) : 'Income'
        return `${cat} to ${nameForAccount(transaction.accountId)}`
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
              <Table.Td ta="right">{formatMoney(account.balance)}</Table.Td>
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
        <Stack gap="sm">
          <TextInput
            label="Name"
            required
            value={newAccount.name}
            onChange={(event) => setNewAccount((c) => ({ ...c, name: event.currentTarget.value }))}
            placeholder="Checking, Cash..."
          />
          <TextInput
            label="Starting balance"
            inputMode="decimal"
            value={newAccount.balance}
            onChange={(event) =>
              setNewAccount((c) => ({ ...c, balance: event.currentTarget.value }))
            }
            placeholder="0.00"
            description="Optional. Leave blank for $0.00."
          />
          <Button type="submit">Create account</Button>
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
        <Stack gap="sm">
          <TextInput
            label="Name"
            required
            value={newCategory.name}
            onChange={(event) => setNewCategory((c) => ({ ...c, name: event.currentTarget.value }))}
            placeholder="Groceries, Rent..."
          />
          <ColorInput
            label="Chart color"
            value={newCategory.color}
            onChange={(value) =>
              setNewCategory((c) => ({ ...c, color: stringFromInput(value, DEFAULT_CATEGORY_COLOR) }))
            }
          />
          <Button type="submit">Create category</Button>
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
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <PaperSummary label="Total balance" value={formatMoney(totalBalance)} />
            <PaperSummary
              label="Accounts"
              value={String(moneyState.accounts.length)}
              subtitle={`${moneyState.categories.length} categories`}
            />
          </SimpleGrid>
          <Dashboard
            summary={summary}
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

    if (activePage === 'add') {
      return (
        <Stack>
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
        <Grid>
          <Grid.Col span={{ base: 12, lg: 8 }}>
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
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 4 }}>
            {addAccountForm}
          </Grid.Col>
        </Grid>
      )
    }

    if (activePage === 'categories') {
      return (
        <Grid>
          <Grid.Col span={{ base: 12, lg: 7 }}>
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
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 5 }}>
            {addCategoryForm}
          </Grid.Col>
        </Grid>
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
              onChange={(event) => setLogSearch(event.currentTarget.value)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
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
          <Grid.Col span={{ base: 12, md: 3 }}>
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
                Expense Tracker
              </Text>
              <Text size="xs" c="dimmed" visibleFrom="xs">
                Accounts, categories, spending
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

function PaperSummary({
  label,
  value,
  subtitle,
}: {
  label: string
  value: string
  subtitle?: string
}) {
  return (
    <Card withBorder radius="md" p="md">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Title order={2}>{value}</Title>
      {subtitle && (
        <Text size="xs" c="dimmed" mt={4}>
          {subtitle}
        </Text>
      )}
    </Card>
  )
}

function typeColor(type: Transaction['type']) {
  if (type === 'expense') return 'red'
  if (type === 'income') return 'teal'
  if (type === 'transfer') return 'blue'
  return 'gray'
}

export default App
