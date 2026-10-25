import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskTable } from './TaskTable'
import type { Task } from '../domain/task'
import { ist, makeTask } from '../test-utils/makeTask'

const D = '2026-10-17'
const s = makeTask({ id: 's', title: 'Standup', start: ist(D, '09:00'), end: ist(D, '09:30') })
const r = makeTask({ id: 'r', title: 'Review', start: ist(D, '10:00'), end: ist(D, '11:00') })

function setup(tasks: Task[]) {
  const h = {
    isNow: () => false,
    onDone: vi.fn(),
    onUndone: vi.fn(),
    onSkip: vi.fn(),
    onUnskip: vi.fn(),
    onRename: vi.fn(),
    onReplan: vi.fn(),
    onPush: vi.fn(),
    onRemove: vi.fn(),
  }
  render(<TaskTable tasks={tasks} {...h} />)
  return h
}

describe('TaskTable', () => {
  test('one row per task in start order, with every control named for its task', () => {
    setup([r, s])
    expect(screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['Standup', 'Review'])
    expect(screen.getByRole('checkbox', { name: 'Done: Standup' })).not.toBeChecked()
    expect(screen.getByRole('textbox', { name: 'Title: Standup' })).toHaveValue('Standup')
    expect(screen.getByLabelText('Start: Standup')).toHaveValue('09:00')
    expect(screen.getByRole('spinbutton', { name: 'Length (min): Standup' })).toHaveValue(30)
    for (const name of ['+30 min: Standup', 'Skip: Standup', 'Remove: Standup']) {
      expect(screen.getByRole('button', { name })).toBeEnabled()
    }
  })

  test('ticking calls onDone; unticking a done task calls onUndone', async () => {
    const done = { ...r, status: 'done' as const }
    const h = setup([s, done])
    await userEvent.click(screen.getByRole('checkbox', { name: 'Done: Standup' }))
    expect(h.onDone).toHaveBeenCalledWith(s)
    expect(screen.getByRole('checkbox', { name: 'Done: Review' })).toBeChecked()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Done: Review' }))
    expect(h.onUndone).toHaveBeenCalledWith(done)
  })

  test('rename saves the trimmed title on Enter', async () => {
    const h = setup([s])
    const box = screen.getByRole('textbox', { name: 'Title: Standup' })
    await userEvent.clear(box)
    await userEvent.type(box, '  Daily sync  {Enter}')
    expect(h.onRename).toHaveBeenCalledExactlyOnceWith(s, 'Daily sync')
  })

  test('an empty title or Esc puts the old title back and saves nothing', async () => {
    const h = setup([s])
    const box = screen.getByRole('textbox', { name: 'Title: Standup' })
    await userEvent.clear(box)
    await userEvent.tab()
    expect(box).toHaveValue('Standup')
    await userEvent.type(box, 'x{Escape}')
    expect(box).toHaveValue('Standup')
    expect(h.onRename).not.toHaveBeenCalled()
  })

  test('a start time commits once, on leaving the box, and keeps the length', () => {
    const h = setup([s])
    const box = screen.getByLabelText('Start: Standup')
    fireEvent.change(box, { target: { value: '10:15' } })
    expect(h.onReplan).not.toHaveBeenCalled()
    fireEvent.blur(box)
    expect(h.onReplan).toHaveBeenCalledExactlyOnceWith(s, ist(D, '10:15'), ist(D, '10:45'))
  })

  test('Esc in the start box puts the old time back', () => {
    const h = setup([s])
    const box = screen.getByLabelText('Start: Standup')
    fireEvent.change(box, { target: { value: '11:00' } })
    fireEvent.keyDown(box, { key: 'Escape' })
    fireEvent.blur(box)
    expect(box).toHaveValue('09:00')
    expect(h.onReplan).not.toHaveBeenCalled()
  })

  test('a length commits on Enter; out of range puts the old one back', async () => {
    const h = setup([s])
    const box = screen.getByRole('spinbutton', { name: 'Length (min): Standup' })
    await userEvent.clear(box)
    await userEvent.type(box, '45{Enter}')
    expect(h.onReplan).toHaveBeenCalledExactlyOnceWith(s, ist(D, '09:00'), ist(D, '09:45'))
    await userEvent.clear(box)
    await userEvent.type(box, '3')
    await userEvent.tab()
    expect(box).toHaveValue(30)
    expect(h.onReplan).toHaveBeenCalledTimes(1)
  })

  test('+30 calls onPush, Skip calls onSkip, and a skipped row offers Unskip', async () => {
    const skipped = { ...r, status: 'skipped' as const }
    const h = setup([s, skipped])
    await userEvent.click(screen.getByRole('button', { name: '+30 min: Standup' }))
    await userEvent.click(screen.getByRole('button', { name: 'Skip: Standup' }))
    await userEvent.click(screen.getByRole('button', { name: 'Unskip: Review' }))
    expect(h.onPush).toHaveBeenCalledWith(s)
    expect(h.onSkip).toHaveBeenCalledWith(s)
    expect(h.onUnskip).toHaveBeenCalledWith(skipped)
  })

  test('Remove asks first', async () => {
    const h = setup([s])
    await userEvent.click(screen.getByRole('button', { name: 'Remove: Standup' }))
    expect(screen.getByText('Delete "Standup"?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(h.onRemove).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Remove: Standup' }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete' }))
    expect(h.onRemove).toHaveBeenCalledWith(s)
  })

  test('done and skipped rows disable start, length and +30', () => {
    setup([
      { ...s, status: 'done' },
      { ...r, status: 'skipped' },
    ])
    for (const title of ['Standup', 'Review']) {
      expect(screen.getByLabelText(`Start: ${title}`)).toBeDisabled()
      expect(screen.getByRole('spinbutton', { name: `Length (min): ${title}` })).toBeDisabled()
      expect(screen.getByRole('button', { name: `+30 min: ${title}` })).toBeDisabled()
    }
    expect(screen.getByRole('button', { name: 'Skip: Standup' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove: Standup' })).toBeEnabled()
  })

  test('each row is a list item holding its article', () => {
    setup([s, r])
    const items = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByRole('article', { name: 'Standup' })).toBeInTheDocument()
  })

  test("a done row's dimming is not overridden by an inline opacity", () => {
    setup([{ ...s, status: 'done' }])
    const row = screen.getByRole('article', { name: 'Standup' })
    expect(row).toHaveAttribute('data-status', 'done')
    expect(row.style.opacity).toBe('')
  })

  test('an empty day renders nothing, like the list', () => {
    setup([])
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})

describe('TaskTable description', () => {
  test('shows the description as one line under the title', () => {
    setup([{ ...s, description: 'Cut\ncaptions' }])
    expect(screen.getByRole('article', { name: 'Standup' }).querySelector('.table-description')).toHaveTextContent('Cut captions')
  })

  test('adds nothing when there is no description', () => {
    setup([s])
    expect(screen.getByRole('article', { name: 'Standup' }).querySelector('.table-description')).toBeNull()
  })
})

describe('TaskTable fixed time', () => {
  test('each row has a pin that toggles fixed time', async () => {
    const onToggleFixed = vi.fn()
    const noop = vi.fn()
    render(
      <TaskTable
        tasks={[s, { ...r, fixed: true }]}
        isNow={() => false}
        onDone={noop}
        onUndone={noop}
        onSkip={noop}
        onUnskip={noop}
        onRename={noop}
        onReplan={noop}
        onPush={noop}
        onRemove={noop}
        onToggleFixed={onToggleFixed}
      />,
    )
    const pin = screen.getByRole('button', { name: 'Fixed: Standup' })
    expect(pin).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Fixed: Review' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(pin)
    expect(onToggleFixed).toHaveBeenCalledWith(s)
  })
})

describe('TaskTable pin hint', () => {
  test('the pin has a tooltip, since it is the only icon-only button', () => {
    const noop = vi.fn()
    render(
      <TaskTable
        tasks={[s]}
        isNow={() => false}
        onDone={noop}
        onUndone={noop}
        onSkip={noop}
        onUnskip={noop}
        onRename={noop}
        onReplan={noop}
        onPush={noop}
        onRemove={noop}
        onToggleFixed={noop}
      />,
    )
    expect(screen.getByRole('button', { name: 'Fixed: Standup' })).toHaveAttribute('title', 'Fixed time')
  })
})

describe('TaskTable pin on closed rows', () => {
  test('done and skipped rows cannot be pinned, like +30', () => {
    const noop = vi.fn()
    render(
      <TaskTable
        tasks={[{ ...s, status: 'done' }, { ...r, status: 'skipped' }]}
        isNow={() => false}
        onDone={noop}
        onUndone={noop}
        onSkip={noop}
        onUnskip={noop}
        onRename={noop}
        onReplan={noop}
        onPush={noop}
        onRemove={noop}
        onToggleFixed={noop}
      />,
    )
    expect(screen.getByRole('button', { name: 'Fixed: Standup' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Fixed: Review' })).toBeDisabled()
  })
})
