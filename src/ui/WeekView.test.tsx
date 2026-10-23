import { describe, expect, test } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WeekView } from './WeekView'
import { InMemoryTaskRepository } from '../storage/InMemoryTaskRepository'
import { RepositoryError } from '../storage/TaskRepository'
import type { Category, Status } from '../domain/task'
import { ist } from '../test-utils/makeTask'

/** Thursday, mid-day, IST. */
const THU = new Date('2026-10-22T12:00:00+05:30')

async function seeded(rows: [string, string, string, Status, Category][]) {
  const repo = new InMemoryTaskRepository()
  for (const [day, from, to, status, category] of rows) {
    const t = await repo.create({ title: `${category} ${day} ${from}`, start: ist(day, from), end: ist(day, to), category })
    if (status !== 'planned') await repo.update({ ...t, status })
  }
  return repo
}

const week = () =>
  seeded([
    ['2026-10-19', '09:00', '10:00', 'done', 'office'],
    ['2026-10-19', '11:00', '11:30', 'planned', 'youtube'],
    ['2026-10-20', '10:00', '11:00', 'done', 'youtube'],
    ['2026-10-21', '10:00', '11:00', 'done', 'youtube'],
    ['2026-10-21', '12:00', '12:30', 'skipped', 'learning'],
    ['2026-10-22', '15:00', '16:00', 'planned', 'office'],
    ['2026-10-12', '09:00', '11:00', 'done', 'office'],
  ])

describe('WeekView', () => {
  test('shows the week, its focus time against last week, and done and skipped counts', async () => {
    render(<WeekView repo={await week()} today={THU} />)
    expect(await screen.findByRole('heading', { name: 'This week' })).toBeInTheDocument()
    expect(screen.getByText('Mon 19 Oct – Sun 25 Oct')).toBeInTheDocument()
    const totals = screen.getByRole('group', { name: 'Week totals' })
    expect(totals).toHaveTextContent('Focus3h')
    expect(totals).toHaveTextContent('+1h vs last week')
    expect(totals).toHaveTextContent('Done3')
    expect(totals).toHaveTextContent('Skipped1')
  })

  test('one bar per day, Monday first, each labelled with done and planned time', async () => {
    render(<WeekView repo={await week()} today={THU} />)
    const days = within(await screen.findByRole('list', { name: 'Focus by day' })).getAllByRole('listitem')
    expect(days).toHaveLength(7)
    expect(days[0]).toHaveAccessibleName('Monday: 1h done of 1h 30m planned')
    expect(days[3]).toHaveAttribute('data-today', 'true')
    expect(days[4]).toHaveAttribute('data-future', 'true')
  })

  test('where the time went: done time only, by category', async () => {
    render(<WeekView repo={await week()} today={THU} />)
    const bar = await screen.findByRole('img', { name: 'Time by category this week' })
    expect(within(bar).getByLabelText('Office 60 min')).toBeInTheDocument()
    expect(within(bar).getByLabelText('Content 120 min')).toBeInTheDocument()
    expect(within(bar).queryByLabelText(/Learning/)).not.toBeInTheDocument()
  })

  test('the streak and the category streaks', async () => {
    render(<WeekView repo={await week()} today={THU} />)
    expect(await screen.findByText('🔥 3-day streak')).toBeInTheDocument()
    expect(screen.getByText('🎬 Content · 2 days')).toBeInTheDocument()
  })

  test('an empty month still shows the week at zero and invites a first streak', async () => {
    render(<WeekView repo={new InMemoryTaskRepository()} today={THU} />)
    expect(await screen.findByText('No streak yet. Tick a task done today to start one.')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Week totals' })).toHaveTextContent('Focus0m')
    expect(screen.getByRole('group', { name: 'Week totals' })).toHaveTextContent('Same as last week')
    expect(screen.queryByRole('img', { name: 'Time by category this week' })).not.toBeInTheDocument()
  })

  test('a failed load says so, and Retry loads again', async () => {
    class Flaky extends InMemoryTaskRepository {
      fail = true
      async listRange(from: Date, days: number) {
        if (this.fail) throw new RepositoryError('network')
        return super.listRange(from, days)
      }
    }
    const repo = new Flaky()
    render(<WeekView repo={repo} today={THU} />)
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load your week.")
    repo.fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { name: 'This week' })).toBeInTheDocument()
  })

  test('says it is loading until the tasks arrive', () => {
    render(<WeekView repo={new InMemoryTaskRepository()} today={THU} />)
    expect(screen.getByText('Loading your week…')).toBeInTheDocument()
  })
})
