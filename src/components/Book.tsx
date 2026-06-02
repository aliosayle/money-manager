import {
  ActionIcon,
  Badge,
  Box,
  Card,
  Group,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { formatMoney } from '../api'
import type { Account, BookGranularity, BookView, Category, Transaction } from '../types'
import './Book.css'

type BookProps = {
  book: BookView | null
  offset: number
  loading: boolean
  granularity: BookGranularity
  onGranularityChange: (granularity: BookGranularity) => void
  onPrevious: () => void
  onNext: () => void
  onToday: () => void
  accounts: Account[]
  categories: Category[]
}

export function Book({
  book,
  offset,
  loading,
  granularity,
  onGranularityChange,
  onPrevious,
  onNext,
  onToday,
  accounts,
  categories,
}: BookProps) {
  const accountName = (id?: string) => accounts.find((account) => account.id === id)?.name ?? '—'
  const categoryName = (id?: string) => categories.find((category) => category.id === id)?.name ?? '—'

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <SegmentedControl
          size="xs"
          value={granularity}
          onChange={(value) => {
            if (value) {
              onGranularityChange(value as BookGranularity)
            }
          }}
          data={[
            { label: 'Week', value: 'week' },
            { label: 'Month', value: 'month' },
          ]}
        />

        <Group gap={4} wrap="nowrap">
          <ActionIcon variant="light" size="lg" onClick={onPrevious} aria-label="Previous period">
            <IconChevronLeft size={20} />
          </ActionIcon>
          <ButtonToday
            onClick={onToday}
            active={offset === 0}
            label={offset === 0 ? 'Today' : book?.offset === offset ? book.title : '…'}
          />
          <ActionIcon variant="light" size="lg" onClick={onNext} aria-label="Next period">
            <IconChevronRight size={20} />
          </ActionIcon>
        </Group>
      </Group>

      {loading && (
        <Card withBorder radius="md" className="book-page">
          <Text c="dimmed">Turning the page...</Text>
        </Card>
      )}

      {!loading && book && book.offset === offset && (
        <>
          <Card withBorder radius="md" className="book-page book-cover" p="lg">
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <div>
                <Text size="sm" c="dimmed" tt="uppercase" fw={600} className="book-eyebrow">
                  Ledger
                </Text>
                <Title order={2} className="book-title">
                  {book.title}
                </Title>
              </div>
              <SimpleGrid cols={3} spacing="md" className="book-totals">
                <div>
                  <Text size="xs" c="dimmed">
                    Income
                  </Text>
                  <Text fw={700} c="teal">
                    {formatMoney(book.totals.income)}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">
                    Expenses
                  </Text>
                  <Text fw={700} c="red">
                    {formatMoney(book.totals.expenses)}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">
                    Net
                  </Text>
                  <Text fw={700} c={book.totals.net >= 0 ? 'teal' : 'red'}>
                    {formatMoney(book.totals.net)}
                  </Text>
                </div>
              </SimpleGrid>
            </Group>
          </Card>

          {book.byVendor.length > 0 && (
            <Card withBorder radius="md" className="book-page" p="md">
              <Title order={5} mb="sm">
                Spending by place
              </Title>
              <Stack gap={6}>
                {book.byVendor.map((row) => (
                  <Group key={row.vendor} justify="space-between" wrap="nowrap">
                    <Text size="sm" truncate style={{ flex: 1 }}>
                      {row.vendor}
                    </Text>
                    <Group gap="xs" wrap="nowrap">
                      <Text size="xs" c="dimmed">
                        {row.count}×
                      </Text>
                      <Text size="sm" fw={600}>
                        {formatMoney(row.amount)}
                      </Text>
                    </Group>
                  </Group>
                ))}
              </Stack>
            </Card>
          )}

          <Box className="book-spread">
            {book.days.map((day) => (
              <Card key={day.date} withBorder radius="md" className="book-page book-day" p="md">
                <Group justify="space-between" mb="sm" className="book-day-header">
                  <Text fw={700} className="book-day-label">
                    {day.label}
                  </Text>
                  {(day.income > 0 || day.expenses > 0) && (
                    <Group gap="xs">
                      {day.expenses > 0 && (
                        <Text size="xs" c="red" fw={600}>
                          −{formatMoney(day.expenses)}
                        </Text>
                      )}
                      {day.income > 0 && (
                        <Text size="xs" c="teal" fw={600}>
                          +{formatMoney(day.income)}
                        </Text>
                      )}
                    </Group>
                  )}
                </Group>

                {day.transactions.length === 0 ? (
                  <Text size="sm" c="dimmed" className="book-empty-line">
                    —
                  </Text>
                ) : (
                  <Stack gap={0} className="book-entries">
                    {day.transactions.map((transaction) => (
                      <BookEntry
                        key={transaction.id}
                        transaction={transaction}
                        accountName={accountName}
                        categoryName={categoryName}
                      />
                    ))}
                  </Stack>
                )}
              </Card>
            ))}
          </Box>
        </>
      )}
    </Stack>
  )
}

function ButtonToday({
  onClick,
  active,
  label,
}: {
  onClick: () => void
  active?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      className={`book-today-btn${active ? ' book-today-btn--active' : ''}`}
      onClick={onClick}
      title={label}
    >
      {label}
    </button>
  )
}

function BookEntry({
  transaction,
  accountName,
  categoryName,
}: {
  transaction: Transaction
  accountName: (id?: string) => string
  categoryName: (id?: string) => string
}) {
  const time = new Date(transaction.date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  const description = describeEntry(transaction, accountName, categoryName)
  const color = transaction.type === 'expense' ? 'red' : transaction.type === 'income' ? 'teal' : 'blue'

  return (
    <Group className="book-entry" justify="space-between" wrap="nowrap" gap="sm">
      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
        <Text size="xs" c="dimmed" className="book-entry-time">
          {time}
        </Text>
        <div style={{ minWidth: 0 }}>
          <Group gap={6} wrap="wrap">
            <Badge size="xs" variant="light" color={color}>
              {transaction.type}
            </Badge>
            {transaction.vendor && (
              <Text size="sm" fw={600} truncate>
                {transaction.vendor}
              </Text>
            )}
          </Group>
          <Text size="sm" c="dimmed" truncate>
            {description}
          </Text>
          {transaction.note && (
            <Text size="xs" c="dimmed" truncate>
              {transaction.note}
            </Text>
          )}
        </div>
      </Group>
      <Text size="sm" fw={700} c={color} className="book-entry-amount">
        {transaction.type === 'expense' ? '−' : transaction.type === 'income' ? '+' : ''}
        {formatMoney(transaction.amount)}
      </Text>
    </Group>
  )
}

function describeEntry(
  transaction: Transaction,
  accountName: (id?: string) => string,
  categoryName: (id?: string) => string,
) {
  if (transaction.type === 'expense') {
    return `${categoryName(transaction.categoryId)} · ${accountName(transaction.accountId)}`
  }

  if (transaction.type === 'income') {
    const cat = transaction.categoryId ? categoryName(transaction.categoryId) : 'Income'
    return `${cat} · ${accountName(transaction.accountId)}`
  }

  if (transaction.type === 'transfer') {
    return `${accountName(transaction.fromAccountId)} → ${accountName(transaction.toAccountId)}`
  }

  return transaction.note || 'Entry'
}
