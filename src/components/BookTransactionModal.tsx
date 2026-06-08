import { useEffect, useState } from 'react'
import { Button, Group, Modal, Stack, Text } from '@mantine/core'
import type { Account, Category, Transaction, TransactionForm as TransactionFormState } from '../types'
import { TransactionForm } from './TransactionForm'

type BookTransactionModalProps = {
  opened: boolean
  mode: 'create' | 'edit'
  transaction?: Transaction
  defaultDate?: string
  accounts: Account[]
  categories: Category[]
  vendorSuggestions: string[]
  saving: boolean
  onClose: () => void
  onSave: (form: TransactionFormState, date: string) => void
  onDelete?: () => void
}

const blankForm: TransactionFormState = {
  type: 'expense',
  amount: '',
  accountId: '',
  fromAccountId: '',
  toAccountId: '',
  categoryId: '',
  vendor: '',
  note: '',
}

function toDatetimeLocalValue(iso: string) {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function defaultDatetimeForDay(dateKey: string) {
  const now = new Date()
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), 0, 0)

  return toDatetimeLocalValue(date.toISOString())
}

function formFromTransaction(transaction: Transaction): TransactionFormState {
  return {
    type: transaction.type === 'transfer' || transaction.type === 'income' ? transaction.type : 'expense',
    amount: String(transaction.amount),
    accountId: transaction.accountId ?? '',
    fromAccountId: transaction.fromAccountId ?? '',
    toAccountId: transaction.toAccountId ?? '',
    categoryId: transaction.categoryId ?? '',
    vendor: transaction.vendor ?? '',
    note: transaction.note,
  }
}

export function BookTransactionModal({
  opened,
  mode,
  transaction,
  defaultDate,
  accounts,
  categories,
  vendorSuggestions,
  saving,
  onClose,
  onSave,
  onDelete,
}: BookTransactionModalProps) {
  const [form, setForm] = useState<TransactionFormState>(blankForm)
  const [datetime, setDatetime] = useState('')

  useEffect(() => {
    if (!opened) {
      return
    }

    if (mode === 'edit' && transaction) {
      setForm(formFromTransaction(transaction))
      setDatetime(toDatetimeLocalValue(transaction.date))
      return
    }

    setForm({ ...blankForm, accountId: accounts[0]?.id ?? '' })
    setDatetime(defaultDate ? defaultDatetimeForDay(defaultDate) : toDatetimeLocalValue(new Date().toISOString()))
  }, [opened, mode, transaction, defaultDate, accounts])

  const handleSubmit = () => {
    if (!datetime) {
      return
    }

    onSave(form, new Date(datetime).toISOString())
  }

  const title =
    mode === 'edit'
      ? 'Edit entry'
      : form.type === 'expense'
        ? 'Add expense'
        : form.type === 'income'
          ? 'Add income'
          : 'Add transfer'

  return (
    <Modal opened={opened} onClose={onClose} title={title} size="lg" centered>
      <Stack gap="md">
        <TransactionForm
          form={form}
          accounts={accounts}
          categories={categories}
          vendorSuggestions={vendorSuggestions}
          onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
          onSubmit={handleSubmit}
          submitLabel={mode === 'edit' ? 'Save changes' : 'Add entry'}
          datetime={datetime}
          onDatetimeChange={setDatetime}
        />

        {mode === 'edit' && onDelete && (
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              Deleting removes this entry and reverses its effect on account balances.
            </Text>
            <Group justify="space-between">
              <Button color="red" variant="light" onClick={onDelete} disabled={saving}>
                Delete entry
              </Button>
              <Button variant="default" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
            </Group>
          </Stack>
        )}
      </Stack>
    </Modal>
  )
}
