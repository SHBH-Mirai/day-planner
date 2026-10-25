import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskForm } from './TaskForm'
import { ist, makeTask } from '../test-utils/makeTask'

const DAY = new Date('2026-10-17T12:00:00+05:30')

function fill(title: string, start: string, end: string) {
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: title } })
  fireEvent.change(screen.getByLabelText('Start'), { target: { value: start } })
  fireEvent.change(screen.getByLabelText('End'), { target: { value: end } })
}

describe('TaskForm', () => {
  test('the pre-filled slot follows tasks that arrive later, until you change a time', () => {
    const standup = makeTask({ title: 'Standup', start: ist('2026-10-17', '09:00'), end: ist('2026-10-17', '09:15') })
    const gym = makeTask({ title: 'Gym', start: ist('2026-10-17', '18:00'), end: ist('2026-10-17', '19:00') })
    const onSubmit = vi.fn(async () => true)
    const { rerender } = render(<TaskForm day={DAY} others={[]} onSubmit={onSubmit} />)
    expect(screen.getByLabelText('Start')).toHaveValue('2026-10-17T09:00')
    rerender(<TaskForm day={DAY} others={[standup]} onSubmit={onSubmit} />)
    expect(screen.getByLabelText('Start')).toHaveValue('2026-10-17T09:15')
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2026-10-17T11:00' } })
    rerender(<TaskForm day={DAY} others={[standup, gym]} onSubmit={onSubmit} />)
    expect(screen.getByLabelText('Start')).toHaveValue('2026-10-17T11:00')
    expect(screen.getByLabelText('End')).toHaveValue('2026-10-17T09:45')
  })

  test('end before start shows an error and does not submit', async () => {
    const onSubmit = vi.fn(async () => true)
    render(<TaskForm day={DAY} others={[]} onSubmit={onSubmit} />)
    fill('Proposal', '2026-10-17T10:00', '2026-10-17T09:00')
    await userEvent.click(screen.getByRole('button', { name: 'Add task' }))
    expect(screen.getByText('End must be after start')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test('an overlap shows a warning but still submits', async () => {
    const onSubmit = vi.fn(async () => true)
    const standup = makeTask({ title: 'Standup', start: ist('2026-10-17', '09:00'), end: ist('2026-10-17', '09:15') })
    render(<TaskForm day={DAY} others={[standup]} onSubmit={onSubmit} />)
    fill('Proposal', '2026-10-17T09:10', '2026-10-17T10:00')
    expect(screen.getByText('Overlaps Standup (09:00–09:15)')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add task' }))
    expect(onSubmit).toHaveBeenCalledOnce()
  })

  test('submits UTC ISO times and the chosen category', async () => {
    const onSubmit = vi.fn(async () => true)
    render(<TaskForm day={DAY} others={[]} onSubmit={onSubmit} />)
    fill('Edit video', '2026-10-17T21:00', '2026-10-17T22:30')
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'youtube')
    await userEvent.click(screen.getByRole('button', { name: 'Add task' }))
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Edit video',
      start: ist('2026-10-17', '21:00'),
      end: ist('2026-10-17', '22:30'),
      category: 'youtube',
    })
  })

  test('pre-fills the slot after the last task', () => {
    const last = makeTask({ start: ist('2026-10-17', '09:00'), end: ist('2026-10-17', '10:00') })
    render(<TaskForm day={DAY} others={[last]} onSubmit={vi.fn(async () => true)} />)
    expect(screen.getByLabelText('Start')).toHaveValue('2026-10-17T10:00')
    expect(screen.getByLabelText('End')).toHaveValue('2026-10-17T10:30')
  })

  test('keeps what was typed when saving fails', async () => {
    render(<TaskForm day={DAY} others={[]} onSubmit={vi.fn(async () => false)} />)
    fill('Keep me', '2026-10-17T09:00', '2026-10-17T10:00')
    await userEvent.click(screen.getByRole('button', { name: 'Add task' }))
    expect(screen.getByLabelText('Title')).toHaveValue('Keep me')
  })
})

describe('TaskForm default length', () => {
  test('a new task is as long as the default length from Setup', () => {
    render(<TaskForm day={DAY} others={[]} onSubmit={vi.fn(async () => true)} defaultLengthMin={45} />)
    expect(screen.getByLabelText('Start')).toHaveValue('2026-10-17T09:00')
    expect(screen.getByLabelText('End')).toHaveValue('2026-10-17T09:45')
  })

  test('editing a task keeps its own times, whatever the default length', () => {
    const standup = makeTask({ title: 'Standup', start: ist('2026-10-17', '09:00'), end: ist('2026-10-17', '09:15') })
    render(<TaskForm day={DAY} others={[]} initial={standup} onSubmit={vi.fn(async () => true)} defaultLengthMin={90} />)
    expect(screen.getByLabelText('End')).toHaveValue('2026-10-17T09:15')
  })
})

describe('TaskForm description', () => {
  const desc = () => screen.getByLabelText('Description (optional)')

  test('shows the saved description when editing', () => {
    render(<TaskForm day={DAY} others={[]} initial={makeTask({ description: 'Old steps' })} onSubmit={vi.fn(async () => true)} />)
    expect(desc()).toHaveValue('Old steps')
  })

  test('submits the description trimmed', async () => {
    const onSubmit = vi.fn(async () => true)
    render(<TaskForm day={DAY} others={[]} onSubmit={onSubmit} />)
    fill('Edit video', '2026-10-17T09:00', '2026-10-17T10:00')
    fireEvent.change(desc(), { target: { value: '  Cut, captions  ' } })
    await userEvent.click(screen.getByRole('button', { name: 'Add task' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ description: 'Cut, captions' }))
  })

  test('over 500 characters shows the error and does not submit', async () => {
    const onSubmit = vi.fn(async () => true)
    render(<TaskForm day={DAY} others={[]} onSubmit={onSubmit} />)
    fill('Edit video', '2026-10-17T09:00', '2026-10-17T10:00')
    fireEvent.change(desc(), { target: { value: 'x'.repeat(501) } })
    await userEvent.click(screen.getByRole('button', { name: 'Add task' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Keep the description under 500 characters')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test('a counter shows from 400 characters', () => {
    render(<TaskForm day={DAY} others={[]} onSubmit={vi.fn(async () => true)} />)
    fireEvent.change(desc(), { target: { value: 'x'.repeat(399) } })
    expect(screen.queryByText('399/500')).not.toBeInTheDocument()
    fireEvent.change(desc(), { target: { value: 'x'.repeat(400) } })
    expect(screen.getByText('400/500')).toBeInTheDocument()
  })

  test('clearing it submits description: undefined, with the key present', async () => {
    const onSubmit = vi.fn(async (_draft: object) => true)
    render(<TaskForm day={DAY} others={[]} initial={makeTask({ description: 'Old steps' })} onSubmit={onSubmit} />)
    await userEvent.clear(desc())
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    const draft = onSubmit.mock.calls[0][0]
    expect('description' in draft).toBe(true)
    expect((draft as { description?: string }).description).toBeUndefined()
  })
})

describe('TaskForm description layout', () => {
  const desc = () => screen.getByLabelText('Description (optional)')
  const counter = () => document.getElementById(desc().getAttribute('aria-describedby') ?? '')

  test('the description comes after Category, so it never pushes the times down', () => {
    render(<TaskForm day={DAY} others={[]} onSubmit={vi.fn(async () => true)} />)
    expect(screen.getByLabelText('Category').compareDocumentPosition(desc()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('the counter is linked to the box, reserved while short, and flagged when over', () => {
    render(<TaskForm day={DAY} others={[]} onSubmit={vi.fn(async () => true)} />)
    expect(counter()).not.toBeNull()
    expect(counter()).toHaveTextContent('')
    fireEvent.change(desc(), { target: { value: 'x'.repeat(450) } })
    expect(counter()).toHaveTextContent('450/500')
    expect(counter()).not.toHaveClass('form-count-over')
    fireEvent.change(desc(), { target: { value: 'x'.repeat(501) } })
    expect(counter()).toHaveTextContent('501/500')
    expect(counter()).toHaveClass('form-count-over')
  })
})

describe('TaskForm categories', () => {
  test('the picker offers the nine categories in order', () => {
    render(<TaskForm day={DAY} others={[]} onSubmit={vi.fn(async () => true)} />)
    const options = Array.from((screen.getByLabelText('Category') as HTMLSelectElement).options).map((o) => o.text)
    expect(options).toEqual(['Office', 'Projects', 'Content', 'Recording', 'Editing', 'Learning', 'Health', 'Personal', 'Breaks & meals'])
  })
})

describe('TaskForm fixed time', () => {
  const sw = () => screen.getByRole('switch', { name: 'Fixed time (meeting, call)' })

  test('a new task starts flexible and can be made fixed', async () => {
    const onSubmit = vi.fn(async () => true)
    render(<TaskForm day={DAY} others={[]} onSubmit={onSubmit} />)
    expect(sw()).toHaveAttribute('aria-checked', 'false')
    fill('Team call', '2026-10-17T16:00', '2026-10-17T16:30')
    await userEvent.click(sw())
    await userEvent.click(screen.getByRole('button', { name: 'Add task' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ fixed: true }))
  })

  test('editing a fixed task shows it on, and turning it off submits false', async () => {
    const onSubmit = vi.fn(async (_d: object) => true)
    render(<TaskForm day={DAY} others={[]} initial={makeTask({ fixed: true })} onSubmit={onSubmit} />)
    expect(sw()).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(sw())
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    const draft = onSubmit.mock.calls[0][0] as { fixed?: boolean }
    expect('fixed' in draft).toBe(true)
    expect(draft.fixed).toBeFalsy()
  })

  test('a flexible task over a fixed one notes the pause instead of warning', () => {
    const call = makeTask({ title: 'Call', start: ist('2026-10-17', '16:00'), end: ist('2026-10-17', '16:30'), fixed: true })
    render(<TaskForm day={DAY} others={[call]} onSubmit={vi.fn(async () => true)} />)
    fill('Deep work', '2026-10-17T15:30', '2026-10-17T17:30')
    expect(screen.getByText('Pauses for Call (16:00–16:30)')).toBeInTheDocument()
    expect(screen.queryByText(/Overlaps Call/)).not.toBeInTheDocument()
  })
})

describe('TaskForm fixed time, the switch row', () => {
  test('tapping the words turns the switch on, and a hint says what fixed means', async () => {
    render(<TaskForm day={DAY} others={[]} onSubmit={vi.fn(async () => true)} />)
    await userEvent.click(screen.getByText('Fixed time (meeting, call)'))
    expect(screen.getByRole('switch', { name: 'Fixed time (meeting, call)' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Other tasks pause around it and never move it.')).toBeInTheDocument()
  })
})
