import { Autocomplete, Button, Grid, SegmentedControl, Select, Stack, TextInput } from '@mantine/core'
import { inputValue } from '../formUtils'
import type { Account, Category, TransactionForm as TransactionFormState } from '../types'

type TransactionFormProps = {
  form: TransactionFormState
  accounts: Account[]
  categories: Category[]
  vendorSuggestions?: string[]
  onChange: (patch: Partial<TransactionFormState>) => void
  onSubmit: () => void
  submitLabel?: string
  datetime?: string
  onDatetimeChange?: (value: string) => void
}

export function TransactionForm({
  form,
  accounts,
  categories,
  vendorSuggestions = [],
  onChange,
  onSubmit,
  submitLabel = 'Save transaction',
  datetime,
  onDatetimeChange,
}: TransactionFormProps) {
  const accountOptions = accounts.map((account) => ({
    value: account.id,
    label: `${account.name} (${account.balance.toFixed(2)})`,
  }))

  const categoryOptions = categories.map((category) => ({
    value: category.id,
    label: category.name,
  }))

  const isTransfer = form.type === 'transfer'

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <Stack gap="md">
        <SegmentedControl
          value={form.type}
          onChange={(value) => {
            if (value) {
              onChange({ type: value as TransactionFormState['type'] })
            }
          }}
          data={[
            { label: 'Expense', value: 'expense' },
            { label: 'Income', value: 'income' },
            { label: 'Transfer', value: 'transfer' },
          ]}
        />

        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, md: isTransfer ? 4 : 3 }}>
            <TextInput
              label="Amount"
              required
              inputMode="decimal"
              value={form.amount}
              onChange={(event) => onChange({ amount: inputValue(event) })}
              placeholder="0.00"
            />
          </Grid.Col>

          {isTransfer ? (
            <>
              <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                <Select
                  label="From account"
                  required
                  searchable
                  data={accountOptions}
                  value={form.fromAccountId || null}
                  onChange={(value) => onChange({ fromAccountId: value ?? '' })}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                <Select
                  label="To account"
                  required
                  searchable
                  data={accountOptions}
                  value={form.toAccountId || null}
                  onChange={(value) => onChange({ toAccountId: value ?? '' })}
                />
              </Grid.Col>
            </>
          ) : (
            <>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Select
                  label="Account"
                  required
                  searchable
                  data={accountOptions}
                  value={form.accountId || null}
                  onChange={(value) => onChange({ accountId: value ?? '' })}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
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
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Autocomplete
                  label="Place (optional)"
                  placeholder="Store, supermarket..."
                  data={vendorSuggestions}
                  value={form.vendor}
                  onChange={(value) => onChange({ vendor: value })}
                  limit={12}
                />
              </Grid.Col>
            </>
          )}

          <Grid.Col span={{ base: 12, md: isTransfer ? 12 : 8 }}>
            <TextInput
              label="Note"
              value={form.note}
              onChange={(event) => onChange({ note: inputValue(event) })}
              placeholder="Optional description"
            />
          </Grid.Col>

          {onDatetimeChange && (
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <TextInput
                label="Date & time"
                type="datetime-local"
                required
                value={datetime ?? ''}
                onChange={(event) => onDatetimeChange(inputValue(event))}
              />
            </Grid.Col>
          )}
        </Grid>

        <Button type="submit" w={{ base: '100%', sm: 'auto' }}>
          {submitLabel}
        </Button>
      </Stack>
    </form>
  )
}
