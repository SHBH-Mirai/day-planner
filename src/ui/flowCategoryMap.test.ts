import { describe, expect, test } from 'vitest'
import { CATEGORIES } from '../domain/task'
import { CATEGORY_ICON, CATEGORY_LABEL } from './labels'
import nudges from '../../flows/nudges.json?raw'
import morning from '../../flows/morning.json?raw'
import evening from '../../flows/evening.json?raw'

type CategoryMap = Record<string, { icon: string; label: string; color: string; style: string }>

const categoryMap = (raw: string): CategoryMap => JSON.parse(raw).properties.definition.actions.Category_map.inputs

describe('the flows show categories the way the app does', () => {
  for (const [name, raw] of [['nudges', nudges], ['morning', morning], ['evening', evening]] as const) {
    test(`${name}: Category_map has the nine categories with the app's labels and icons`, () => {
      const map = categoryMap(raw)
      expect(Object.keys(map)).toEqual([...CATEGORIES])
      for (const c of CATEGORIES) {
        expect(map[c].label, c).toBe(CATEGORY_LABEL[c])
        expect(map[c].icon, c).toBe(CATEGORY_ICON[c])
      }
    })
  }
})
