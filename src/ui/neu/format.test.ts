import { describe, expect, it } from 'vitest'
import { formatMinutes } from './format'

describe('formatMinutes', () => {
  it('shows minutes under an hour', () => {
    expect(formatMinutes(0)).toBe('0m')
    expect(formatMinutes(45)).toBe('45m')
  })

  it('shows hours, and minutes only when there are some', () => {
    expect(formatMinutes(60)).toBe('1h')
    expect(formatMinutes(75)).toBe('1h 15m')
    expect(formatMinutes(150)).toBe('2h 30m')
  })
})
