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
    ['2026-10-24', '11:00', '13:00', 'planned', 'recording'],
    ['2026-10-12', '09:00', '11:00', 'done', 'office'],
  ])

/** The local date `n` days before `from`, as yyyy-mm-dd. */
function daysBefore(from: Date, n: number): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('WeekView', () => {
  test('the focus headline: done time, done and skipped counts, and the same time last week', async () => {
    render(<WeekView repo={await week()} now={THU} />)
    expect(await screen.findByRole('heading', { name: 'This week' })).toBeInTheDocument()
    expect(screen.getByText('Mon 19 Oct – Sun 25 Oct')).toBeInTheDocument()
    const totals = screen.getByRole('group', { name: 'Week totals' })
    expect(totals).toHaveTextContent('Focus3h')
    expect(totals).toHaveTextContent('3 done · 1 skipped')
    expect(totals).toHaveTextContent('+1h vs same time last week')
  })

  test('one bar per day, Monday first; each says its done and planned time, and today is marked', async () => {
    render(<WeekView repo={await week()} now={THU} />)
    const days = within(await screen.findByRole('list', { name: 'Focus by day' })).getAllByRole('listitem')
    expect(days).toHaveLength(7)
    expect(days[0]).toHaveTextContent('Monday: 1h done of 1h 30m planned')
    expect(days[3]).toHaveTextContent('Thursday, today: 0m done of 1h planned')
    expect(days[3]).toHaveAttribute('aria-current', 'date')
    expect(days[5]).toHaveTextContent('Saturday: 0m done of 2h planned')
    expect(days[5]).toHaveAttribute('data-future', 'true')
  })

  test('where the time went: done time only, by category, most first', async () => {
    render(<WeekView repo={await week()} now={THU} />)
    const bar = await screen.findByRole('img', { name: 'Time by category this week' })
    const segments = within(bar).getAllByLabelText(/min$/).map((s) => s.getAttribute('aria-label'))
    expect(segments).toEqual(['Content 120 min', 'Office 60 min'])
  })

  test('the streak, the nudge to keep it today, and the category streaks', async () => {
    render(<WeekView repo={await week()} now={THU} />)
    expect(await screen.findByText('3-day streak')).toBeInTheDocument()
    expect(screen.getByText('Finish one today to keep it going.')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Category streaks' })).toHaveTextContent('Content · 2 days')
  })

  test('a 28-day run ending yesterday shows as 28+ days, not 27', async () => {
    const rows = Array.from({ length: 28 }, (_, n) => [daysBefore(THU, n + 1), '09:00', '09:30', 'done', 'office'] as [string, string, string, Status, Category])
    render(<WeekView repo={await seeded(rows)} now={THU} />)
    expect(await screen.findByText('28+ days in a row')).toBeInTheDocument()
  })

  test("today's live tasks count straight away, without reloading", async () => {
    const repo = await seeded([['2026-10-22', '09:00', '10:00', 'planned', 'learning']])
    const [planned] = await repo.listForDay(THU)
    render(<WeekView repo={repo} now={THU} live={[{ day: THU, tasks: [{ ...planned, status: 'done' }] }]} />)
    expect(await screen.findByText('1-day streak')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Week totals' })).toHaveTextContent('Focus1h')
  })

  test('an empty month shows zero, no comparison, and invites a first streak', async () => {
    render(<WeekView repo={new InMemoryTaskRepository()} now={THU} />)
    expect(await screen.findByText('A new streak starts with your next finished task.')).toBeInTheDocument()
    const totals = screen.getByRole('group', { name: 'Week totals' })
    expect(totals).toHaveTextContent('Focus0m')
    expect(totals).not.toHaveTextContent('last week')
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
    render(<WeekView repo={repo} now={THU} />)
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load your week.")
    repo.fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { name: 'This week' })).toBeInTheDocument()
  })

  test('says it is loading until the tasks arrive', () => {
    render(<WeekView repo={new InMemoryTaskRepository()} now={THU} />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading your week…')
  })
})
