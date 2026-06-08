import type {
  BookGranularity,
  BookView,
  MoneyState,
  Period,
  Summary,
  TransactionPayload,
  WeekStartDay,
} from './types'

export const formatMoney = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)

export const parseAmount = (value: string) => {
  const amount = Number(value)

  if (!Number.isFinite(amount) || amount <= 0) {
    return null
  }

  return Math.round(amount * 100) / 100
}

export const apiRequest = async <T,>(path: string, options?: RequestInit): Promise<T> => {
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

export const fetchState = () => apiRequest<MoneyState>('/api/state')

export const fetchSummary = (period: Period) =>
  apiRequest<Summary>(`/api/summary?period=${period}`)

export const fetchBook = (
  granularity: BookGranularity,
  offset: number,
  weekStartDay: WeekStartDay = 1,
) =>
  apiRequest<BookView>(
    `/api/book?granularity=${granularity}&offset=${offset}&weekStartDay=${weekStartDay}`,
  )

export const fetchVendors = () => apiRequest<{ vendors: string[] }>('/api/vendors')

export const postState = (path: string, body: unknown) =>
  apiRequest<MoneyState>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })

export const deleteState = (path: string) =>
  apiRequest<MoneyState>(path, { method: 'DELETE' })

export const putState = (path: string, body: unknown) =>
  apiRequest<MoneyState>(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  })

export const updateTransaction = (id: string, body: TransactionPayload) =>
  putState(`/api/transactions/${id}`, body)

export const deleteTransaction = (id: string) => deleteState(`/api/transactions/${id}`)
