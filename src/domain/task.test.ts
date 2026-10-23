import { describe, expect, test } from 'vitest'
import { CATEGORIES, emptyPerCategory, readCategory } from './task'
import { dayTotals } from '../ui/neu/totals'
import { makeTask } from '../test-utils/makeTask'

describe('categories', () => {
  test('nine keys, in picker order', () => {
    expect(CATEGORIES).toEqual(['office', 'projects', 'youtube', 'recording', 'editing', 'learning', 'health', 'personal', 'breaks'])
  })

  test('emptyPerCategory has every category at 0', () => {
    const empty = emptyPerCategory()
    expect(Object.keys(empty)).toEqual([...CATEGORIES])
    expect(Object.values(empty).every((n) => n === 0)).toBe(true)
  })

  test('readCategory keeps a known key', () => {
    expect(readCategory('health')).toBe('health')
    expect(readCategory('youtube')).toBe('youtube')
  })

  test('readCategory reads the old third key as projects during the switch', () => {
    expect(readCategory('freelance')).toBe('projects')
  })

  test('readCategory reads anything else as office', () => {
    expect(readCategory('nope')).toBe('office')
    expect(readCategory(undefined)).toBe('office')
    expect(readCategory(42)).toBe('office')
  })

  test('an unknown value never makes the day totals NaN', () => {
    const totals = dayTotals([makeTask({ category: readCategory('nope') })])
    expect(totals.perCategory.office).toBeGreaterThan(0)
    expect(Object.values(totals.perCategory).every(Number.isFinite)).toBe(true)
  })
})
