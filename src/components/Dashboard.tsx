import { useMemo } from 'react'
import {
  Badge,
  Box,
  Card,
  Group,
  Paper,
  Progress,
  RingProgress,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { useMantineColorScheme } from '@mantine/core'
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconChartArea,
  IconCoin,
  IconReceipt,
  IconTrendingDown,
  IconTrendingUp,
  IconWallet,
} from '@tabler/icons-react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Account, Period, Summary } from '../types'
import { formatMoney } from '../api'
import './Dashboard.css'

type DashboardProps = {
  summary: Summary | null
  accounts: Account[]
  totalBalance: number
  period: Period
  onPeriodChange: (period: Period) => void
  loading: boolean
}

const INCOME_COLOR = '#12b886'
const EXPENSE_COLOR = '#fa5252'
const NET_POSITIVE = '#0ca678'
const NET_NEGATIVE = '#e03131'
const ACCOUNT_COLORS = ['#228be6', '#7950f2', '#be4bdb', '#15aabf', '#fab005', '#fd7e14', '#40c057']

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  if (!year || !month) {
    return monthKey
  }

  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  })
}

function useChartTheme() {
  const { colorScheme } = useMantineColorScheme()
  const isDark =
    colorScheme === 'dark' ||
    (colorScheme === 'auto' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)

  return {
    isDark,
    axis: isDark ? '#868e96' : '#868e96',
    grid: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    tooltipBg: isDark ? '#25262b' : '#ffffff',
    tooltipBorder: isDark ? '#373a40' : '#dee2e6',
  }
}

export function Dashboard({
  summary,
  accounts,
  totalBalance,
  period,
  onPeriodChange,
  loading,
}: DashboardProps) {
  const theme = useChartTheme()

  const categoryData = useMemo(
    () =>
      summary?.byCategory.map((item) => ({
        name: item.name,
        value: item.amount,
        color: item.color,
        percent: item.percent,
      })) ?? [],
    [summary?.byCategory],
  )

  const monthFlowData = useMemo(
    () =>
      summary?.byMonthFlow.map((item) => ({
        month: formatMonthLabel(item.month),
        Income: item.income,
        Expenses: item.expenses,
      })) ?? [],
    [summary?.byMonthFlow],
  )

  const vendorData = useMemo(
    () =>
      summary?.byVendor.map((item) => ({
        vendor: item.vendor,
        amount: item.amount,
        count: item.count,
      })) ?? [],
    [summary?.byVendor],
  )

  const maxVendor = vendorData[0]?.amount ?? 0

  return (
    <Stack gap="md" className="dashboard-root">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
        <div>
          <Title order={3} className="dashboard-chart-title">
            Financial overview
          </Title>
          <Text size="sm" c="dimmed">
            Income, spending, and trends for the selected period
          </Text>
        </div>
        <SegmentedControl
          size="xs"
          value={period}
          onChange={(value) => {
            if (value) {
              onPeriodChange(value as Period)
            }
          }}
          data={[
            { label: 'This month', value: 'month' },
            { label: '30 days', value: '30d' },
            { label: 'This year', value: 'year' },
            { label: 'All time', value: 'all' },
          ]}
        />
      </Group>

      {loading && (
        <Card withBorder radius="md">
          <Text c="dimmed">Loading dashboard...</Text>
        </Card>
      )}

      {!loading && summary && (
        <>
          <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="sm">
            <KpiCard
              label="Total balance"
              value={formatMoney(totalBalance)}
              color={totalBalance < 0 ? NET_NEGATIVE : undefined}
              icon={IconWallet}
              iconColor="blue"
            />
            <KpiCard
              label="Income"
              value={formatMoney(summary.totalIncome)}
              color={INCOME_COLOR}
              icon={IconTrendingUp}
              iconColor="teal"
              subtitle={`${summary.insights.incomeCount} deposits`}
            />
            <KpiCard
              label="Expenses"
              value={formatMoney(summary.totalExpenses)}
              color={EXPENSE_COLOR}
              icon={IconTrendingDown}
              iconColor="red"
              subtitle={
                summary.insights.expenseChangePercent != null && summary.insights.comparisonLabel
                  ? `${summary.insights.expenseChangePercent > 0 ? '+' : ''}${summary.insights.expenseChangePercent}% ${summary.insights.comparisonLabel}`
                  : `${summary.insights.expenseCount} purchases`
              }
              subtitleColor={
                summary.insights.expenseChangePercent != null
                  ? summary.insights.expenseChangePercent > 0
                    ? 'dashboard-change-up'
                    : 'dashboard-change-down'
                  : undefined
              }
            />
            <KpiCard
              label="Net cash flow"
              value={formatMoney(summary.net)}
              color={summary.net >= 0 ? NET_POSITIVE : NET_NEGATIVE}
              icon={IconCoin}
              iconColor={summary.net >= 0 ? 'teal' : 'red'}
            />
            <KpiCard
              label="Avg daily spend"
              value={formatMoney(summary.insights.avgDailySpend)}
              icon={IconReceipt}
              iconColor="orange"
            />
            <KpiCard
              label="Savings rate"
              value={
                summary.insights.savingsRate == null
                  ? '—'
                  : `${summary.insights.savingsRate}%`
              }
              color={
                summary.insights.savingsRate != null && summary.insights.savingsRate >= 0
                  ? NET_POSITIVE
                  : NET_NEGATIVE
              }
              icon={IconChartArea}
              iconColor="grape"
              subtitle={
                summary.totalIncome > 0 ? 'Net income after expenses' : 'No income recorded'
              }
            />
          </SimpleGrid>

          <Card withBorder radius="md" p="md" className="dashboard-chart-card">
            <Group justify="space-between" mb="md" wrap="wrap">
              <Title order={4} className="dashboard-chart-title">
                Cash flow
              </Title>
              <Group gap="md">
                <LegendItem color={INCOME_COLOR} label="Income" />
                <LegendItem color={EXPENSE_COLOR} label="Expenses" />
              </Group>
            </Group>
            {summary.cashFlow.length === 0 ? (
              <Text c="dimmed">No income or expenses in this period.</Text>
            ) : (
              <Box h={280}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={summary.cashFlow} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={INCOME_COLOR} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={INCOME_COLOR} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={EXPENSE_COLOR} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={EXPENSE_COLOR} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={theme.grid} strokeDasharray="4 4" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: theme.axis, fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={24}
                    />
                    <YAxis
                      tick={{ fill: theme.axis, fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      width={56}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="income"
                      name="Income"
                      stroke={INCOME_COLOR}
                      strokeWidth={2}
                      fill="url(#incomeGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="expenses"
                      name="Expenses"
                      stroke={EXPENSE_COLOR}
                      strokeWidth={2}
                      fill="url(#expenseGradient)"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
            )}
          </Card>

          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
            <Card withBorder radius="md" p="md" className="dashboard-chart-card">
              <Title order={4} mb="md" className="dashboard-chart-title">
                Spending by category
              </Title>
              {categoryData.length === 0 || summary.totalExpenses === 0 ? (
                <Text c="dimmed">No expenses in this period.</Text>
              ) : (
                <Group align="center" wrap="wrap" gap="xl" justify="center">
                  <Box pos="relative" w={220} h={220}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={68}
                          outerRadius={98}
                          paddingAngle={2}
                          strokeWidth={2}
                        >
                          {categoryData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <Stack
                      gap={0}
                      align="center"
                      justify="center"
                      pos="absolute"
                      inset={0}
                      style={{ pointerEvents: 'none' }}
                    >
                      <Text size="xs" c="dimmed">
                        Total
                      </Text>
                      <Text size="lg" fw={700} className="dashboard-kpi-value">
                        {formatMoney(summary.totalExpenses)}
                      </Text>
                    </Stack>
                  </Box>
                  <Stack gap={8} style={{ flex: 1, minWidth: 200 }}>
                    {categoryData.map((item) => (
                      <Group key={item.name} justify="space-between" wrap="nowrap" gap="sm">
                        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                          <span className="dashboard-legend-dot" style={{ backgroundColor: item.color }} />
                          <Text size="sm" truncate>
                            {item.name}
                          </Text>
                        </Group>
                        <Group gap="xs" wrap="nowrap">
                          <Text size="sm" c="dimmed">
                            {item.percent}%
                          </Text>
                          <Text size="sm" fw={600}>
                            {formatMoney(item.value)}
                          </Text>
                        </Group>
                      </Group>
                    ))}
                  </Stack>
                </Group>
              )}
            </Card>

            <Card withBorder radius="md" p="md" className="dashboard-chart-card">
              <Title order={4} mb="md" className="dashboard-chart-title">
                Account balances
              </Title>
              {accounts.length === 0 ? (
                <Text c="dimmed">No accounts yet.</Text>
              ) : (
                <Stack gap="md">
                  <Group justify="center">
                    <RingProgress
                      size={140}
                      thickness={14}
                      roundCaps
                      sections={accounts.map((account, index) => ({
                        value:
                          totalBalance !== 0
                            ? Math.max((Math.abs(account.balance) / Math.abs(totalBalance)) * 100, 4)
                            : 100 / accounts.length,
                        color: ACCOUNT_COLORS[index % ACCOUNT_COLORS.length],
                      }))}
                      label={
                        <Stack gap={0} align="center">
                          <Text size="xs" c="dimmed">
                            Total
                          </Text>
                          <Text size="md" fw={700} className="dashboard-kpi-value">
                            {formatMoney(totalBalance)}
                          </Text>
                        </Stack>
                      }
                    />
                  </Group>
                  <Stack gap="sm">
                    {accounts.map((account, index) => (
                      <Group key={account.id} justify="space-between" wrap="nowrap">
                        <Group gap="xs" wrap="nowrap">
                          <span
                            className="dashboard-legend-dot"
                            style={{ backgroundColor: ACCOUNT_COLORS[index % ACCOUNT_COLORS.length] }}
                          />
                          <Text size="sm">{account.name}</Text>
                        </Group>
                        <Text
                          size="sm"
                          fw={600}
                          c={account.balance < 0 ? 'red' : undefined}
                          className="dashboard-kpi-value"
                        >
                          {formatMoney(account.balance)}
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                </Stack>
              )}
            </Card>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
            <Card withBorder radius="md" p="md" className="dashboard-chart-card">
              <Title order={4} mb="md" className="dashboard-chart-title">
                Income vs expenses
              </Title>
              {monthFlowData.length === 0 ? (
                <Text c="dimmed">No monthly data in this period.</Text>
              ) : (
                <Box h={300}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthFlowData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={theme.grid} strokeDasharray="4 4" vertical={false} />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: theme.axis, fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fill: theme.axis, fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        width={56}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend />
                      <Bar dataKey="Income" fill={INCOME_COLOR} radius={[6, 6, 0, 0]} maxBarSize={40} />
                      <Bar dataKey="Expenses" fill={EXPENSE_COLOR} radius={[6, 6, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </Card>

            <Card withBorder radius="md" p="md" className="dashboard-chart-card">
              <Title order={4} mb="md" className="dashboard-chart-title">
                Top places
              </Title>
              {vendorData.length === 0 ? (
                <Text c="dimmed">No vendor-tagged expenses in this period.</Text>
              ) : (
                <Stack gap="sm">
                  {vendorData.map((row) => (
                    <Box key={row.vendor}>
                      <Group justify="space-between" mb={4} wrap="nowrap">
                        <Text size="sm" fw={600} truncate style={{ flex: 1 }}>
                          {row.vendor}
                        </Text>
                        <Group gap="xs" wrap="nowrap">
                          <Badge size="xs" variant="light" color="gray">
                            {row.count}×
                          </Badge>
                          <Text size="sm" fw={700} className="dashboard-kpi-value">
                            {formatMoney(row.amount)}
                          </Text>
                        </Group>
                      </Group>
                      <Progress
                        value={maxVendor > 0 ? (row.amount / maxVendor) * 100 : 0}
                        size="sm"
                        radius="xl"
                        color="red"
                      />
                    </Box>
                  ))}
                </Stack>
              )}
            </Card>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
            <Card withBorder radius="md" p="md" className="dashboard-chart-card">
              <Title order={4} mb="md" className="dashboard-chart-title">
                Spending by account
              </Title>
              {summary.byAccount.length === 0 ? (
                <Text c="dimmed">No expenses charged to accounts in this period.</Text>
              ) : (
                <Box h={Math.max(summary.byAccount.length * 48, 160)}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={summary.byAccount}
                      layout="vertical"
                      margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid stroke={theme.grid} strokeDasharray="4 4" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fill: theme.axis, fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fill: theme.axis, fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        width={88}
                      />
                      <Tooltip content={<ChartTooltip valueKey="amount" />} />
                      <Bar dataKey="amount" name="Spent" fill="#228be6" radius={[0, 6, 6, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </Card>

            <Card withBorder radius="md" p="md" className="dashboard-chart-card">
              <Title order={4} mb="md" className="dashboard-chart-title">
                Largest expenses
              </Title>
              {summary.topExpenses.length === 0 ? (
                <Text c="dimmed">No expenses in this period.</Text>
              ) : (
                <Stack gap="xs">
                  {summary.topExpenses.map((expense, index) => (
                    <Group
                      key={expense.id}
                      justify="space-between"
                      wrap="nowrap"
                      gap="sm"
                      className="dashboard-top-expense"
                      p="xs"
                    >
                      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                        <Badge size="sm" variant="light" color="gray" circle>
                          {index + 1}
                        </Badge>
                        <div style={{ minWidth: 0 }}>
                          <Text size="sm" fw={600} truncate>
                            {expense.vendor || expense.categoryName}
                          </Text>
                          <Text size="xs" c="dimmed" truncate>
                            {expense.categoryName} · {new Date(expense.date).toLocaleDateString()}
                          </Text>
                        </div>
                      </Group>
                      <Text size="sm" fw={700} c="red" className="dashboard-kpi-value">
                        {formatMoney(expense.amount)}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              )}
            </Card>
          </SimpleGrid>
        </>
      )}
    </Stack>
  )
}

function KpiCard({
  label,
  value,
  subtitle,
  color,
  icon: Icon,
  iconColor,
  subtitleColor,
}: {
  label: string
  value: string
  subtitle?: string
  color?: string
  icon: typeof IconWallet
  iconColor: string
  subtitleColor?: string
}) {
  return (
    <Paper withBorder p="md" radius="md" className="dashboard-kpi">
      <Group justify="space-between" align="flex-start" mb="xs" wrap="nowrap">
        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
          {label}
        </Text>
        <ThemeIcon size="sm" variant="light" color={iconColor} radius="md">
          <Icon size={14} />
        </ThemeIcon>
      </Group>
      <Text size="xl" fw={800} c={color} className="dashboard-kpi-value">
        {value}
      </Text>
      {subtitle && (
        <Group gap={4} mt={6} wrap="nowrap">
          {subtitleColor === 'dashboard-change-up' && <IconArrowUpRight size={14} className={subtitleColor} />}
          {subtitleColor === 'dashboard-change-down' && (
            <IconArrowDownRight size={14} className={subtitleColor} />
          )}
          <Text size="xs" c="dimmed" className={subtitleColor}>
            {subtitle}
          </Text>
        </Group>
      )}
    </Paper>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <Group gap={6} wrap="nowrap">
      <span className="dashboard-legend-dot" style={{ backgroundColor: color }} />
      <Text size="sm" c="dimmed">
        {label}
      </Text>
    </Group>
  )
}

type TooltipEntry = {
  name?: string
  value?: number
  color?: string
  dataKey?: string
  payload?: Record<string, number | string>
}

function ChartTooltip({
  active,
  payload,
  label,
  valueKey,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
  valueKey?: string
}) {
  if (!active || !payload?.length) {
    return null
  }

  return (
    <div className="dashboard-tooltip">
      {label && (
        <Text size="sm" fw={600} mb={4}>
          {label}
        </Text>
      )}
      {payload.map((entry) => {
        const key = entry.dataKey ?? entry.name ?? 'value'
        const displayValue =
          valueKey && entry.payload ? entry.payload[valueKey] : entry.value

        return (
          <div key={String(key)} className="dashboard-tooltip-row">
            <span className="dashboard-tooltip-label">
              <span className="dashboard-legend-dot" style={{ backgroundColor: entry.color }} />
              <Text size="sm">{entry.name ?? key}</Text>
            </span>
            <Text size="sm" fw={700}>
              {formatMoney(Number(displayValue ?? 0))}
            </Text>
          </div>
        )
      })}
    </div>
  )
}
