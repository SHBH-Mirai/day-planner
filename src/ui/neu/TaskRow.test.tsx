import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskRow } from './TaskRow'
import type { Task } from '../../domain/task'

const task = (over: Partial<Task> = {}): Task => ({
  id: '1',
  title: 'Standup',
  start: new Date(2026, 9, 17, 9, 0).toISOString(),
  end: new Date(2026, 9, 17, 9, 30).toISOString(),
  originalEnd: new Date(2026, 9, 17, 9, 30).toISOString(),
  category: 'office',
  status: 'planned',
  ...over,
})

function setup(t: Task = task(), isNow = false) {
  const h = {
    onDone: vi.fn(),
    onStarted: vi.fn(),
    onPlus15: vi.fn(),
    onSkip: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  }
  render(
    <ul>
      <TaskRow task={t} isNow={isNow} {...h} />
    </ul>,
  )
  const row = screen.getByRole('article', { name: t.title })
  return { h, row, toggle: () => within(row).getByRole('button', { name: /Standup/ }) }
}

describe('TaskRow', () => {
  it('shows the time, title, category and length', () => {
    const { row } = setup()
    expect(row).toHaveTextContent('09:00–09:30')
    expect(row).toHaveTextContent('Standup')
    expect(row).toHaveTextContent('Office')
    expect(row).toHaveTextContent('30m')
  })

  it('ticks a task done with the round button', async () => {
    const { h, row } = setup()
    await userEvent.click(within(row).getByRole('button', { name: 'Done' }))
    expect(h.onDone).toHaveBeenCalledTimes(1)
  })

  it('keeps its actions folded away until the row is tapped', async () => {
    const { row, toggle } = setup()
    expect(within(row).queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument()
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(toggle())
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    for (const name of ['Started', '+15 min', 'Skip', 'Edit', 'Delete']) {
      expect(within(row).getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it('runs each folded action', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { h, row, toggle } = setup()
    await userEvent.click(toggle())
    await userEvent.click(within(row).getByRole('button', { name: 'Started' }))
    await userEvent.click(within(row).getByRole('button', { name: '+15 min' }))
    await userEvent.click(within(row).getByRole('button', { name: 'Skip' }))
    await userEvent.click(within(row).getByRole('button', { name: 'Edit' }))
    await userEvent.click(within(row).getByRole('button', { name: 'Delete' }))
    expect(h.onStarted).toHaveBeenCalledTimes(1)
    expect(h.onPlus15).toHaveBeenCalledTimes(1)
    expect(h.onSkip).toHaveBeenCalledTimes(1)
    expect(h.onEdit).toHaveBeenCalledTimes(1)
    expect(h.onDelete).toHaveBeenCalledTimes(1)
  })

  it('asks before deleting, and keeps the task when you cancel', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { h, row, toggle } = setup()
    await userEvent.click(toggle())
    await userEvent.click(within(row).getByRole('button', { name: 'Delete' }))
    expect(confirm).toHaveBeenCalledWith('Delete "Standup"?')
    expect(h.onDelete).not.toHaveBeenCalled()
  })

  it('folds back on Esc and returns focus to the row', async () => {
    const { row, toggle } = setup()
    await userEvent.click(toggle())
    within(row).getByRole('button', { name: 'Edit' }).focus()
    await userEvent.keyboard('{Escape}')
    expect(within(row).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(toggle()).toHaveFocus()
  })

  it('hides Started once the task has started', async () => {
    const { row, toggle } = setup(task({ actualStart: new Date(2026, 9, 17, 9, 1).toISOString() }))
    await userEvent.click(toggle())
    expect(within(row).queryByRole('button', { name: 'Started' })).not.toBeInTheDocument()
  })

  it('shows a finished task as done, with only Edit and Delete', async () => {
    const { row, toggle } = setup(task({ status: 'done' }))
    expect(row).toHaveTextContent('✓')
    expect(within(row).queryByRole('button', { name: 'Done' })).not.toBeInTheDocument()
    await userEvent.click(toggle())
    expect(within(row).queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('marks the task that is running now', () => {
    const { row } = setup(task(), true)
    expect(row).toHaveClass('now')
    expect(row).toHaveTextContent('Now')
  })
})
