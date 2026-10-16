import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useToday } from './useToday'

describe('useToday', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-17T23:58:00+05:30'))
  })
  afterEach(() => vi.useRealTimers())

  test('moves to the new day shortly after local midnight', () => {
    const { result } = renderHook(() => useToday())
    expect(result.current.toDateString()).toBe('Sat Oct 17 2026')
    act(() => {
      vi.advanceTimersByTime(3 * 60_000)
    })
    expect(result.current.toDateString()).toBe('Sun Oct 18 2026')
  })

  test('keeps the same Date object during the day', () => {
    const { result } = renderHook(() => useToday())
    const first = result.current
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(result.current).toBe(first)
  })
})
