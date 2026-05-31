import { Button, NumberInput, SegmentedControl, Select, Stack, TextInput } from '@mantine/core'
import type { Account, Category, TransactionForm as TransactionFormState } from '../types'

type TransactionFormProps = {
  form: TransactionFormState
  accounts: Account[]
  categories: Category[]
  onChange: (patch: Partial<TransactionFormState>) => void
  onSubmit: () => void
  submitLabel?: string
}

export function TransactionForm({
  form,
  accounts,
  categories,
  onChange,
  onSubmit,
  submitLabel = 'Save transaction',
}: TransactionFormProps) {
  const accountOptions = accounts.map((account) => ({
    value: account.id,
    label: `${account.name} (${account.balance.toFixed(2)})`,
  }))

  const categoryOptions = categories.map((category) => ({
    value: category.id,
    label: category.name,
  }))

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <Stack gap="sm">
        <SegmentedControl
          value={form.type}
          onChange={(value) => onChange({ type: value as TransactionFormState['type'] })}
          data={[
            { label: 'Expense', value: 'expense' },
            { label: 'Income', value: 'income' },
            { label: 'Transfer', value: 'transfer' },
          ]}
        />

        <NumberInput
          hideControls
          label="Amount"
          required
          min={0.01}
          decimalScale={2}
          fixedDecimalScale
          value={form.amount}
          onChange={(value) => onChange({ amount: value.toString() })}
          placeholder="0.00"
        />

        {form.type === 'transfer' ? (
          <>
            <Select
              label="From account"
              required
              searchable
              data={accountOptions}
              value={form.fromAccountId || null}
              onChange={(value) => onChange({ fromAccountId: value ?? '' })}
            />
            <Select
              label="To account"
              required
              searchable
              data={accountOptions}
              value={form.toAccountId || null}
              onChange={(value) => onChange({ toAccountId: value ?? '' })}
            />
          </>
        ) : (
          <>
            <Select
              label="Account"
              required
              searchable
              data={accountOptions}
              value={form.accountId || null}
              onChange={(value) => onChange({ accountId: value ?? '' })}
            />
            <Select
              label={form.type === 'expense' ? 'Category' : 'Category (optional)'}
              required={form.type === 'expense'}
              clearable={form.type === 'income'}
              searchable
              data={categoryOptions}
              value={form.categoryId || null}
              onChange={(value) => onChange({ categoryId: value ?? '' })}
              disabled={categories.length === 0 && form.type === 'expense'}
            />
          </>
        )}

        <TextInput
          label="Note"
          value={form.note}
          onChange={(event) => onChange({ note: event.currentTarget.value })}
          placeholder="Optional description"
        />

        <Button type="submit">{submitLabel}</Button>
      </Stack>
    </form>
  )
}
