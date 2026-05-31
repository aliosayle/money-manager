import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  ActionIcon,
  Alert,
  AppShell,
  Badge,
  Burger,
  Button,
  Card,
  Container,
  Grid,
  Group,
  NumberInput,
  Paper,
  Progress,
  ScrollArea,
  SegmentedControl,
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
  IconChartPie,
  IconCreditCard,
  IconHistory,
  IconHome,
  IconInfoCircle,
  IconPlus,
  IconTransfer,
  IconWallet,
} from '@tabler/icons-react'
import './App.css'

type Account = {
  id: string
  name: string
  balance: number
}

type Bucket = {
  id: string
  name: string
  balance: number
}

type TransactionType = 'deposit' | 'withdraw' | 'transfer' | 'allocate' | 'account'
type Page = 'overview' | 'move' | 'accounts' | 'budget' | 'log'

type Transaction = {
  id: string
  type: TransactionType
  amount: number
  date: string
  note: string
  accountId?: string
  fromAccountId?: string
  toAccountId?: string
  bucketId?: string
}

type MoneyState = {
  accounts: Account[]
  buckets: Bucket[]
  transactions: Transaction[]
}

type TransactionForm = {
  type: 'deposit' | 'withdraw' | 'transfer'
  amount: string
  accountId: string
  fromAccountId: string
  toAccountId: string
  bucketId: string
  note: string
}

const pages = [
  { id: 'overview', label: 'Overview', icon: IconHome },
  { id: 'move', label: 'Move money', icon: IconTransfer },
  { id: 'accounts', label: 'Accounts', icon: IconCreditCard },
  { id: 'budget', label: 'Budget', icon: IconChartPie },
  { id: 'log', label: 'Activity log', icon: IconHistory },
] as const

const pageTitles: Record<Page, string> = {
  overview: 'Overview',
  move: 'Move money',
  accounts: 'Accounts',
  budget: 'Budget',
  log: 'Activity log',
}

const emptyState: MoneyState = {
  accounts: [],
  buckets: [],
  transactions: [],
}

const blankTransactionForm: TransactionForm = {
  type: 'deposit',
  amount: '',
  accountId: '',
  fromAccountId: '',
  toAccountId: '',
  bucketId: '',
  note: '',
}

const formatMoney = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)

const parseAmount = (value: string) => {
  const amount = Number(value)

  if (!Number.isFinite(amount) || amount <= 0) {
    return null
  }

  return Math.round(amount * 100) / 100
}

const apiRequest = async <T,>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'Request failed.')
  }

  return response.json() as Promise<T>
}

function App() {
  const [opened, { toggle, close }] = useDisclosure()
  const [activePage, setActivePage] = useState<Page>('overview')
  const [moneyState, setMoneyState] = useState<MoneyState>(emptyState)
  const [isLoading, setIsLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [transactionForm, setTransactionForm] = useState<TransactionForm>({
    ...blankTransactionForm,
  })
  const [newAccount, setNewAccount] = useState({ name: '', balance: '' })
  const [newBucket, setNewBucket] = useState({ name: '', balance: '' })
  const [allocation, setAllocation] = useState({
    bucketId: '',
    amount: '',
    direction: 'assign' as 'assign' | 'release',
    note: '',
  })

  const applyMoneyState = useCallback((state: MoneyState) => {
    setMoneyState(state)
    setTransactionForm((current) => {
      const firstAccount = state.accounts[0]?.id ?? ''
      const secondAccount = state.accounts[1]?.id ?? firstAccount
      const firstBucket = state.buckets[0]?.id ?? ''

      return {
        ...current,
        accountId: state.accounts.some((account) => account.id === current.accountId)
          ? current.accountId
          : firstAccount,
        fromAccountId: state.accounts.some((account) => account.id === current.fromAccountId)
          ? current.fromAccountId
          : firstAccount,
        toAccountId: state.accounts.some((account) => account.id === current.toAccountId)
          ? current.toAccountId
          : secondAccount,
        bucketId: current.bucketId === '' || state.buckets.some((bucket) => bucket.id === current.bucketId)
          ? current.bucketId
          : firstBucket,
      }
    })

    setAllocation((current) => ({
      ...current,
      bucketId: state.buckets.some((bucket) => bucket.id === current.bucketId)
        ? current.bucketId
        : (state.buckets[0]?.id ?? ''),
    }))
  }, [])

  useEffect(() => {
    let isActive = true

    apiRequest<MoneyState>('/api/state')
      .then((state) => {
        if (isActive) {
          applyMoneyState(state)
        }
      })
      .catch((error: Error) => {
        if (isActive) {
          setNotice(error.message)
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [applyMoneyState])

  const totalCash = moneyState.accounts.reduce((sum, account) => sum + account.balance, 0)
  const totalBuckets = moneyState.buckets.reduce((sum, bucket) => sum + bucket.balance, 0)
  const leftToAssign = Math.round((totalCash - totalBuckets) * 100) / 100
  const assignedPercent = totalCash > 0 ? Math.min((totalBuckets / totalCash) * 100, 100) : 0

  const accountOptions = moneyState.accounts.map((account) => ({
    value: account.id,
    label: account.name,
  }))
  const bucketOptions = moneyState.buckets.map((bucket) => ({
    value: bucket.id,
    label: bucket.name,
  }))

  const saveState = async (path: string, body: unknown) => {
    try {
      const nextState = await apiRequest<MoneyState>(path, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      applyMoneyState(nextState)
      setNotice('')
      return nextState
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Request failed.')
      return null
    }
  }

  const updateTransactionField = (field: keyof TransactionForm, value: string | null) => {
    setTransactionForm((current) => ({
      ...current,
      [field]: value ?? '',
    }))
  }

  const showPage = (page: Page) => {
    setActivePage(page)
    close()
  }

  const startTransaction = (type: TransactionForm['type'], accountId?: string) => {
    setTransactionForm((current) => ({
      ...current,
      type,
      accountId: accountId ?? current.accountId,
      fromAccountId: accountId ?? current.fromAccountId,
    }))
    showPage('move')
  }

  const handleAddAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const name = newAccount.name.trim()
    const balance = newAccount.balance ? parseAmount(newAccount.balance) : 0

    if (!name) {
      setNotice('Give the account a name first.')
      return
    }

    if (balance === null) {
      setNotice('Starting balance must be zero or a positive amount.')
      return
    }

    const nextState = await saveState('/api/accounts', { name, balance })

    if (nextState) {
      setNewAccount({ name: '', balance: '' })
    }
  }

  const handleAddBucket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const name = newBucket.name.trim()
    const balance = newBucket.balance ? parseAmount(newBucket.balance) : 0

    if (!name) {
      setNotice('Give the bucket a name first.')
      return
    }

    if (balance === null) {
      setNotice('Bucket starting balance must be zero or a positive amount.')
      return
    }

    if (balance > leftToAssign) {
      setNotice(`You only have ${formatMoney(leftToAssign)} left to assign.`)
      return
    }

    const nextState = await saveState('/api/buckets', { name, balance })

    if (nextState) {
      setNewBucket({ name: '', balance: '' })
    }
  }

  const handleTransaction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const amount = parseAmount(transactionForm.amount)

    if (!amount) {
      setNotice('Enter an amount greater than zero.')
      return
    }

    if (transactionForm.type === 'deposit') {
      const account = moneyState.accounts.find(({ id }) => id === transactionForm.accountId)

      if (!account) {
        setNotice('Choose an account for the deposit.')
        return
      }

      const nextState = await saveState('/api/transactions', {
        type: 'deposit',
        amount,
        accountId: account.id,
        note: transactionForm.note,
      })

      if (nextState) {
        setTransactionForm((current) => ({ ...current, amount: '', note: '' }))
      }
      return
    }

    if (transactionForm.type === 'withdraw') {
      const account = moneyState.accounts.find(({ id }) => id === transactionForm.accountId)
      const bucket = moneyState.buckets.find(({ id }) => id === transactionForm.bucketId)

      if (!account) {
        setNotice('Choose an account for the withdrawal.')
        return
      }

      if (account.balance < amount) {
        setNotice(`${account.name} only has ${formatMoney(account.balance)} available.`)
        return
      }

      if (bucket && bucket.balance < amount) {
        setNotice(`${bucket.name} only has ${formatMoney(bucket.balance)} assigned.`)
        return
      }

      const nextState = await saveState('/api/transactions', {
        type: 'withdraw',
        amount,
        accountId: account.id,
        bucketId: bucket?.id,
        note: transactionForm.note,
      })

      if (nextState) {
        setTransactionForm((current) => ({ ...current, amount: '', note: '' }))
      }
      return
    }

    const fromAccount = moneyState.accounts.find(({ id }) => id === transactionForm.fromAccountId)
    const toAccount = moneyState.accounts.find(({ id }) => id === transactionForm.toAccountId)

    if (!fromAccount || !toAccount) {
      setNotice('Choose both transfer accounts.')
      return
    }

    if (fromAccount.id === toAccount.id) {
      setNotice('Transfer accounts must be different.')
      return
    }

    if (fromAccount.balance < amount) {
      setNotice(`${fromAccount.name} only has ${formatMoney(fromAccount.balance)} available.`)
      return
    }

    const nextState = await saveState('/api/transactions', {
      type: 'transfer',
      amount,
      fromAccountId: fromAccount.id,
      toAccountId: toAccount.id,
      note: transactionForm.note,
    })

    if (nextState) {
      setTransactionForm((current) => ({ ...current, amount: '', note: '' }))
    }
  }

  const handleAllocation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const amount = parseAmount(allocation.amount)
    const bucket = moneyState.buckets.find(({ id }) => id === allocation.bucketId)

    if (!amount) {
      setNotice('Enter an allocation amount greater than zero.')
      return
    }

    if (!bucket) {
      setNotice('Choose a bucket to adjust.')
      return
    }

    if (allocation.direction === 'assign' && amount > leftToAssign) {
      setNotice(`You only have ${formatMoney(leftToAssign)} left to assign.`)
      return
    }

    if (allocation.direction === 'release' && amount > bucket.balance) {
      setNotice(`${bucket.name} only has ${formatMoney(bucket.balance)} assigned.`)
      return
    }

    const nextState = await saveState('/api/allocations', {
      amount,
      bucketId: bucket.id,
      direction: allocation.direction,
      note: allocation.note,
    })

    if (nextState) {
      setAllocation((current) => ({ ...current, amount: '', note: '' }))
    }
  }

  const getAccountName = (id?: string) =>
    moneyState.accounts.find((account) => account.id === id)?.name ?? 'Unassigned account'

  const getBucketName = (id?: string) =>
    moneyState.buckets.find((bucket) => bucket.id === id)?.name ?? 'No bucket'

  const describeTransaction = (transaction: Transaction) => {
    if (transaction.type === 'deposit') {
      return `Deposit to ${getAccountName(transaction.accountId)}`
    }

    if (transaction.type === 'withdraw') {
      return `Withdrawal from ${getAccountName(transaction.accountId)}`
    }

    if (transaction.type === 'transfer') {
      return `${getAccountName(transaction.fromAccountId)} to ${getAccountName(
        transaction.toAccountId,
      )}`
    }

    if (transaction.type === 'allocate') {
      return `Budget change for ${getBucketName(transaction.bucketId)}`
    }

    return 'Account update'
  }

  const transactionBadge = (type: TransactionType) => {
    const colors: Record<TransactionType, string> = {
      deposit: 'green',
      withdraw: 'red',
      transfer: 'blue',
      allocate: 'violet',
      account: 'gray',
    }

    return <Badge color={colors[type]}>{type}</Badge>
  }

  const summaryCards = (
    <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
      <Paper withBorder p="md" radius="md">
        <Text size="sm" c="dimmed">
          Total cash
        </Text>
        <Title order={2}>{formatMoney(totalCash)}</Title>
      </Paper>
      <Paper withBorder p="md" radius="md">
        <Text size="sm" c="dimmed">
          Assigned
        </Text>
        <Title order={2}>{formatMoney(totalBuckets)}</Title>
      </Paper>
      <Paper withBorder p="md" radius="md">
        <Text size="sm" c="dimmed">
          To assign
        </Text>
        <Title order={2} c={leftToAssign < 0 ? 'red' : undefined}>
          {formatMoney(leftToAssign)}
        </Title>
      </Paper>
      <Paper withBorder p="md" radius="md">
        <Text size="sm" c="dimmed">
          Log entries
        </Text>
        <Title order={2}>{moneyState.transactions.length}</Title>
      </Paper>
    </SimpleGrid>
  )

  const accountsTable = (
    <Table.ScrollContainer minWidth={520}>
      <Table verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Account</Table.Th>
            <Table.Th ta="right">Balance</Table.Th>
            <Table.Th ta="right">Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {moneyState.accounts.map((account) => (
            <Table.Tr key={account.id}>
              <Table.Td>
                <Group gap="sm">
                  <ThemeIcon variant="light" radius="xl">
                    <IconWallet size={18} />
                  </ThemeIcon>
                  <Text fw={600}>{account.name}</Text>
                </Group>
              </Table.Td>
              <Table.Td ta="right">
                <Text fw={700}>{formatMoney(account.balance)}</Text>
              </Table.Td>
              <Table.Td>
                <Group justify="flex-end" gap="xs">
                  <ActionIcon
                    variant="light"
                    aria-label={`Deposit to ${account.name}`}
                    onClick={() => startTransaction('deposit', account.id)}
                  >
                    <IconArrowDownLeft size={18} />
                  </ActionIcon>
                  <ActionIcon
                    variant="light"
                    color="red"
                    aria-label={`Withdraw from ${account.name}`}
                    onClick={() => startTransaction('withdraw', account.id)}
                  >
                    <IconArrowUpRight size={18} />
                  </ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )

  const bucketsTable = (
    <Stack gap="sm">
      {moneyState.buckets.map((bucket) => {
        const percent = totalCash > 0 ? Math.min((bucket.balance / totalCash) * 100, 100) : 0

        return (
          <Paper withBorder p="md" radius="md" key={bucket.id}>
            <Group justify="space-between" mb={6}>
              <Text fw={700}>{bucket.name}</Text>
              <Text fw={700}>{formatMoney(bucket.balance)}</Text>
            </Group>
            <Progress value={percent} size="sm" radius="xl" />
          </Paper>
        )
      })}
    </Stack>
  )

  const transactionsTable = (transactions: Transaction[]) => (
    <Table.ScrollContainer minWidth={720}>
      <Table verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Type</Table.Th>
            <Table.Th>Description</Table.Th>
            <Table.Th>Note</Table.Th>
            <Table.Th>Date</Table.Th>
            <Table.Th ta="right">Amount</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {transactions.map((transaction) => (
            <Table.Tr key={transaction.id}>
              <Table.Td>{transactionBadge(transaction.type)}</Table.Td>
              <Table.Td>{describeTransaction(transaction)}</Table.Td>
              <Table.Td>
                <Text lineClamp={1}>{transaction.note}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed">
                  {new Intl.DateTimeFormat('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(transaction.date))}
                </Text>
              </Table.Td>
              <Table.Td ta="right">
                <Text fw={700}>{formatMoney(transaction.amount)}</Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )

  const transactionCard = (
    <Card withBorder radius="md" shadow="sm" p="sm">
      <form onSubmit={handleTransaction}>
        <Stack gap="sm">
          <SegmentedControl
            fullWidth
            size="xs"
            value={transactionForm.type}
            onChange={(value) => updateTransactionField('type', value)}
            data={[
              { label: 'Deposit', value: 'deposit' },
              { label: 'Withdraw', value: 'withdraw' },
              { label: 'Transfer', value: 'transfer' },
            ]}
          />

          <Grid className="compact-grid">
            <Grid.Col span={{ base: 12, md: 4 }}>
              <NumberInput
                hideControls
                label="Amount"
                min={0.01}
                decimalScale={2}
                fixedDecimalScale
                size="xs"
                value={transactionForm.amount}
                onChange={(value) => updateTransactionField('amount', value.toString())}
                placeholder="0.00"
              />
            </Grid.Col>

            {transactionForm.type === 'transfer' ? (
              <>
                <Grid.Col span={{ base: 12, md: 4 }}>
                  <Select
                    label="From"
                    data={accountOptions}
                    size="xs"
                    value={transactionForm.fromAccountId}
                    onChange={(value) => updateTransactionField('fromAccountId', value)}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 4 }}>
                  <Select
                    label="To"
                    data={accountOptions}
                    size="xs"
                    value={transactionForm.toAccountId}
                    onChange={(value) => updateTransactionField('toAccountId', value)}
                  />
                </Grid.Col>
              </>
            ) : (
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Select
                  label="Account"
                  data={accountOptions}
                  size="xs"
                  value={transactionForm.accountId}
                  onChange={(value) => updateTransactionField('accountId', value)}
                />
              </Grid.Col>
            )}

            {transactionForm.type === 'withdraw' && (
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Select
                  clearable
                  label="Budget bucket"
                  data={bucketOptions}
                  size="xs"
                  value={transactionForm.bucketId}
                  onChange={(value) => updateTransactionField('bucketId', value)}
                />
              </Grid.Col>
            )}

            <Grid.Col span={{ base: 12, md: transactionForm.type === 'transfer' ? 12 : 8 }}>
              <TextInput
                label="Note"
                size="xs"
                value={transactionForm.note}
                onChange={(event) => updateTransactionField('note', event.currentTarget.value)}
                placeholder="Paycheck, rent, groceries..."
              />
            </Grid.Col>
          </Grid>

          <Group justify="flex-end">
            <Button size="xs" type="submit" leftSection={<IconPlus size={16} />}>
              Save transaction
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  )

  const addAccountForm = (
    <Card withBorder radius="md" p="sm">
      <form onSubmit={handleAddAccount}>
        <Stack gap="sm">
          <Title order={4}>Add account</Title>
          <TextInput
            label="Name"
            size="xs"
            value={newAccount.name}
            onChange={(event) => setNewAccount((current) => ({ ...current, name: event.currentTarget.value }))}
            placeholder="Savings, cash, checking..."
          />
          <NumberInput
            hideControls
            label="Starting balance"
            min={0}
            decimalScale={2}
            fixedDecimalScale
            size="xs"
            value={newAccount.balance}
            onChange={(value) => setNewAccount((current) => ({ ...current, balance: value.toString() }))}
            placeholder="0.00"
          />
          <Button size="xs" type="submit">Add account</Button>
        </Stack>
      </form>
    </Card>
  )

  const budgetForms = (
    <Grid className="compact-grid">
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Card withBorder radius="md" p="sm">
          <form onSubmit={handleAddBucket}>
            <Stack gap="sm">
              <Title order={4}>Add bucket</Title>
              <TextInput
                label="Name"
                size="xs"
                value={newBucket.name}
                onChange={(event) => setNewBucket((current) => ({ ...current, name: event.currentTarget.value }))}
                placeholder="Bills, groceries, savings..."
              />
              <NumberInput
                hideControls
                label="Starting allocation"
                min={0}
                decimalScale={2}
                fixedDecimalScale
                size="xs"
                value={newBucket.balance}
                onChange={(value) => setNewBucket((current) => ({ ...current, balance: value.toString() }))}
                placeholder="0.00"
              />
              <Button size="xs" type="submit">Add bucket</Button>
            </Stack>
          </form>
        </Card>
      </Grid.Col>

      <Grid.Col span={{ base: 12, md: 6 }}>
        <Card withBorder radius="md" p="sm">
          <form onSubmit={handleAllocation}>
            <Stack gap="sm">
              <Title order={4}>Adjust budget</Title>
              <Select
                label="Bucket"
                data={bucketOptions}
                size="xs"
                value={allocation.bucketId}
                onChange={(value) => setAllocation((current) => ({ ...current, bucketId: value ?? '' }))}
              />
              <SegmentedControl
                size="xs"
                value={allocation.direction}
                onChange={(value) =>
                  setAllocation((current) => ({ ...current, direction: value as 'assign' | 'release' }))
                }
                data={[
                  { label: 'Assign', value: 'assign' },
                  { label: 'Release', value: 'release' },
                ]}
              />
              <NumberInput
                hideControls
                label="Amount"
                min={0.01}
                decimalScale={2}
                fixedDecimalScale
                size="xs"
                value={allocation.amount}
                onChange={(value) => setAllocation((current) => ({ ...current, amount: value.toString() }))}
                placeholder="0.00"
              />
              <TextInput
                label="Note"
                size="xs"
                value={allocation.note}
                onChange={(event) => setAllocation((current) => ({ ...current, note: event.currentTarget.value }))}
                placeholder="Monthly budget, bill moved..."
              />
              <Button size="xs" type="submit">Update budget</Button>
            </Stack>
          </form>
        </Card>
      </Grid.Col>
    </Grid>
  )

  const renderPage = () => {
    if (isLoading) {
      return (
        <Card withBorder radius="md">
          <Text c="dimmed">Loading your money data...</Text>
        </Card>
      )
    }

    if (activePage === 'move') {
      return (
        <Stack>
          {transactionCard}
          <Card withBorder radius="md">
            <Title order={3} mb="md">
              Recent transactions
            </Title>
            {transactionsTable(moneyState.transactions.slice(0, 5))}
          </Card>
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
              {accountsTable}
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 4 }}>{addAccountForm}</Grid.Col>
        </Grid>
      )
    }

    if (activePage === 'budget') {
      return (
        <Stack>
          <Card withBorder radius="md">
            <Group justify="space-between" mb="xs">
              <div>
                <Text size="sm" c="dimmed">
                  Zero-based status
                </Text>
                <Title order={2} c={leftToAssign < 0 ? 'red' : undefined}>
                  {formatMoney(leftToAssign)} to assign
                </Title>
              </div>
              <Badge color={leftToAssign === 0 ? 'green' : 'blue'} variant="light">
                {Math.round(assignedPercent)}% assigned
              </Badge>
            </Group>
            <Progress value={assignedPercent} radius="xl" />
          </Card>
          <Grid>
            <Grid.Col span={{ base: 12, lg: 7 }}>
              <Card withBorder radius="md">
                <Title order={3} mb="md">
                  Buckets
                </Title>
                {bucketsTable}
              </Card>
            </Grid.Col>
            <Grid.Col span={{ base: 12, lg: 5 }}>{budgetForms}</Grid.Col>
          </Grid>
        </Stack>
      )
    }

    if (activePage === 'log') {
      return (
        <Card withBorder radius="md">
          <Title order={3} mb="md">
            Activity log
          </Title>
          {transactionsTable(moneyState.transactions)}
        </Card>
      )
    }

    return (
      <Stack>
        {summaryCards}
        <Card withBorder radius="md">
          <Group justify="space-between" mb="xs">
            <div>
              <Text size="sm" c="dimmed">
                Zero-based budget
              </Text>
              <Title order={2} c={leftToAssign < 0 ? 'red' : undefined}>
                {formatMoney(leftToAssign)} to assign
              </Title>
            </div>
            <Button variant="light" onClick={() => showPage('budget')}>
              Open budget
            </Button>
          </Group>
          <Progress value={assignedPercent} radius="xl" mt="md" />
        </Card>
        <Grid>
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <Card withBorder radius="md">
              <Group justify="space-between" mb="md">
                <Title order={3}>Accounts</Title>
                <Button variant="subtle" onClick={() => showPage('accounts')}>
                  Manage
                </Button>
              </Group>
              {accountsTable}
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <Card withBorder radius="md">
              <Group justify="space-between" mb="md">
                <Title order={3}>Recent activity</Title>
                <Button variant="subtle" onClick={() => showPage('log')}>
                  View all
                </Button>
              </Group>
              {transactionsTable(moneyState.transactions.slice(0, 5))}
            </Card>
          </Grid.Col>
        </Grid>
      </Stack>
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
                Money Manager
              </Text>
              <Text size="xs" c="dimmed" visibleFrom="xs">
                Zero-based personal finance
              </Text>
            </div>
          </Group>
          <Button
            size="xs"
            leftSection={<IconPlus size={16} />}
            onClick={() => startTransaction('deposit')}
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
              <div>
                <Title order={1}>{pageTitles[activePage]}</Title>
              </div>
              <Group gap="xs">
                <Button variant="light" leftSection={<IconArrowDownLeft size={18} />} onClick={() => startTransaction('deposit')}>
                  Deposit
                </Button>
                <Button variant="light" leftSection={<IconArrowUpRight size={18} />} onClick={() => startTransaction('withdraw')}>
                  Withdraw
                </Button>
                <Button variant="light" leftSection={<IconArrowRight size={18} />} onClick={() => startTransaction('transfer')}>
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

export default App
