import { describe, expect, test, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TodayView } from './TodayView'
import { InMemoryTaskRepository } from '../storage/InMemoryTaskRepository'
import { InMemorySettingsRepository } from '../storage/InMemorySettingsRepository'
import { InMemoryRoutineRepository } from '../storage/InMemoryRoutineRepository'
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

  test('ticking a task done offers Undo, and Undo puts it back to planned', async () => {
    const repo = await seeded(['Standup', '09:00', '09:15'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await userEvent.click(within(await findCard('Standup')).getByRole('button', { name: 'Done' }))
    const bar = await screen.findByRole('status', { name: 'Undo' })
    expect(bar).toHaveTextContent('Marked done: Standup')
    await userEvent.click(within(bar).getByRole('button', { name: 'Undo' }))
    await waitFor(async () => {
      const [t] = await repo.listForDay(DAY)
      expect(t).toMatchObject({ status: 'planned' })
      expect(t.actualEnd).toBeUndefined()
    })
    expect(within(await findCard('Standup')).getByRole('button', { name: 'Done' })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Undo' })).not.toBeInTheDocument()
  })

  test('Skip offers Undo too', async () => {
    const repo = await seeded(['Gym', '18:00', '19:00'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await userEvent.click(within(await findCard('Gym')).getByRole('button', { name: /Gym/ }))
    await userEvent.click(within(await findCard('Gym')).getByRole('button', { name: 'Skip' }))
    const bar = await screen.findByRole('status', { name: 'Undo' })
    expect(bar).toHaveTextContent('Skipped: Gym')
    await userEvent.click(within(bar).getByRole('button', { name: 'Undo' }))
    await waitFor(async () => expect((await repo.listForDay(DAY))[0].status).toBe('planned'))
  })

  test('the Undo bar goes away by itself after 6 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const repo = await seeded(['Standup', '09:00', '09:15'])
      render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
      await userEvent.click(within(await findCard('Standup')).getByRole('button', { name: 'Done' }))
      expect(await screen.findByRole('status', { name: 'Undo' })).toBeInTheDocument()
      await act(async () => {
        vi.advanceTimersByTime(6_100)
      })
      expect(screen.queryByRole('status', { name: 'Undo' })).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  test('the ring leaves skipped tasks out of the total', async () => {
    const repo = await seeded(['Standup', '09:00', '09:15'], ['Gym', '18:00', '19:00'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await userEvent.click(within(await findCard('Gym')).getByRole('button', { name: /Gym/ }))
    await userEvent.click(within(await findCard('Gym')).getByRole('button', { name: 'Skip' }))
    expect(await screen.findByRole('img', { name: '0 of 1 done' })).toBeInTheDocument()
  })

  test('+15 min in a row says the new end and what it pushes back', async () => {
    const repo = await seeded(['Standup', '09:00', '09:15'], ['Review', '09:20', '10:00'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await userEvent.click(within(await findCard('Standup')).getByRole('button', { name: /Standup/ }))
    await userEvent.click(within(await findCard('Standup')).getByRole('button', { name: '+15 min' }))
    expect(await screen.findByText('Standup: extended to 09:30. Now overlaps: Review')).toBeInTheDocument()
  })

  test('the "now" marker moves on the minute, not up to a minute late', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      vi.setSystemTime(new Date('2026-10-17T09:10:50+05:30'))
      const repo = await seeded(['Standup', '09:11', '09:30'])
      render(<TodayView repo={repo} day={DAY} />)
      expect(await findCard('Standup')).not.toHaveClass('now')
      await act(async () => {
        vi.advanceTimersByTime(11_000)
      })
      expect(await findCard('Standup')).toHaveClass('now')
    } finally {
      vi.useRealTimers()
    }
  })

  test('the task list is visible straight away, not faded out waiting for animations', async () => {
    const repo = await seeded(['Standup', '09:00', '09:15'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    const card = await findCard('Standup')
    expect(card.closest('ol')).not.toHaveStyle({ opacity: '0' })
  })

  test('deleting a task right after Done removes its Undo, so Undo cannot save a deleted task', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const repo = await seeded(['Standup', '09:00', '09:15'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await userEvent.click(within(await findCard('Standup')).getByRole('button', { name: 'Done' }))
    expect(await screen.findByRole('status', { name: 'Undo' })).toBeInTheDocument()
    await userEvent.click(within(await findCard('Standup')).getByRole('button', { name: /Standup/ }))
    await userEvent.click(within(await findCard('Standup')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Undo' })).not.toBeInTheDocument())
  })

  test('switching day clears the Undo bar', async () => {
    const repo = await seeded(['Standup', '09:00', '09:15'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
    await userEvent.click(within(await findCard('Standup')).getByRole('button', { name: 'Done' }))
    expect(await screen.findByRole('status', { name: 'Undo' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tomorrow' }))
    expect(screen.queryByRole('status', { name: 'Undo' })).not.toBeInTheDocument()
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

describe('TodayView inside Teams', () => {
  test('hides the blocked-pop-ups warning in Teams, but keeps it in a browser', async () => {
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission: vi.fn() })
    try {
      const repo = new InMemoryTaskRepository()
      const { unmount } = render(<TodayView repo={repo} day={DAY} now={() => NOW} inTeams />)
      await screen.findByRole('heading', { name: 'Today' })
      expect(screen.queryByText(/Notifications are blocked/)).not.toBeInTheDocument()
      unmount()

      render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
      expect(await screen.findByText(/Notifications are blocked/)).toBeInTheDocument()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('TodayView, Setup', () => {
  const withRepos = async () => {
    const settingsRepo = new InMemorySettingsRepository()
    const routineRepo = new InMemoryRoutineRepository()
    await routineRepo.create({ title: 'Gym', category: 'office', startTime: '18:00', durationMin: 60, days: ['Sun'], active: true })
    return { settingsRepo, routineRepo }
  }

  test('there is no gear without the settings and routines lists', async () => {
    render(<TodayView repo={new InMemoryTaskRepository()} day={DAY} now={() => NOW} />)
    await screen.findByRole('heading', { name: 'Today' })
    expect(screen.queryByRole('button', { name: 'Setup' })).not.toBeInTheDocument()
  })

  test('the gear opens Setup in place of the day, and Back returns to the same tab', async () => {
    const repos = await withRepos()
    const repo = await seeded(['Standup', '09:00', '09:15'])
    render(<TodayView repo={repo} day={DAY} now={() => NOW} {...repos} />)
    await findCard('Standup')
    await userEvent.click(screen.getByRole('button', { name: 'Tomorrow' }))
    await userEvent.click(screen.getByRole('button', { name: 'Setup' }))
    expect(await screen.findByRole('region', { name: 'Setup' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New task' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('heading', { name: 'Tomorrow' })).toBeInTheDocument()
  })

  test('Add to today in Setup puts the routine on today’s list', async () => {
    const repos = await withRepos()
    const repo = new InMemoryTaskRepository()
    render(<TodayView repo={repo} day={DAY} now={() => NOW} {...repos} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Setup' }))
    const row = await screen.findByRole('article', { name: 'Gym' })
    await userEvent.click(within(row).getByRole('button', { name: 'Add to today' }))
    expect(await within(row).findByText('Added to today')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await findCard('Gym')).toBeInTheDocument()
  })

  test('a new default length from Setup is used by the + form', async () => {
    const repos = await withRepos()
    render(<TodayView repo={new InMemoryTaskRepository()} day={DAY} now={() => NOW} {...repos} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Setup' }))
    await userEvent.click(await screen.findByRole('button', { name: '60 min' }))
    await screen.findByText('Saved')
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    await userEvent.click(screen.getByRole('button', { name: 'New task' }))
    expect(screen.getByLabelText('Start')).toHaveValue('2026-10-17T09:00')
    expect(screen.getByLabelText('End')).toHaveValue('2026-10-17T10:00')
  })

  test('the default length saved earlier is used straight away', async () => {
    const repos = await withRepos()
    await repos.settingsRepo.save({ startNudges: true, endNudges: true, defaultLengthMin: 45 })
    render(<TodayView repo={new InMemoryTaskRepository()} day={DAY} now={() => NOW} {...repos} />)
    await screen.findByRole('heading', { name: 'Today' })
    await waitFor(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'New task' }))
      expect(screen.getByLabelText('End')).toHaveValue('2026-10-17T09:45')
    })
  })
})

describe('TodayView, Setup sees the latest today', () => {
  test('a task the Morning flow added after the app opened counts as already on today', async () => {
    const settingsRepo = new InMemorySettingsRepository()
    const routineRepo = new InMemoryRoutineRepository()
    await routineRepo.create({ title: 'Gym', category: 'office', startTime: '18:00', durationMin: 60, days: ['Sat'], active: true })
    const repo = new InMemoryTaskRepository()
    render(<TodayView repo={repo} day={DAY} now={() => NOW} settingsRepo={settingsRepo} routineRepo={routineRepo} />)
    await screen.findByRole('heading', { name: 'Today' })
    await repo.create({ title: 'Gym', start: ist(D, '18:00'), end: ist(D, '19:00'), category: 'office' })
    await userEvent.click(screen.getByRole('button', { name: 'Setup' }))
    const row = await screen.findByRole('article', { name: 'Gym' })
    expect(await within(row).findByText('Already on today')).toBeInTheDocument()
  })
})
