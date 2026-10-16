import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NudgeBanner } from './NudgeBanner'
import type { Nudge } from '../scheduler/dueNudges'
import { ist, makeTask } from '../test-utils/makeTask'

const D = '2026-10-17'
const task = makeTask({ title: 'Write proposal', start: ist(D, '09:00'), end: ist(D, '10:00') })
const lunch = makeTask({ title: 'Lunch', start: ist(D, '10:00'), end: ist(D, '10:30') })
const nudge = (kind: 'start' | 'end', missed = false): Nudge => ({ key: `${task.id}-${kind}`, kind, task, missed })

function setup(nudges: Nudge[], permission: NotificationPermission | 'unsupported' = 'granted') {
  const handlers = {
    onStarted: vi.fn(),
    onDone: vi.fn(),
    onSkip: vi.fn(),
    onExtend: vi.fn(() => ({ newEnd: ist(D, '10:15'), affected: [lunch] })),
    onDismiss: vi.fn(),
    onEnableNotifications: vi.fn(),
  }
  render(<NudgeBanner nudges={nudges} permission={permission} {...handlers} />)
  return handlers
}

describe('NudgeBanner', () => {
  test('a start nudge shows its text and a Started button', async () => {
    const h = setup([nudge('start')])
    expect(screen.getByText('▶ START: Write proposal until 10:00')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Started' }))
    expect(h.onStarted).toHaveBeenCalledWith(task.id)
  })

  test('an end nudge offers Done, +15 min and Skip', async () => {
    const h = setup([nudge('end')])
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(h.onDone).toHaveBeenCalledWith(task.id)
    expect(h.onSkip).toHaveBeenCalledWith(task.id)
  })

  test('+15 min shows the new end and what it pushes back', async () => {
    const h = setup([nudge('end')])
    await userEvent.click(screen.getByRole('button', { name: '+15 min' }))
    expect(h.onExtend).toHaveBeenCalledWith(task.id)
    expect(screen.getByText('Extended to 10:15. Pushes back: Lunch')).toBeInTheDocument()
  })

  test('a missed nudge says when it was due', () => {
    setup([nudge('start', true)])
    expect(screen.getByText('missed at 09:00')).toBeInTheDocument()
  })

  test('asks to enable notifications while permission is undecided', async () => {
    const h = setup([], 'default')
    await userEvent.click(screen.getByRole('button', { name: 'Enable notifications' }))
    expect(h.onEnableNotifications).toHaveBeenCalledOnce()
  })

  test('explains blocked notifications', () => {
    setup([], 'denied')
    expect(screen.getByText(/Notifications are blocked/)).toBeInTheDocument()
  })
})
