import { describe, expect, test } from 'vitest'
import { findNoBreakRuns, validateTask } from './validate'
import { MAX_DESCRIPTION, normaliseDescription, type TaskDraft } from './task'
import { ist, makeTask } from '../test-utils/makeTask'

const D = '2026-10-17'
const draft = (from: string, to: string, title = 'Write proposal'): TaskDraft => ({
  title,
  start: ist(D, from),
  end: ist(D, to),
  category: 'projects',
})

describe('validateTask errors', () => {
  test('empty or whitespace title is blocked', () => {
    expect(validateTask(draft('09:00', '10:00', ''), []).errors).toContain('Title is required')
    expect(validateTask(draft('09:00', '10:00', '   '), []).errors).toContain('Title is required')
  })

  test('end equal to start is blocked', () => {
    expect(validateTask(draft('09:00', '09:00'), []).errors).toContain('End must be after start')
  })

  test('end before start is blocked', () => {
    expect(validateTask(draft('10:00', '09:00'), []).errors).toContain('End must be after start')
  })

  test('a valid task has no errors', () => {
    expect(validateTask(draft('09:00', '10:00'), [])).toEqual({ errors: [], warnings: [] })
  })
})

describe('validateTask overlap warnings', () => {
  const standup = makeTask({ title: 'Standup', start: ist(D, '09:00'), end: ist(D, '09:15') })

  test('overlap warns but does not block', () => {
    const result = validateTask(draft('09:10', '10:00'), [standup])
    expect(result.warnings).toContain('Overlaps Standup (09:00–09:15)')
    expect(result.errors).toEqual([])
  })

  test('overlap with a skipped task is ignored', () => {
    const skipped = { ...standup, status: 'skipped' as const }
    expect(validateTask(draft('09:10', '10:00'), [skipped]).warnings).toEqual([])
  })

  test('a task does not overlap itself while being edited', () => {
    expect(validateTask(draft('09:00', '09:15', 'Standup'), [standup], standup.id).warnings).toEqual([])
  })

  test('touching ends are not an overlap', () => {
    expect(validateTask(draft('09:15', '10:00'), [standup]).warnings).toEqual([])
  })
})

describe('findNoBreakRuns', () => {
  const t = (from: string, to: string, status: 'planned' | 'skipped' = 'planned') =>
    makeTask({ start: ist(D, from), end: ist(D, to), status })

  test('3h of tasks with only 5-minute gaps is one run', () => {
    const tasks = [t('09:00', '10:00'), t('10:05', '11:00'), t('11:05', '12:00')]
    expect(findNoBreakRuns(tasks)).toEqual([{ fromUtc: ist(D, '09:00'), toUtc: ist(D, '12:00') }])
  })

  test('a 10-minute gap is a real break', () => {
    const tasks = [t('09:00', '10:00'), t('10:10', '11:00'), t('11:05', '12:00')]
    expect(findNoBreakRuns(tasks)).toEqual([])
  })

  test('a skipped task in the middle leaves a gap', () => {
    const tasks = [t('09:00', '10:30'), t('10:30', '11:30', 'skipped'), t('11:30', '12:30')]
    expect(findNoBreakRuns(tasks)).toEqual([])
  })

  test('a long skipped task alone is not a run', () => {
    expect(findNoBreakRuns([t('09:00', '13:00', 'skipped')])).toEqual([])
  })

  test('unsorted input still finds the run', () => {
    const tasks = [t('11:05', '12:00'), t('09:00', '10:00'), t('10:05', '11:00')]
    expect(findNoBreakRuns(tasks)).toHaveLength(1)
  })
})

describe('descriptions', () => {
  const TOO_LONG = 'Keep the description under 500 characters'

  test('normaliseDescription trims, and blank means none', () => {
    expect(normaliseDescription('  a  ')).toBe('a')
    expect(normaliseDescription('   ')).toBeUndefined()
    expect(normaliseDescription(undefined)).toBeUndefined()
    expect(normaliseDescription('a\nb')).toBe('a\nb')
  })

  test('a description over 500 characters is blocked', () => {
    expect(validateTask({ ...draft('09:00', '10:00'), description: 'x'.repeat(501) }, []).errors).toContain(TOO_LONG)
  })

  test('exactly 500 characters is fine', () => {
    expect(validateTask({ ...draft('09:00', '10:00'), description: 'x'.repeat(500) }, []).errors).not.toContain(TOO_LONG)
  })

  test('whitespace-only counts as no description, however long', () => {
    expect(validateTask({ ...draft('09:00', '10:00'), description: ' '.repeat(600) }, []).errors).not.toContain(TOO_LONG)
  })

  test('the limit is exported as 500', () => {
    expect(MAX_DESCRIPTION).toBe(500)
  })
})
