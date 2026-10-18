import { beforeEach, describe, expect, test } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TodayView } from './TodayView'
import type { Task } from '../domain/task'
import { InMemoryTaskRepository } from '../storage/InMemoryTaskRepository'
import { InMemorySettingsRepository } from '../storage/InMemorySettingsRepository'
import { InMemoryRoutineRepository } from '../storage/InMemoryRoutineRepository'
import { ist } from '../test-utils/makeTask'

const D = '2026-10-17'
const DAY = new Date('2026-10-17T12:00:00+05:30')
const NOW = new Date('2026-10-17T09:10:00+05:30')

async function seeded() {
  const repo = new InMemoryTaskRepository()
  await repo.create({ title: 'Standup', start: ist(D, '09:00'), end: ist(D, '09:15'), category: 'office' })
  await repo.create({ title: 'Review', start: ist(D, '09:20'), end: ist(D, '10:00'), category: 'office' })
  return repo
}

const byTitle = (tasks: Task[], title: string) => tasks.find((t) => t.title === title)!
const table = async () => userEvent.click(await screen.findByRole('button', { name: 'Table' }))
const saved = async (repo: InMemoryTaskRepository, title: string) => byTitle(await repo.listForDay(DAY), title)

describe('TodayView, task table', () => {
  beforeEach(() => localStorage.clear())

  test('the switch shows on Today and Tomorrow, not in Summary or Setup', async () => {
    const repo = await seeded()
    render(
      <TodayView repo={repo} day={DAY} now={() => NOW} settingsRepo={new InMemorySettingsRepository()} routineRepo={new InMemoryRoutineRepository()} />,
    )
    expect(await screen.findByRole('group', { name: 'Layout' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tomorrow' }))
    expect(screen.getByRole('group', { name: 'Layout' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Summary' }))
    expect(screen.queryByRole('group', { name: 'Layout' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Today' }))
    await userEvent.click(screen.getByRole('button', { name: 'Setup' }))
    expect(screen.queryByRole('group', { name: 'Layout' })).not.toBeInTheDocument()
  })

  test('Table shows the day as a table, and the choice survives a reload', async () => {
    const repo = await seeded()
    const { unmount } = render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await table()
    expect(await screen.findByRole('checkbox', { name: 'Done: Standup' })).toBeInTheDocument()
    unmount()
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    expect(await screen.findByRole('checkbox', { name: 'Done: Standup' })).toBeInTheDocument()
  })

  test('+30 in the table moves the chain, and Undo puts it all back', async () => {
    const repo = await seeded()
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await table()
    await userEvent.click(await screen.findByRole('button', { name: '+30 min: Standup' }))
    expect(await screen.findByText('Standup: ends at 09:45. Moved Review by 30 min.')).toBeInTheDocument()
    await waitFor(async () => expect(await saved(repo, 'Review')).toMatchObject({ start: ist(D, '09:50'), end: ist(D, '10:30') }))
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(async () => {
      expect((await saved(repo, 'Standup')).end).toBe(ist(D, '09:15'))
      expect(await saved(repo, 'Review')).toMatchObject({ start: ist(D, '09:20'), end: ist(D, '10:00') })
    })
  })

  test('a later start time re-plans and pushes the chain', async () => {
    const repo = await seeded()
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await table()
    const box = await screen.findByLabelText('Start: Standup')
    fireEvent.change(box, { target: { value: '09:10' } })
    fireEvent.blur(box)
    await waitFor(async () => {
      expect(await saved(repo, 'Standup')).toMatchObject({ start: ist(D, '09:10'), end: ist(D, '09:25'), originalEnd: ist(D, '09:25') })
      expect(await saved(repo, 'Review')).toMatchObject({ start: ist(D, '09:30'), end: ist(D, '10:10') })
    })
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
  })

  test('moving a task earlier moves nothing else and re-sorts the rows', async () => {
    const repo = await seeded()
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await table()
    const box = await screen.findByLabelText('Start: Review')
    fireEvent.change(box, { target: { value: '08:30' } })
    fireEvent.blur(box)
    await waitFor(() => expect(screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['Review', 'Standup']))
    expect(await saved(repo, 'Standup')).toMatchObject({ start: ist(D, '09:00'), end: ist(D, '09:15') })
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  })

  test('two +30s in a row move the chain twice', async () => {
    const repo = await seeded()
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await table()
    await userEvent.click(await screen.findByRole('button', { name: '+30 min: Standup' }))
    await waitFor(async () => expect((await saved(repo, 'Review')).start).toBe(ist(D, '09:50')))
    await userEvent.click(screen.getByRole('button', { name: '+30 min: Standup' }))
    await waitFor(async () => {
      expect((await saved(repo, 'Standup')).end).toBe(ist(D, '10:15'))
      expect(await saved(repo, 'Review')).toMatchObject({ start: ist(D, '10:20'), end: ist(D, '11:00') })
    })
  })

  test('renaming a task the push moved drops the Undo, so Undo can never revert the rename', async () => {
    const repo = await seeded()
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await table()
    await userEvent.click(await screen.findByRole('button', { name: '+30 min: Standup' }))
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeInTheDocument()
    const title = screen.getByRole('textbox', { name: 'Title: Review' })
    await userEvent.clear(title)
    await userEvent.type(title, 'Code review{Enter}')
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument())
    expect((await repo.listForDay(DAY)).map((t) => t.title)).toContain('Code review')
  })

  test('starting a task the push moved drops the Undo', async () => {
    const repo = await seeded()
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    const card = (title: string) => screen.findByRole('article', { name: title })
    await userEvent.click(within(await card('Standup')).getByRole('button', { name: /Standup/ }))
    await userEvent.click(within(await card('Standup')).getByRole('button', { name: '+30 min' }))
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeInTheDocument()
    await userEvent.click(within(await card('Review')).getByRole('button', { name: /Review/ }))
    await userEvent.click(within(await card('Review')).getByRole('button', { name: 'Started' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument())
  })

  test('Done and rename in the table save', async () => {
    const repo = await seeded()
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await table()
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Done: Standup' }))
    await waitFor(async () => expect((await saved(repo, 'Standup')).status).toBe('done'))
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
    const title = screen.getByRole('textbox', { name: 'Title: Review' })
    await userEvent.clear(title)
    await userEvent.type(title, 'Code review{Enter}')
    await waitFor(async () => expect((await repo.listForDay(DAY)).map((t) => t.title)).toContain('Code review'))
  })
})
