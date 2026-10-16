import { describe, expect, test, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TodayView } from './TodayView'
import { InMemoryTaskRepository } from '../storage/InMemoryTaskRepository'
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
    await userEvent.click(within(await findCard('Gym')).getByRole('button', { name: 'Skip' }))
    await waitFor(() => expect(card('Gym')).toHaveAttribute('data-status', 'skipped'))
  })

  test('Delete removes the task after confirming', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const repo = await seeded(['Gym', '18:00', '19:00'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await userEvent.click(within(await findCard('Gym')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Gym' })).not.toBeInTheDocument())
    expect(await repo.listForDay(DAY)).toEqual([])
  })

  test('a failed save shows Retry, and Retry saves it', async () => {
    const repo = new InMemoryTaskRepository()
    const realCreate = repo.create.bind(repo)
    vi.spyOn(repo, 'create').mockRejectedValueOnce(new Error('offline')).mockImplementation(realCreate)
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
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
    await userEvent.click(within(await findCard('Standup')).getByRole('button', { name: 'Edit' }))
    const title = screen.getByLabelText('Title')
    await userEvent.clear(title)
    await userEvent.type(title, 'Team sync')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await findCard('Team sync')).toBeInTheDocument()
  })

  test('Summary button shows the summary', async () => {
    const repo = await seeded(['Standup', '09:00', '09:15'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await findCard('Standup')
    await userEvent.click(screen.getByRole('button', { name: 'Summary' }))
    expect(screen.getByRole('table', { name: 'Tasks' })).toBeInTheDocument()
  })
})
