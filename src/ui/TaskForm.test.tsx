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
