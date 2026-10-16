const pad = (n: number) => String(n).padStart(2, '0')

/** UTC ISO → value for <input type="datetime-local"> in local time. */
export function toInputValue(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** datetime-local value (local time) → UTC ISO, or '' when empty or invalid. */
export function fromInputValue(value: string): string {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}
