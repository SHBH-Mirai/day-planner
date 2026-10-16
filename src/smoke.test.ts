import { expect, test } from 'vitest'

test('tests run in IST (UTC+5:30)', () => {
  expect(new Date('2026-10-17T00:00:00Z').getTimezoneOffset()).toBe(-330)
})
