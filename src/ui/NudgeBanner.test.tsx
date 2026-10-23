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
    onExtend: vi.fn(() => ({ newEnd: ist(D, '10:30'), moved: [lunch] })),
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

  test('an end nudge offers Done, +30 min and Skip', async () => {
    const h = setup([nudge('end')])
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(h.onDone).toHaveBeenCalledWith(task.id)
    expect(h.onSkip).toHaveBeenCalledWith(task.id)
  })

  test('+30 min shows the new end and what moved', async () => {
    const h = setup([nudge('end')])
    await userEvent.click(screen.getByRole('button', { name: '+30 min' }))
    expect(h.onExtend).toHaveBeenCalledWith(task.id)
    expect(screen.getByText('Extended to 10:30. Moved: Lunch')).toBeInTheDocument()
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

describe('NudgeBanner inside Teams', () => {
  const handlers = {
    onStarted: vi.fn(),
    onDone: vi.fn(),
    onSkip: vi.fn(),
    onExtend: vi.fn(() => ({ newEnd: ist(D, '10:15'), moved: [] })),
    onDismiss: vi.fn(),
    onEnableNotifications: vi.fn(),
  }

  test('does not warn that pop-ups are blocked (Teams cards do the nudging)', () => {
    render(<NudgeBanner nudges={[]} permission="denied" askForNotifications={false} {...handlers} />)
    expect(screen.queryByText(/Notifications are blocked/)).not.toBeInTheDocument()
  })

  test('does not offer to enable pop-ups either', () => {
    render(<NudgeBanner nudges={[]} permission="default" askForNotifications={false} {...handlers} />)
    expect(screen.queryByRole('button', { name: 'Enable notifications' })).not.toBeInTheDocument()
  })

  test('still shows a due nudge', () => {
    render(<NudgeBanner nudges={[nudge('end')]} permission="denied" askForNotifications={false} {...handlers} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

describe('NudgeBanner description', () => {
  test('a nudge shows the task description', () => {
    const described = { ...task, description: 'Open the proposal doc first' }
    setup([{ key: `${task.id}-start`, kind: 'start', task: described, missed: false }])
    expect(document.querySelector('.nudge-description')).toHaveTextContent('Open the proposal doc first')
  })

  test('adds nothing when there is no description', () => {
    setup([nudge('start')])
    expect(document.querySelector('.nudge-description')).toBeNull()
  })
})

describe('NudgeBanner description placement', () => {
  test('"missed at" stays next to the nudge text, before the description', () => {
    const described = { ...task, description: 'Open the proposal doc first' }
    setup([{ key: `${task.id}-start`, kind: 'start', task: described, missed: true }])
    const missed = screen.getByText(/missed at/)
    const desc = document.querySelector('.nudge-description')!
    expect(missed.compareDocumentPosition(desc) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
