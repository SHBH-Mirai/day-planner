import { afterEach, describe, expect, test, vi } from 'vitest'
import { firstLine, nudgeText, showOsNotification } from './notify'
import type { Nudge } from '../scheduler/dueNudges'
import { ist, makeTask } from '../test-utils/makeTask'

const task = makeTask({ title: 'Write proposal', start: ist('2026-10-17', '09:00'), end: ist('2026-10-17', '10:00') })
const nudge = (kind: 'start' | 'end', missed = false): Nudge => ({ key: `k-${kind}`, kind, task, missed })

function mockNotification(permission: NotificationPermission) {
  const ctor = vi.fn()
  vi.stubGlobal('Notification', Object.assign(ctor, { permission }))
  return ctor
}

afterEach(() => vi.unstubAllGlobals())

describe('nudgeText', () => {
  test('start nudge', () => {
    expect(nudgeText(nudge('start'))).toBe('▶ START: Write proposal until 10:00')
  })
  test('end nudge', () => {
    expect(nudgeText(nudge('end'))).toBe('⏹ STOP: Write proposal. Done?')
  })
})

describe('showOsNotification', () => {
  test('shows a notification when permission is granted', () => {
    const ctor = mockNotification('granted')
    expect(showOsNotification(nudge('start'))).toBe(true)
    expect(ctor).toHaveBeenCalledWith('▶ START: Write proposal until 10:00', { tag: 'k-start' })
  })

  test('does nothing when permission is denied', () => {
    const ctor = mockNotification('denied')
    expect(showOsNotification(nudge('start'))).toBe(false)
    expect(ctor).not.toHaveBeenCalled()
  })

  test('missed nudges never pop an OS notification', () => {
    const ctor = mockNotification('granted')
    expect(showOsNotification(nudge('end', true))).toBe(false)
    expect(ctor).not.toHaveBeenCalled()
  })

  test('browsers without the Notification API are handled', () => {
    vi.stubGlobal('Notification', undefined)
    expect(showOsNotification(nudge('start'))).toBe(false)
  })
})

describe('pop-up body', () => {
  test('firstLine takes the first line, or nothing', () => {
    expect(firstLine('Open the doc\nThen write')).toBe('Open the doc')
    expect(firstLine(undefined)).toBeUndefined()
  })

  test('the pop-up body is the first line of the description', () => {
    const ctor = mockNotification('granted')
    showOsNotification({ key: 'k-start', kind: 'start', task: { ...task, description: 'Open the doc\nThen write' }, missed: false })
    expect(ctor).toHaveBeenCalledWith(nudgeText(nudge('start')), { tag: 'k-start', body: 'Open the doc' })
  })

  test('no description, no body', () => {
    const ctor = mockNotification('granted')
    showOsNotification(nudge('start'))
    expect(ctor.mock.calls[0][1]).not.toHaveProperty('body')
  })
})
