import { BarChart, PieChart } from '@mantine/charts'
import { Card, Group, Paper, SegmentedControl, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import type { Period, Summary } from '../types'
import { formatMoney } from '../api'

type DashboardProps = {
  summary: Summary | null
  period: Period
  onPeriodChange: (period: Period) => void
  loading: boolean
}

export function Dashboard({ summary, period, onPeriodChange, loading }: DashboardProps) {
  const pieData =
    summary?.byCategory.map((item) => ({
      name: item.name,
      value: item.amount,
      color: item.color,
    })) ?? []

  const barData =
    summary?.byMonth.map((item) => ({
      month: item.month,
      Expenses: item.amount,
    })) ?? []

  return (
    <Stack gap="md">
      <Group justify="space-between">
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

          <GridCharts pieData={pieData} barData={barData} />
        </>
      )}
    </Stack>
  )
}

function GridCharts({
  pieData,
  barData,
}: {
  pieData: { name: string; value: number; color: string }[]
  barData: { month: string; Expenses: number }[]
}) {
  return (
    <SimpleGrid cols={{ base: 1, lg: 2 }}>
      <Card withBorder radius="md" p="md">
        <Title order={4} mb="md">
          By category
        </Title>
        {pieData.length === 0 ? (
          <Text c="dimmed">No expenses in this period.</Text>
        ) : (
          <PieChart
            data={pieData}
            withLabelsLine
            labelsPosition="outside"
            labelsType="percent"
            withTooltip
            tooltipDataSource="segment"
          />
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
            h={280}
            data={barData}
            dataKey="month"
            series={[{ name: 'Expenses', color: 'red.6' }]}
            withTooltip
            tickLine="y"
          />
        )}
      </Card>
    </SimpleGrid>
  )
}
