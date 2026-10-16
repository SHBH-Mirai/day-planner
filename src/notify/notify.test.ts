import { afterEach, describe, expect, test, vi } from 'vitest'
import { nudgeText, showOsNotification } from './notify'
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
