import { describe, expect, test } from 'vitest'
import { CATEGORIES } from '../domain/task'
import { CATEGORY_ICON, CATEGORY_LABEL } from './labels'

describe('category labels and icons', () => {
  test('every category has a label and an icon', () => {
    for (const c of CATEGORIES) {
      expect(CATEGORY_LABEL[c]).toBeTruthy()
      expect(CATEGORY_ICON[c]).toBeTruthy()
    }
  })

  test('labels match the spec', () => {
    expect(CATEGORIES.map((c) => CATEGORY_LABEL[c])).toEqual([
      'Office', 'Projects', 'Content', 'Recording', 'Editing', 'Learning', 'Health', 'Personal', 'Breaks & meals',
    ])
  })

  test('icons match the spec', () => {
    expect(CATEGORIES.map((c) => CATEGORY_ICON[c])).toEqual(['💼', '✍️', '🎬', '🎙️', '✂️', '📚', '💪', '🏠', '🍽️'])
  })
})
