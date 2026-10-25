import { describe, expect, test } from 'vitest'
import { fixedBlocks, flowAround } from './flow'
import type { Task } from './task'
import { ist, makeTask } from '../test-utils/makeTask'

const D = '2026-10-22'
const at = (title: string, from: string, to: string, over: Partial<Task> = {}) => makeTask({ title, start: ist(D, from), end: ist(D, to), ...over })
const ms = (hhmm: string) => Date.parse(ist(D, hhmm))
const span = (r: { start: number; end: number }) => [new Date(r.start).toISOString(), new Date(r.end).toISOString()]
const call = at('Call', '16:00', '16:30', { fixed: true })

describe('fixedBlocks', () => {
  test('fixed, not-skipped tasks other than the one excluded, merged and sorted', () => {
    const sync = at('Sync', '16:15', '17:00', { fixed: true })
    const skipped = at('Skipped', '18:00', '18:30', { fixed: true, status: 'skipped' })
    const flexible = at('Flexible', '12:00', '13:00')
    expect(fixedBlocks([sync, flexible, call, skipped])).toEqual([{ from: ms('16:00'), to: ms('17:00') }])
    expect(fixedBlocks([call, sync], call.id)).toEqual([{ from: ms('16:15'), to: ms('17:00') }])
  })
})

describe('flowAround', () => {
  const blocks = fixedBlocks([call])

  test('with no fixed tasks the work runs straight through', () => {
    expect(span(flowAround(ms('15:30'), 90, []))).toEqual([ist(D, '15:30'), ist(D, '17:00')])
  })

  test('work that meets a fixed block pauses for it and ends later by the block', () => {
    expect(span(flowAround(ms('15:30'), 90, blocks))).toEqual([ist(D, '15:30'), ist(D, '17:30')])
  })

  test('a start inside a block, or right at its start, waits for the block to end', () => {
    expect(span(flowAround(ms('16:10'), 30, blocks))).toEqual([ist(D, '16:30'), ist(D, '17:00')])
    expect(span(flowAround(ms('16:00'), 30, blocks))).toEqual([ist(D, '16:30'), ist(D, '17:00')])
  })

  test('ending right when a block starts does not jump past it', () => {
    expect(span(flowAround(ms('15:30'), 30, blocks))).toEqual([ist(D, '15:30'), ist(D, '16:00')])
  })

  test('work crossing two blocks skips both', () => {
    const two = fixedBlocks([call, at('Review', '17:00', '17:15', { fixed: true })])
    expect(span(flowAround(ms('15:30'), 90, two))).toEqual([ist(D, '15:30'), ist(D, '17:45')])
  })
})
