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
