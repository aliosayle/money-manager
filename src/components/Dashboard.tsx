import { BarChart, PieChart } from '@mantine/charts'
import {
  Box,
  Card,
  Group,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import type { Period, Summary } from '../types'
import { formatMoney } from '../api'

type DashboardProps = {
  summary: Summary | null
  period: Period
  onPeriodChange: (period: Period) => void
  loading: boolean
}

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

export function Dashboard({ summary, period, onPeriodChange, loading }: DashboardProps) {
  const pieData =
    summary?.byCategory.map((item) => ({
      name: item.name,
      value: item.amount,
      color: item.color,
      percent: item.percent,
    })) ?? []

  const barData =
    summary?.byMonth.map((item) => ({
      month: formatMonthLabel(item.month),
      Expenses: item.amount,
    })) ?? []

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
        <Title order={3}>Spending overview</Title>
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
          <Text c="dimmed">Loading summary...</Text>
        </Card>
      )}

      {!loading && summary && (
        <>
          <SimpleGrid cols={{ base: 1, xs: 3 }}>
            <Paper withBorder p="md" radius="md">
              <Text size="sm" c="dimmed">
                Income
              </Text>
              <Title order={2} c="teal">
                {formatMoney(summary.totalIncome)}
              </Title>
            </Paper>
            <Paper withBorder p="md" radius="md">
              <Text size="sm" c="dimmed">
                Expenses
              </Text>
              <Title order={2} c="red">
                {formatMoney(summary.totalExpenses)}
              </Title>
            </Paper>
            <Paper withBorder p="md" radius="md">
              <Text size="sm" c="dimmed">
                Net
              </Text>
              <Title order={2} c={summary.net >= 0 ? 'teal' : 'red'}>
                {formatMoney(summary.net)}
              </Title>
            </Paper>
          </SimpleGrid>

          <GridCharts pieData={pieData} barData={barData} totalExpenses={summary.totalExpenses} />
        </>
      )}
    </Stack>
  )
}

function GridCharts({
  pieData,
  barData,
  totalExpenses,
}: {
  pieData: { name: string; value: number; color: string; percent: number }[]
  barData: { month: string; Expenses: number }[]
  totalExpenses: number
}) {
  return (
    <SimpleGrid cols={{ base: 1, lg: 2 }}>
      <Card withBorder radius="md" p="md">
        <Title order={4} mb="md">
          By category
        </Title>
        {pieData.length === 0 || totalExpenses === 0 ? (
          <Text c="dimmed">No expenses in this period.</Text>
        ) : (
          <Group align="center" wrap="wrap" gap="xl" justify="center">
            <Box pos="relative" w={200} h={200} style={{ flexShrink: 0 }}>
              <PieChart
                data={pieData}
                size={200}
                withLabels={false}
                paddingAngle={2}
                strokeWidth={2}
                pieProps={{ innerRadius: '62%' }}
                withTooltip
                tooltipDataSource="segment"
                valueFormatter={(value) => formatMoney(value)}
              />
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
                <Text size="lg" fw={700} lh={1.2}>
                  {formatMoney(totalExpenses)}
                </Text>
              </Stack>
            </Box>
            <Stack gap="sm" style={{ flex: 1, minWidth: 200 }} justify="center">
              <CategoryLegend items={pieData} />
            </Stack>
          </Group>
        )}
      </Card>

      <Card withBorder radius="md" p="md">
        <Title order={4} mb="md">
          Expenses over time
        </Title>
        {barData.length === 0 ? (
          <Text c="dimmed">No expenses in this period.</Text>
        ) : (
          <BarChart
            h={300}
            data={barData}
            dataKey="month"
            series={[{ name: 'Expenses', color: 'red.6', label: 'Expenses' }]}
            valueFormatter={(value) => formatMoney(value)}
            gridAxis="y"
            tickLine="y"
            strokeDasharray="4 4"
            withTooltip
            maxBarWidth={52}
            barProps={{ radius: 6 }}
            xAxisProps={{ tickMargin: 10, minTickGap: 16 }}
            yAxisProps={{ width: 56 }}
          />
        )}
      </Card>
    </SimpleGrid>
  )
}

function CategoryLegend({
  items,
}: {
  items: { name: string; value: number; color: string; percent: number }[]
}) {
  return (
    <Stack gap={6}>
      {items.map((item) => (
        <Group key={item.name} justify="space-between" wrap="nowrap" gap="sm">
          <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
            <Box
              w={10}
              h={10}
              style={{
                borderRadius: 3,
                backgroundColor: item.color,
                flexShrink: 0,
              }}
            />
            <Text size="sm" truncate>
              {item.name}
            </Text>
          </Group>
          <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
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
  )
}
