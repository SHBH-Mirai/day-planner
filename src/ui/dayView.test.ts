import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DAY_VIEW_KEY, readDayView, saveDayView } from './dayView'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

test('defaults to list', () => {
  expect(readDayView()).toBe('list')
})

test('remembers table', () => {
  saveDayView('table')
  expect(readDayView()).toBe('table')
})

test('an odd stored value reads as list', () => {
  localStorage.setItem(DAY_VIEW_KEY, 'grid')
  expect(readDayView()).toBe('list')
})

test('blocked storage still works', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  expect(readDayView()).toBe('list')
  expect(() => saveDayView('table')).not.toThrow()
})
