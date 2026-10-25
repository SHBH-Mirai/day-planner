import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TodayView } from './TodayView'
import { InMemoryTaskRepository } from '../storage/InMemoryTaskRepository'
import { RepositoryError } from '../storage/TaskRepository'
import { ist } from '../test-utils/makeTask'

const D = '2026-10-17'
const DAY = new Date('2026-10-17T12:00:00+05:30')
const NOW = new Date('2026-10-17T09:30:00+05:30')

async function seeded(...slots: [string, string, string][]) {
  const repo = new InMemoryTaskRepository()
  for (const [title, from, to] of slots) {
    await repo.create({ title, start: ist(D, from), end: ist(D, to), category: 'office' })
  }
  return repo
}

const card = (title: string) => screen.getByRole('article', { name: title })
const findCard = (title: string) => screen.findByRole('article', { name: title })
// The new layout: actions unfold when you tap a row; new tasks are added in a sheet opened by the + button.
const unfold = async (title: string) =>
  userEvent.click(within(await findCard(title)).getByRole('button', { name: new RegExp(title) }))
const openNewTask = () => userEvent.click(screen.getByRole('button', { name: 'New task' }))

describe('TodayView', () => {
  test('shows tasks in time order with times and category', async () => {
    const repo = await seeded(['Lunch', '13:00', '13:30'], ['Standup', '09:00', '09:15'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    const cards = await screen.findAllByRole('article')
    expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual(['Standup', 'Lunch'])
    expect(within(cards[0]).getByText('09:00–09:15')).toBeInTheDocument()
    expect(cards[0]).toHaveAttribute('data-category', 'office')
  })

  test('Started records actualStart, Done records status and actualEnd', async () => {
    const repo = await seeded(['Standup', '09:00', '09:15'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await unfold('Standup')
    await userEvent.click(within(await findCard('Standup')).getByRole('button', { name: 'Started' }))
    await waitFor(() => expect(within(card('Standup')).queryByRole('button', { name: 'Started' })).not.toBeInTheDocument())
    await userEvent.click(within(card('Standup')).getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(card('Standup')).toHaveAttribute('data-status', 'done'))
    const [saved] = await repo.listForDay(DAY)
    expect(saved).toMatchObject({ status: 'done', actualStart: NOW.toISOString(), actualEnd: NOW.toISOString() })
  })

  test('Skip marks the task skipped', async () => {
    const repo = await seeded(['Gym', '18:00', '19:00'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await unfold('Gym')
    await userEvent.click(within(await findCard('Gym')).getByRole('button', { name: 'Skip' }))
    await waitFor(() => expect(card('Gym')).toHaveAttribute('data-status', 'skipped'))
  })

  test('Delete removes the task after confirming', async () => {
    const repo = await seeded(['Gym', '18:00', '19:00'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await unfold('Gym')
    await userEvent.click(within(await findCard('Gym')).getByRole('button', { name: 'Delete' }))
    await userEvent.click(within(await findCard('Gym')).getByRole('button', { name: 'Yes, delete' }))
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Gym' })).not.toBeInTheDocument())
    expect(await repo.listForDay(DAY)).toEqual([])
  })

  test('a failed save shows Retry, and Retry saves it', async () => {
    const repo = new InMemoryTaskRepository()
    const realCreate = repo.create.bind(repo)
    vi.spyOn(repo, 'create').mockRejectedValueOnce(new Error('offline')).mockImplementation(realCreate)
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await openNewTask()
    await userEvent.type(await screen.findByLabelText('Title'), 'Proposal')
    await userEvent.click(screen.getByRole('button', { name: 'Add task' }))
    expect(await screen.findByText(/Couldn.t save/)).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveValue('Proposal')
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await findCard('Proposal')).toBeInTheDocument()
  })

  test('warns about 3 hours without a break', async () => {
    const repo = await seeded(['A', '09:00', '10:00'], ['B', '10:05', '11:00'], ['C', '11:05', '12:00'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    expect(await screen.findByText('3h+ without a break: 09:00–12:00')).toBeInTheDocument()
  })

  test('Edit changes a task', async () => {
    const repo = await seeded(['Standup', '09:00', '09:15'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await unfold('Standup')
    await userEvent.click(within(await findCard('Standup')).getByRole('button', { name: 'Edit' }))
    const title = screen.getByLabelText('Title')
    await userEvent.clear(title)
    await userEvent.type(title, 'Team sync')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await findCard('Team sync')).toBeInTheDocument()
  })

  test('clearing the description in the edit sheet clears the saved one', async () => {
    const repo = new InMemoryTaskRepository()
    await repo.create({ title: 'Standup', start: ist(D, '09:00'), end: ist(D, '09:15'), category: 'office', description: 'Old notes' })
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await unfold('Standup')
    await userEvent.click(within(await findCard('Standup')).getByRole('button', { name: 'Edit' }))
    await userEvent.clear(screen.getByLabelText('Description (optional)'))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(async () => expect((await repo.listForDay(DAY))[0].description).toBeUndefined())
  })

  test('an edit that keeps the times keeps originalEnd (an extend stays an overrun)', async () => {
    const repo = await seeded(['Standup', '09:00', '09:15'])
    const [standup] = await repo.listForDay(DAY)
    await repo.update({ ...standup, end: ist(D, '09:30') }) // as if +15 was pressed
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await unfold('Standup')
    await userEvent.click(within(await findCard('Standup')).getByRole('button', { name: 'Edit' }))
    await userEvent.type(screen.getByLabelText('Title'), ' notes')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await findCard('Standup notes')
    const [saved] = await repo.listForDay(DAY)
    expect(saved).toMatchObject({ end: ist(D, '09:30'), originalEnd: ist(D, '09:15') })
  })

  test('an edit that moves the times re-plans originalEnd', async () => {
    const repo = await seeded(['Standup', '09:00', '09:15'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await unfold('Standup')
    await userEvent.click(within(await findCard('Standup')).getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '2026-10-17T09:45' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument())
    const [saved] = await repo.listForDay(DAY)
    expect(saved).toMatchObject({ end: ist(D, '09:45'), originalEnd: ist(D, '09:45') })
  })

  test('Summary button shows the summary', async () => {
    const repo = await seeded(['Standup', '09:00', '09:15'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await findCard('Standup')
    await userEvent.click(screen.getByRole('button', { name: 'Summary' }))
    expect(screen.getByRole('table', { name: 'Tasks' })).toBeInTheDocument()
  })

  test('a failed save stays visible and flagged even after a later save succeeds', async () => {
    const repo = await seeded(['Standup', '09:00', '09:15'], ['Gym', '18:00', '19:00'])
    const realUpdate = repo.update.bind(repo)
    vi.spyOn(repo, 'update').mockRejectedValueOnce(new Error('offline')).mockImplementation(realUpdate)
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await userEvent.click(within(await findCard('Standup')).getByRole('button', { name: 'Done' }))
    expect(await screen.findByText(/Couldn.t save/)).toBeInTheDocument()
    expect(card('Standup')).toHaveAttribute('data-status', 'done')
    await unfold('Gym')
    await userEvent.click(within(card('Gym')).getByRole('button', { name: 'Skip' }))
    await waitFor(() => expect(card('Gym')).toHaveAttribute('data-status', 'skipped'))
    expect(screen.getByText(/Couldn.t save/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.queryByText(/Couldn.t save/)).not.toBeInTheDocument())
    const saved = await repo.listForDay(DAY)
    expect(saved.find((t) => t.title === 'Standup')?.status).toBe('done')
  })

  test('a load failure is not hidden by a later successful save', async () => {
    const repo = new InMemoryTaskRepository()
    vi.spyOn(repo, 'listForDay').mockRejectedValueOnce(new Error('offline'))
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    expect(await screen.findByText(/Couldn.t load/)).toBeInTheDocument()
    await openNewTask()
    await userEvent.type(screen.getByLabelText('Title'), 'Proposal')
    await userEvent.click(screen.getByRole('button', { name: 'Add task' }))
    await findCard('Proposal')
    expect(screen.getByText(/Couldn.t load/)).toBeInTheDocument()
  })

  test('the new-task form pre-fills after tasks that load after it mounts', async () => {
    const repo = await seeded(['Standup', '09:00', '09:15'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await findCard('Standup')
    await openNewTask()
    expect(screen.getByLabelText('Start')).toHaveValue('2026-10-17T09:15')
    expect(screen.getByLabelText('End')).toHaveValue('2026-10-17T09:45')
  })

  test("Tomorrow shows and saves tomorrow's plan, separate from today", async () => {
    const repo = await seeded(['Standup', '09:00', '09:15'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await findCard('Standup')
    await userEvent.click(screen.getByRole('button', { name: 'Tomorrow' }))
    expect(await screen.findByRole('heading', { name: 'Tomorrow' })).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Standup' })).not.toBeInTheDocument()
    await openNewTask()
    expect(screen.getByLabelText('Start')).toHaveValue('2026-10-18T09:00')
    await userEvent.type(screen.getByLabelText('Title'), 'Gym')
    await userEvent.click(screen.getByRole('button', { name: 'Add task' }))
    expect(await findCard('Gym')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(await findCard('Standup')).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Gym' })).not.toBeInTheDocument()
    expect(await repo.listForDay(new Date('2026-10-18T12:00:00+05:30'))).toHaveLength(1)
  })

  test('a task dated another day is not listed under today, and says where it went', async () => {
    const repo = new InMemoryTaskRepository()
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await openNewTask()
    await userEvent.type(await screen.findByLabelText('Title'), 'Edit video')
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2026-10-18T10:00' } })
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '2026-10-18T11:00' } })
    await userEvent.click(screen.getByRole('button', { name: 'Add task' }))
    expect(await screen.findByText('Saved for Sunday 18 October')).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Edit video' })).not.toBeInTheDocument()
  })

  test('an expired sign-in shows Sign in again instead of leaving the page', async () => {
    const repo = await seeded(['Standup', '09:00', '09:15'])
    vi.spyOn(repo, 'update').mockRejectedValue(new RepositoryError('auth', 'Sign-in expired'))
    const onSignInAgain = vi.fn()
    render(<TodayView repo={repo} day={DAY} now={() => NOW} onSignInAgain={onSignInAgain} />)
    await userEvent.click(within(await findCard('Standup')).getByRole('button', { name: 'Done' }))
    expect(await screen.findByText(/Your Microsoft sign-in expired/)).toBeInTheDocument()
    expect(card('Standup')).toHaveAttribute('data-status', 'done')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in again' }))
    expect(onSignInAgain).toHaveBeenCalledOnce()
  })

  test('an expired sign-in while loading also offers Sign in again', async () => {
    const repo = new InMemoryTaskRepository()
    vi.spyOn(repo, 'listForDay').mockRejectedValue(new RepositoryError('auth', 'Sign-in expired'))
    render(<TodayView repo={repo} day={DAY} now={() => NOW} onSignInAgain={vi.fn()} />)
    expect(await screen.findByRole('button', { name: 'Sign in again' })).toBeInTheDocument()
  })
})

describe('TodayView Week segment', () => {
  test('Week shows the weekly review, hides the day strip, and Today brings the list back', async () => {
    const repo = await seeded(['Standup', '09:00', '09:15'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await findCard('Standup')
    await userEvent.click(screen.getByRole('button', { name: 'Week' }))
    expect(await screen.findByRole('heading', { name: 'This week' })).toBeInTheDocument()
    expect(screen.queryByText('Focus today')).not.toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Standup' })).not.toBeInTheDocument()
    const view = screen.getByRole('group', { name: 'View' })
    expect(within(view).getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true')
    for (const other of ['Today', 'Tomorrow', 'Summary']) {
      expect(within(view).getByRole('button', { name: other })).toHaveAttribute('aria-pressed', 'false')
    }
    await userEvent.click(within(view).getByRole('button', { name: 'Today' }))
    expect(await findCard('Standup')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'This week' })).not.toBeInTheDocument()
  })

  test('Summary and Week switch to each other', async () => {
    render(<TodayView repo={await seeded(['Standup', '09:00', '09:15'])} day={DAY} now={() => NOW} />)
    await findCard('Standup')
    await userEvent.click(screen.getByRole('button', { name: 'Week' }))
    await screen.findByRole('heading', { name: 'This week' })
    await userEvent.click(screen.getByRole('button', { name: 'Summary' }))
    expect(screen.queryByRole('heading', { name: 'This week' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Summary' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('TodayView, reorder', () => {
  const at = async (repo: InMemoryTaskRepository, title: string) => (await repo.listForDay(DAY)).find((t) => t.title === title)!

  test('ArrowUp on the handle moves B above A, both re-timed; Undo puts them back', async () => {
    const repo = await seeded(['A', '16:00', '17:30'], ['B', '17:00', '17:30'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    const handle = await screen.findByRole('button', { name: 'Reorder B' })
    handle.focus()
    await userEvent.keyboard('{ArrowUp}')
    await waitFor(async () => expect((await at(repo, 'B')).start).toBe(ist(D, '16:00')))
    expect((await at(repo, 'A')).start).toBe(ist(D, '16:30'))
    const bar = await screen.findByRole('status', { name: 'Undo' })
    expect(bar).toHaveTextContent('Moved B to 16:00 · A now 16:30')
    await userEvent.click(within(bar).getByRole('button', { name: 'Undo' }))
    await waitFor(async () => expect((await at(repo, 'B')).start).toBe(ist(D, '17:00')))
  })

  test('Move down in the unfolded row moves A below B', async () => {
    const repo = await seeded(['A', '16:00', '17:00'], ['B', '17:00', '17:30'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await unfold('A')
    await userEvent.click(within(card('A')).getByRole('button', { name: 'Move down' }))
    await waitFor(async () => expect((await at(repo, 'A')).start).toBe(ist(D, '16:30')))
    expect((await at(repo, 'B')).start).toBe(ist(D, '16:00'))
  })

  test('the first task has no Move up, and a done task has no handle', async () => {
    const repo = await seeded(['A', '16:00', '17:00'], ['B', '17:00', '17:30'])
    const b = (await repo.listForDay(DAY)).find((t) => t.title === 'B')!
    await repo.update({ ...b, status: 'done' })
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await unfold('A')
    expect(within(card('A')).queryByRole('button', { name: 'Move up' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reorder B' })).not.toBeInTheDocument()
  })
})

describe('TodayView, drag to reorder', () => {
  test('dragging A by its handle below B moves it there, with a drop line while dragging', async () => {
    const repo = await seeded(['A', '16:00', '17:00'], ['B', '17:00', '17:30'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    const handle = await screen.findByRole('button', { name: 'Reorder A' })
    const rows = () => [...document.querySelectorAll<HTMLElement>('[data-task-id]')]
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const i = rows().indexOf(this)
      return { top: i * 50, height: 50, bottom: i * 50 + 50, left: 0, right: 300, width: 300, x: 0, y: i * 50, toJSON: () => ({}) } as DOMRect
    })
    fireEvent(handle, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientY: 10 }))
    fireEvent(window, new MouseEvent('pointermove', { clientY: 90 }))
    await waitFor(() => expect(rows()[1]).toHaveAttribute('data-drop', 'after'))
    fireEvent(window, new MouseEvent('pointerup', { clientY: 90 }))
    const at = async (title: string) => (await repo.listForDay(DAY)).find((t) => t.title === title)!
    await waitFor(async () => expect((await at('A')).start).toBe(ist(D, '16:30')))
    expect((await at('B')).start).toBe(ist(D, '16:00'))
    expect(rows().some((r) => r.hasAttribute('data-drop'))).toBe(false)
    rect.mockRestore()
  })
})

describe('TodayView, keyboard reorder keeps going', () => {
  test('ArrowDown twice moves A to the end, the bar names A, and focus stays on its handle', async () => {
    const repo = await seeded(['A', '16:00', '16:30'], ['B', '16:30', '17:00'], ['C', '17:00', '17:30'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    const handle = await screen.findByRole('button', { name: 'Reorder A' })
    expect(handle).toHaveAttribute('title', 'Drag, or press the up and down arrow keys')
    handle.focus()
    await userEvent.keyboard('{ArrowDown}')
    const at = async (title: string) => (await repo.listForDay(DAY)).find((t) => t.title === title)!
    await waitFor(async () => expect((await at('A')).start).toBe(ist(D, '16:30')))
    expect(await screen.findByRole('status', { name: 'Undo' })).toHaveTextContent('Moved A to 16:30 · B now 16:00')
    await waitFor(() => expect(document.activeElement).toHaveAccessibleName('Reorder A'))
    await userEvent.keyboard('{ArrowDown}')
    await waitFor(async () => expect((await at('A')).start).toBe(ist(D, '17:00')))
    expect((await at('C')).start).toBe(ist(D, '16:30'))
  })
})
