import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Menu,
  Progress,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core'
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconDotsVertical,
  IconEdit,
  IconMapPin,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react'
import { weekStartOptions } from '../bookPrefs'
import { formatMoney } from '../api'
import type { Account, BookGranularity, BookView, Category, Transaction, WeekStartDay } from '../types'
import './Book.css'

type BookProps = {
  book: BookView | null
  offset: number
  loading: boolean
  granularity: BookGranularity
  weekStartDay: WeekStartDay
  onGranularityChange: (granularity: BookGranularity) => void
  onWeekStartDayChange: (day: WeekStartDay) => void
  onPrevious: () => void
  onNext: () => void
  onToday: () => void
  accounts: Account[]
  categories: Category[]
  canManageEntries: boolean
  onAddEntry: (dateKey: string) => void
  onEditEntry: (transaction: Transaction) => void
  onDeleteEntry: (transaction: Transaction) => void
}

export function Book({
  book,
  offset,
  loading,
  granularity,
  weekStartDay,
  onGranularityChange,
  onWeekStartDayChange,
  onPrevious,
  onNext,
  onToday,
  accounts,
  categories,
  canManageEntries,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
}: BookProps) {
  const accountName = (id?: string) => accounts.find((account) => account.id === id)?.name ?? '—'
  const categoryName = (id?: string) => categories.find((category) => category.id === id)?.name ?? '—'
  const periodLabel = offset === 0 ? 'Current period' : book?.offset === offset ? book.title : '…'
  const maxVendorAmount = book?.byVendor[0]?.amount ?? 0

  return (
    <Stack gap="md" className="book-root">
      <Card withBorder radius="md" className="book-toolbar" p="md">
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap" gap="sm">
            <Group gap="sm" wrap="wrap">
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

              {granularity === 'week' && (
                <Select
                  size="xs"
                  label="Week starts on"
                  aria-label="Week starts on"
                  className="book-week-start"
                  value={String(weekStartDay)}
                  onChange={(value) => {
                    if (value != null) {
                      onWeekStartDayChange(Number(value) as WeekStartDay)
                    }
                  }}
                  data={weekStartOptions}
                  leftSection={<IconCalendar size={14} />}
                  comboboxProps={{ withinPortal: true }}
                />
              )}
            </Group>

            <Group gap={4} wrap="nowrap" className="book-navigator">
              <ActionIcon variant="light" size="lg" onClick={onPrevious} aria-label="Previous period">
                <IconChevronLeft size={20} />
              </ActionIcon>
              <button
                type="button"
                className={`book-today-btn${offset === 0 ? ' book-today-btn--active' : ''}`}
                onClick={onToday}
                title={periodLabel}
              >
                {periodLabel}
              </button>
              <ActionIcon variant="light" size="lg" onClick={onNext} aria-label="Next period">
                <IconChevronRight size={20} />
              </ActionIcon>
            </Group>
          </Group>

          {book && book.offset === offset && !loading && (
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
              <SummaryStat label="Income" value={formatMoney(book.totals.income)} color="teal" />
              <SummaryStat label="Expenses" value={formatMoney(book.totals.expenses)} color="red" />
              <SummaryStat
                label="Net"
                value={formatMoney(book.totals.net)}
                color={book.totals.net >= 0 ? 'teal' : 'red'}
              />
              <SummaryStat
                label="Entries"
                value={String(book.days.reduce((sum, day) => sum + day.transactions.length, 0))}
                subtitle={`${book.days.filter((day) => day.transactions.length > 0).length} active days`}
              />
            </SimpleGrid>
          )}
        </Stack>
      </Card>

      {loading && (
        <Card withBorder radius="md" className="book-page">
          <Text c="dimmed">Turning the page...</Text>
        </Card>
      )}

      {!loading && book && book.offset === offset && (
        <>
          <Card withBorder radius="md" className="book-page book-cover" p="lg">
            <Group justify="space-between" align="flex-start" wrap="wrap" gap="lg">
              <div>
                <Text size="sm" c="dimmed" tt="uppercase" fw={600} className="book-eyebrow">
                  Ledger
                </Text>
                <Title order={2} className="book-title">
                  {book.title}
                </Title>
                <Text size="sm" c="dimmed" mt={4}>
                  {granularity === 'week'
                    ? `Week view · starts ${weekStartOptions.find((option) => option.value === String(weekStartDay))?.label ?? 'Monday'}`
                    : 'Month view'}
                </Text>
              </div>
            </Group>
          </Card>

          {book.byVendor.length > 0 && (
            <Card withBorder radius="md" className="book-page" p="md">
              <Group gap="xs" mb="sm">
                <ThemeIcon size="sm" variant="light" color="gray">
                  <IconMapPin size={14} />
                </ThemeIcon>
                <Title order={5}>Spending by place</Title>
              </Group>
              <Stack gap="sm">
                {book.byVendor.map((row) => (
                  <Box key={row.vendor} className="book-vendor-row">
                    <Group justify="space-between" mb={4} wrap="nowrap" gap="sm">
                      <Text size="sm" fw={600} truncate style={{ flex: 1 }}>
                        {row.vendor}
                      </Text>
                      <Group gap="xs" wrap="nowrap">
                        <Badge size="xs" variant="light" color="gray">
                          {row.count}×
                        </Badge>
                        <Text size="sm" fw={700}>
                          {formatMoney(row.amount)}
                        </Text>
                      </Group>
                    </Group>
                    {maxVendorAmount > 0 && (
                      <Progress
                        value={(row.amount / maxVendorAmount) * 100}
                        size="sm"
                        radius="xl"
                        color="red"
                        className="book-vendor-bar"
                      />
                    )}
                  </Box>
                ))}
              </Stack>
            </Card>
          )}

          <Box className="book-spread">
            {book.days.map((day) => {
              const dayNet = day.income - day.expenses
              const isToday = day.date === toDateKey(new Date())

              return (
                <Card
                  key={day.date}
                  withBorder
                  radius="md"
                  className={`book-page book-day${isToday ? ' book-day--today' : ''}`}
                  p="md"
                >
                  <Group justify="space-between" mb="sm" className="book-day-header" wrap="wrap" gap="xs">
                    <Group gap="xs" wrap="nowrap">
                      <Text fw={700} className="book-day-label">
                        {day.label}
                      </Text>
                      {isToday && (
                        <Badge size="xs" variant="light" color="blue">
                          Today
                        </Badge>
                      )}
                    </Group>

                    <Group gap="xs" wrap="nowrap">
                      {day.expenses > 0 && (
                        <Badge size="sm" variant="light" color="red">
                          −{formatMoney(day.expenses)}
                        </Badge>
                      )}
                      {day.income > 0 && (
                        <Badge size="sm" variant="light" color="teal">
                          +{formatMoney(day.income)}
                        </Badge>
                      )}
                      {(day.income > 0 || day.expenses > 0) && (
                        <Badge
                          size="sm"
                          variant="outline"
                          color={dayNet >= 0 ? 'teal' : 'red'}
                        >
                          Net {dayNet >= 0 ? '+' : '−'}
                          {formatMoney(Math.abs(dayNet))}
                        </Badge>
                      )}
                      {canManageEntries && (
                        <Tooltip label="Add entry for this day">
                          <ActionIcon
                            variant="light"
                            size="sm"
                            aria-label={`Add entry for ${day.label}`}
                            onClick={() => onAddEntry(day.date)}
                          >
                            <IconPlus size={14} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Group>
                  </Group>

                  {day.transactions.length === 0 ? (
                    canManageEntries ? (
                      <Button
                        variant="subtle"
                        color="gray"
                        size="compact-sm"
                        leftSection={<IconPlus size={14} />}
                        className="book-empty-add"
                        onClick={() => onAddEntry(day.date)}
                      >
                        Add entry for this day
                      </Button>
                    ) : (
                      <Text size="sm" c="dimmed" className="book-empty-line">
                        No entries
                      </Text>
                    )
                  ) : (
                    <Stack gap={0} className="book-entries">
                      {day.transactions.map((transaction) => (
                        <BookEntry
                          key={transaction.id}
                          transaction={transaction}
                          accountName={accountName}
                          categoryName={categoryName}
                          canManage={canManageEntries}
                          onEdit={() => onEditEntry(transaction)}
                          onDelete={() => onDeleteEntry(transaction)}
                        />
                      ))}
                    </Stack>
                  )}
                </Card>
              )
            })}
          </Box>
        </>
      )}
    </Stack>
  )
}

function SummaryStat({
  label,
  value,
  subtitle,
  color,
}: {
  label: string
  value: string
  subtitle?: string
  color?: string
}) {
  return (
    <Box className="book-summary-stat">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text fw={800} size="lg" c={color} className="book-summary-value">
        {value}
      </Text>
      {subtitle && (
        <Text size="xs" c="dimmed">
          {subtitle}
        </Text>
      )}
    </Box>
  )
}

function BookEntry({
  transaction,
  accountName,
  categoryName,
  canManage,
  onEdit,
  onDelete,
}: {
  transaction: Transaction
  accountName: (id?: string) => string
  categoryName: (id?: string) => string
  canManage: boolean
  onEdit: () => void
  onDelete: () => void
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

      <Group gap={4} wrap="nowrap" className="book-entry-actions">
        <Text size="sm" fw={700} c={color} className="book-entry-amount">
          {transaction.type === 'expense' ? '−' : transaction.type === 'income' ? '+' : ''}
          {formatMoney(transaction.amount)}
        </Text>

        {canManage && (
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label="Entry actions"
                className="book-entry-menu"
              >
                <IconDotsVertical size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconEdit size={14} />} onClick={onEdit}>
                Edit
              </Menu.Item>
              <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={onDelete}>
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>
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
    const category = transaction.categoryId ? categoryName(transaction.categoryId) : 'Income'
    return `${category} · ${accountName(transaction.accountId)}`
  }

  if (transaction.type === 'transfer') {
    return `${accountName(transaction.fromAccountId)} → ${accountName(transaction.toAccountId)}`
  }

  return transaction.note || 'Entry'
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
