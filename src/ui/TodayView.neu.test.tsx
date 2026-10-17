import { describe, expect, test, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TodayView } from './TodayView'
import { InMemoryTaskRepository } from '../storage/InMemoryTaskRepository'
import { ist } from '../test-utils/makeTask'

const D = '2026-10-17'
const DAY = new Date('2026-10-17T12:00:00+05:30')
const NOW = new Date('2026-10-17T09:10:00+05:30')

async function seeded(...slots: [string, string, string][]) {
  const repo = new InMemoryTaskRepository()
  for (const [title, from, to] of slots) {
    await repo.create({ title, start: ist(D, from), end: ist(D, to), category: 'office' })
  }
  return repo
}

const findCard = (title: string) => screen.findByRole('article', { name: title })

describe('TodayView, neumorphic layout', () => {
  test('the ring and the focus strip show progress for the day', async () => {
    const repo = await seeded(['Standup', '09:00', '09:15'], ['Deep work', '10:00', '11:00'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    expect(await screen.findByRole('img', { name: '0 of 2 done' })).toBeInTheDocument()
    expect(screen.getByText('Focus today')).toBeInTheDocument()
    expect(screen.getByText('0m / 1h 15m')).toBeInTheDocument()

    await userEvent.click(within(await findCard('Standup')).getByRole('button', { name: 'Done' }))
    expect(await screen.findByRole('img', { name: '1 of 2 done' })).toBeInTheDocument()
  })

  test('a task ticked done hours late, without Started, counts its planned length in the focus strip', async () => {
    const repo = await seeded(['Standup', '09:00', '09:15'])
    const late = new Date('2026-10-17T15:00:00+05:30')
    render(<TodayView repo={repo} day={DAY} now={() => late} />)
    await userEvent.click(within(await findCard('Standup')).getByRole('button', { name: 'Done' }))
    expect(await screen.findByText('15m / 15m')).toBeInTheDocument()
  })

  test('a failed add shows its error and Retry inside the sheet', async () => {
    const repo = new InMemoryTaskRepository()
    vi.spyOn(repo, 'create').mockRejectedValueOnce(new Error('offline'))
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await userEvent.click(screen.getByRole('button', { name: 'New task' }))
    await userEvent.type(screen.getByLabelText('Title'), 'Proposal')
    await userEvent.click(screen.getByRole('button', { name: 'Add task' }))
    const sheet = screen.getByRole('dialog', { name: 'New task' })
    expect(await within(sheet).findByText(/Couldn.t save/)).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  test('pressing Add again after a failed add does not make a duplicate; Retry saves it once and closes the sheet', async () => {
    const repo = new InMemoryTaskRepository()
    const realCreate = repo.create.bind(repo)
    vi.spyOn(repo, 'create').mockRejectedValueOnce(new Error('offline')).mockImplementation(realCreate)
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await userEvent.click(screen.getByRole('button', { name: 'New task' }))
    await userEvent.type(screen.getByLabelText('Title'), 'Proposal')
    await userEvent.click(screen.getByRole('button', { name: 'Add task' }))
    await screen.findByText(/Couldn.t save/)
    await userEvent.click(screen.getByRole('button', { name: 'Add task' }))
    expect(screen.getByText(/Press Retry/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await findCard('Proposal')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await repo.listForDay(DAY)).toHaveLength(1)
  })

  test('marks the task that is running now', async () => {
    const repo = await seeded(['Standup', '09:00', '09:15'], ['Deep work', '10:00', '11:00'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    expect(await findCard('Standup')).toHaveClass('now')
    expect(await findCard('Deep work')).not.toHaveClass('now')
  })

  test('the + button opens a sheet; saving adds the task and closes it', async () => {
    const repo = new InMemoryTaskRepository()
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await userEvent.click(screen.getByRole('button', { name: 'New task' }))
    const sheet = screen.getByRole('dialog', { name: 'New task' })
    await userEvent.type(within(sheet).getByLabelText('Title'), 'Proposal')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add task' }))
    expect(await findCard('Proposal')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  test('Edit opens the sheet filled in with the task', async () => {
    const repo = await seeded(['Standup', '09:00', '09:15'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await userEvent.click(within(await findCard('Standup')).getByRole('button', { name: /Standup/ }))
    await userEvent.click(within(await findCard('Standup')).getByRole('button', { name: 'Edit' }))
    const sheet = screen.getByRole('dialog', { name: 'Edit task' })
    expect(within(sheet).getByLabelText('Title')).toHaveValue('Standup')
  })

  test('closing the sheet drops an unsaved new task', async () => {
    const repo = new InMemoryTaskRepository()
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await userEvent.click(screen.getByRole('button', { name: 'New task' }))
    await userEvent.type(screen.getByLabelText('Title'), 'Half')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await repo.listForDay(DAY)).toHaveLength(0)
  })

  test('+15 min in the row pushes the end back by 15 minutes', async () => {
    const repo = await seeded(['Standup', '09:00', '09:15'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await userEvent.click(within(await findCard('Standup')).getByRole('button', { name: /Standup/ }))
    await userEvent.click(within(await findCard('Standup')).getByRole('button', { name: '+15 min' }))
    await waitFor(async () => {
      const [t] = await repo.listForDay(DAY)
      expect(t.end).toBe(ist(D, '09:30'))
    })
    expect(await findCard('Standup')).toHaveTextContent('09:00–09:30')
  })

  test('the day switch shows Summary in place of the timeline', async () => {
    const repo = await seeded(['Standup', '09:00', '09:15'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await findCard('Standup')
    await userEvent.click(screen.getByRole('button', { name: 'Summary' }))
    expect(screen.getByRole('button', { name: 'Summary' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('table', { name: 'Tasks' })).toBeInTheDocument()
  })
})
