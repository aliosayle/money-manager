import type { WeekStartDay } from './types'

const WEEK_START_KEY = 'money-manager-week-start-day'

const WEEK_START_LABELS: Record<WeekStartDay, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
}

export const weekStartOptions = (Object.keys(WEEK_START_LABELS) as unknown as WeekStartDay[]).map(
  (value) => ({
    value: String(value),
    label: WEEK_START_LABELS[value],
  }),
)

export function getWeekStartDay(): WeekStartDay {
  if (typeof window === 'undefined') {
    return 1
  }

  const stored = window.localStorage.getItem(WEEK_START_KEY)
  const parsed = Number(stored)

  if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 6) {
    return parsed as WeekStartDay
  }

  return 1
}

export function setWeekStartDay(day: WeekStartDay) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(WEEK_START_KEY, String(day))
}
