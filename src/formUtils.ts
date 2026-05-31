import type { ChangeEvent } from 'react'

/** Read input value before a functional setState — React may null out event.currentTarget in the updater. */
export function inputValue(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): string {
  return event.currentTarget.value
}

/** Mantine NumberInput passes null when the field is cleared or mid-edit. */
export function stringFromNumberInput(value: string | number | null | undefined): string {
  if (value == null) {
    return ''
  }

  return String(value)
}

/** Mantine ColorInput / Select may pass null when cleared. */
export function stringFromInput(value: string | null | undefined, fallback = ''): string {
  return value ?? fallback
}
