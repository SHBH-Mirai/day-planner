import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TodayView } from './TodayView'
import { InMemoryTaskRepository } from '../storage/InMemoryTaskRepository'
import { ist } from '../test-utils/makeTask'

const D = '2026-10-17'
const DAY = new Date('2026-10-17T12:00:00+05:30')

describe('TodayView nudges', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(ist(D, '09:59')))
  })
  afterEach(() => vi.useRealTimers())

  async function setup() {
    const repo = new InMemoryTaskRepository()
    await repo.create({ title: 'Deep work', start: ist(D, '09:00'), end: ist(D, '10:00'), category: 'office' })
    await repo.create({ title: 'Lunch', start: ist(D, '10:00'), end: ist(D, '10:30'), category: 'office' })
    render(<TodayView repo={repo} day={DAY} />)
    await screen.findByRole('article', { name: 'Deep work' })
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    return repo
  }

  test('the STOP nudge appears when a task ends', async () => {
    await setup()
    expect(await screen.findByText('⏹ STOP: Deep work. Done?')).toBeInTheDocument()
  })

  test('Done in the nudge marks the task done and clears the nudge', async () => {
    const repo = await setup()
    const nudge = (await screen.findByText('⏹ STOP: Deep work. Done?')).closest('[role="status"]') as HTMLElement
    await userEvent.click(within(nudge).getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.queryByText('⏹ STOP: Deep work. Done?')).not.toBeInTheDocument())
    const saved = (await repo.listForDay(DAY)).find((t) => t.title === 'Deep work')
    expect(saved?.status).toBe('done')
  })

  test('+15 min extends the task and shows what it pushes back', async () => {
    const repo = await setup()
    const nudge = (await screen.findByText('⏹ STOP: Deep work. Done?')).closest('[role="status"]') as HTMLElement
    await userEvent.click(within(nudge).getByRole('button', { name: '+15 min' }))
    expect(await screen.findByText('Extended to 10:15. Pushes back: Lunch')).toBeInTheDocument()
    await waitFor(async () => {
      const saved = (await repo.listForDay(DAY)).find((t) => t.title === 'Deep work')
      expect(saved).toMatchObject({ end: ist(D, '10:15'), originalEnd: ist(D, '10:00') })
    })
  })

  test('the nudge text follows later changes to its task', async () => {
    await setup()
    await screen.findByText('▶ START: Lunch until 10:30')
    await userEvent.click(within(screen.getByRole('article', { name: 'Lunch' })).getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '2026-10-17T10:45' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('▶ START: Lunch until 10:45')).toBeInTheDocument()
  })

  test('Done on the task card also clears its nudge', async () => {
    await setup()
    await screen.findByText('⏹ STOP: Deep work. Done?')
    await userEvent.click(within(screen.getByRole('article', { name: 'Deep work' })).getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.queryByText('⏹ STOP: Deep work. Done?')).not.toBeInTheDocument())
  })

  test('deleting a task clears its nudge', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await setup()
    await screen.findByText('⏹ STOP: Deep work. Done?')
    await userEvent.click(within(screen.getByRole('article', { name: 'Deep work' })).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByText('⏹ STOP: Deep work. Done?')).not.toBeInTheDocument())
  })

  test('an edit form left open cannot undo a Done', async () => {
    const repo = await setup()
    await userEvent.click(within(screen.getByRole('article', { name: 'Deep work' })).getByRole('button', { name: 'Edit' }))
    const nudge = (await screen.findByText('⏹ STOP: Deep work. Done?')).closest('[role="status"]') as HTMLElement
    await userEvent.click(within(nudge).getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.getByRole('article', { name: 'Deep work' })).toHaveAttribute('data-status', 'done'))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument())
    const saved = (await repo.listForDay(DAY)).find((t) => t.title === 'Deep work')
    expect(saved).toMatchObject({ status: 'done' })
    expect(saved?.actualEnd).toBeTruthy()
  })

  test("today's nudges keep coming while viewing tomorrow", async () => {
    vi.setSystemTime(new Date(ist(D, '09:58')))
    const repo = new InMemoryTaskRepository()
    await repo.create({ title: 'Deep work', start: ist(D, '09:00'), end: ist(D, '10:00'), category: 'office' })
    render(<TodayView repo={repo} day={DAY} />)
    await screen.findByRole('article', { name: 'Deep work' })
    await userEvent.click(screen.getByRole('button', { name: 'Tomorrow' }))
    await screen.findByRole('heading', { name: 'Tomorrow' })
    await act(async () => {
      vi.advanceTimersByTime(3 * 60_000)
    })
    expect(await screen.findByText('⏹ STOP: Deep work. Done?')).toBeInTheDocument()
  })
})
