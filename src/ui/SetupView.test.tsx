import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SetupView } from './SetupView'
import { InMemorySettingsRepository } from '../storage/InMemorySettingsRepository'
import { InMemoryRoutineRepository } from '../storage/InMemoryRoutineRepository'
import { RepositoryError } from '../storage/TaskRepository'
import { routineToDraft } from '../domain/routine'
import { ist, makeTask } from '../test-utils/makeTask'

const DAY = new Date('2026-10-18T12:00:00+05:30')

async function setup(settingsRepo = new InMemorySettingsRepository()) {
  const props = {
    settingsRepo,
    routineRepo: new InMemoryRoutineRepository(),
    day: DAY,
    todayTasks: [],
    addToToday: vi.fn(async () => true),
    onBack: vi.fn(),
    onSettingsSaved: vi.fn(),
  }
  render(<SetupView {...props} />)
  await screen.findByRole('switch', { name: 'Start cards in Teams' })
  return props
}

describe('SetupView, nudges and defaults', () => {
  test('shows the stored settings', async () => {
    const repo = new InMemorySettingsRepository()
    await repo.save({ startNudges: false, endNudges: true, defaultLengthMin: 60 })
    await setup(repo)
    expect(screen.getByRole('switch', { name: 'Start cards in Teams' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: 'Stop cards in Teams' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: '60 min' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('flipping a switch saves it and says so', async () => {
    const repo = new InMemorySettingsRepository()
    const props = await setup(repo)
    await userEvent.click(screen.getByRole('switch', { name: 'Start cards in Teams' }))
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(await repo.get()).toMatchObject({ startNudges: false })
    expect(props.onSettingsSaved).toHaveBeenLastCalledWith({ startNudges: false, endNudges: true, defaultLengthMin: 30 })
  })

  test('choosing a default length saves it', async () => {
    const repo = new InMemorySettingsRepository()
    await setup(repo)
    await userEvent.click(screen.getByRole('button', { name: '45 min' }))
    await waitFor(async () => expect((await repo.get()).defaultLengthMin).toBe(45))
    expect(screen.getByRole('button', { name: '45 min' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('a failed save shows Retry and puts the switch back', async () => {
    const repo = new InMemorySettingsRepository()
    const save = vi.spyOn(repo, 'save').mockRejectedValueOnce(new RepositoryError('network', 'offline'))
    await setup(repo)
    await userEvent.click(screen.getByRole('switch', { name: 'Stop cards in Teams' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save your settings.")
    expect(screen.getByRole('switch', { name: 'Stop cards in Teams' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(async () => expect((await repo.get()).endNudges).toBe(false))
    expect(save).toHaveBeenCalledTimes(2)
  })

  test('Back leaves Setup', async () => {
    const props = await setup()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(props.onBack).toHaveBeenCalledTimes(1)
  })
})

describe('SetupView, routines', () => {
  const gym = { title: 'Gym', category: 'office' as const, startTime: '07:15', durationMin: 45, days: ['Mon', 'Wed'] as ('Mon' | 'Wed')[], active: true }

  async function setupRoutines(opts: { todayTasks?: import('../domain/task').Task[] } = {}) {
    const routineRepo = new InMemoryRoutineRepository()
    const saved = await routineRepo.create(gym)
    const props = {
      settingsRepo: new InMemorySettingsRepository(),
      routineRepo,
      day: DAY,
      todayTasks: opts.todayTasks ?? [],
      addToToday: vi.fn(async () => true),
      onBack: vi.fn(),
    }
    render(<SetupView {...props} />)
    const row = await screen.findByRole('article', { name: 'Gym' })
    return { ...props, saved, row }
  }

  test('lists each routine with its time, length and days', async () => {
    const { row } = await setupRoutines()
    expect(row).toHaveTextContent('07:15 · 45m')
    expect(within(row).getByLabelText('Days: Mon, Wed')).toBeInTheDocument()
  })

  test('+ New routine adds one through the sheet', async () => {
    const { routineRepo } = await setupRoutines()
    await userEvent.click(screen.getByRole('button', { name: 'New routine' }))
    const sheet = screen.getByRole('dialog', { name: 'New routine' })
    await userEvent.type(within(sheet).getByLabelText('Title'), 'Read')
    fireEvent.change(within(sheet).getByLabelText('Start time'), { target: { value: '21:00' } })
    fireEvent.change(within(sheet).getByLabelText('Length (min)'), { target: { value: '30' } })
    await userEvent.click(within(sheet).getByRole('button', { name: 'Tue' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save routine' }))
    expect(await screen.findByRole('article', { name: 'Read' })).toHaveTextContent('21:00 · 30m')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect((await routineRepo.list()).map((r) => r.title)).toEqual(['Gym', 'Read'])
  })

  test('an invalid routine shows what to fix and saves nothing', async () => {
    const { routineRepo } = await setupRoutines()
    await userEvent.click(screen.getByRole('button', { name: 'New routine' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save routine' }))
    const errors = screen.getByRole('alert')
    expect(errors).toHaveTextContent('Add a title')
    expect(errors).toHaveTextContent('Pick at least one day')
    expect(await routineRepo.list()).toHaveLength(1)
  })

  test('Edit opens the form filled in, and saving changes the routine', async () => {
    const { row, routineRepo } = await setupRoutines()
    await userEvent.click(within(row).getByRole('button', { name: 'Edit' }))
    const sheet = screen.getByRole('dialog', { name: 'Edit routine' })
    expect(within(sheet).getByLabelText('Title')).toHaveValue('Gym')
    expect(within(sheet).getByRole('button', { name: 'Mon' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.change(within(sheet).getByLabelText('Length (min)'), { target: { value: '60' } })
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save routine' }))
    await waitFor(async () => expect((await routineRepo.list())[0].durationMin).toBe(60))
  })

  test('clearing a routine description in the sheet clears the saved one', async () => {
    const { row, routineRepo, saved } = await setupRoutines()
    await routineRepo.update({ ...saved, description: 'Old notes' })
    await userEvent.click(within(row).getByRole('button', { name: 'Edit' }))
    const sheet = screen.getByRole('dialog', { name: 'Edit routine' })
    await userEvent.clear(within(sheet).getByLabelText('Description (optional)'))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save routine' }))
    await waitFor(async () => expect((await routineRepo.list())[0].description).toBeUndefined())
  })

  test('the Active switch pauses a routine', async () => {
    const { row, routineRepo } = await setupRoutines()
    await userEvent.click(within(row).getByRole('switch', { name: 'Active: Gym' }))
    await waitFor(async () => expect((await routineRepo.list())[0].active).toBe(false))
  })

  test('Delete asks first; Cancel keeps it, OK sends it to the recycle bin', async () => {
    const { row, routineRepo } = await setupRoutines()
    await userEvent.click(within(row).getByRole('button', { name: 'Delete' }))
    expect(within(row).getByText('Delete "Gym"? It goes to the SharePoint recycle bin.')).toBeInTheDocument()
    await userEvent.click(within(row).getByRole('button', { name: 'Cancel' }))
    expect(await routineRepo.list()).toHaveLength(1)
    await userEvent.click(within(row).getByRole('button', { name: 'Delete' }))
    await userEvent.click(within(row).getByRole('button', { name: 'Yes, delete' }))
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Gym' })).not.toBeInTheDocument())
    expect(await routineRepo.list()).toHaveLength(0)
  })

  test('Add to today adds the routine as today’s task', async () => {
    const { row, addToToday, saved } = await setupRoutines()
    await userEvent.click(within(row).getByRole('button', { name: 'Add to today' }))
    expect(addToToday).toHaveBeenCalledWith(routineToDraft(saved, DAY))
    expect(await within(row).findByText('Added to today')).toBeInTheDocument()
  })

  test('a routine already on today says so instead of adding it twice', async () => {
    const onToday = makeTask({ title: 'Gym', start: ist('2026-10-18', '07:15'), end: ist('2026-10-18', '08:00') })
    const { row, addToToday } = await setupRoutines({ todayTasks: [onToday] })
    expect(within(row).getByText('Already on today')).toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: 'Add to today' })).not.toBeInTheDocument()
    expect(addToToday).not.toHaveBeenCalled()
  })
})

describe('SetupView, review fixes', () => {
  const base = (over: Partial<Parameters<typeof SetupView>[0]> = {}) => ({
    settingsRepo: new InMemorySettingsRepository(),
    routineRepo: new InMemoryRoutineRepository(),
    day: DAY,
    todayTasks: [],
    addToToday: vi.fn(async () => true),
    onBack: vi.fn(),
    ...over,
  })

  test('a routine with a broken start time still shows, marked as needing a fix', async () => {
    const routineRepo = new InMemoryRoutineRepository()
    await routineRepo.create({ title: 'Broken', category: 'office', startTime: '', durationMin: 30, days: ['Mon'], active: true })
    render(<SetupView {...base({ routineRepo })} />)
    const row = await screen.findByRole('article', { name: 'Broken' })
    expect(within(row).getByText('Needs fixing: open Edit')).toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: 'Add to today' })).not.toBeInTheDocument()
  })

  test('Add to today cannot be pressed twice while saving, and a failed add waits for Retry', async () => {
    const routineRepo = new InMemoryRoutineRepository()
    await routineRepo.create({ title: 'Gym', category: 'office', startTime: '18:00', durationMin: 60, days: ['Sun'], active: true })
    let finish!: (ok: boolean) => void
    const addToToday = vi.fn(() => new Promise<boolean>((r) => (finish = r)))
    render(<SetupView {...base({ routineRepo, addToToday })} />)
    const row = await screen.findByRole('article', { name: 'Gym' })
    await userEvent.click(within(row).getByRole('button', { name: 'Add to today' }))
    expect(within(row).getByRole('button', { name: 'Adding…' })).toBeDisabled()
    finish(false)
    expect(await within(row).findByText('Waiting to be saved: press Retry')).toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: 'Add to today' })).not.toBeInTheDocument()
    expect(addToToday).toHaveBeenCalledTimes(1)
  })

  test('settings that fail to load say so, and Retry loads them', async () => {
    const settingsRepo = new InMemorySettingsRepository()
    vi.spyOn(settingsRepo, 'get').mockRejectedValueOnce(new RepositoryError('network', 'offline'))
    render(<SetupView {...base({ settingsRepo })} />)
    expect(await screen.findByText("Couldn't load your settings.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('switch', { name: 'Start cards in Teams' })).toBeInTheDocument()
  })

  test('a failed routine save shows its error inside the sheet', async () => {
    const routineRepo = new InMemoryRoutineRepository()
    vi.spyOn(routineRepo, 'create').mockRejectedValueOnce(new RepositoryError('network', 'offline'))
    render(<SetupView {...base({ routineRepo })} />)
    await userEvent.click(await screen.findByRole('button', { name: 'New routine' }))
    const sheet = screen.getByRole('dialog', { name: 'New routine' })
    await userEvent.type(within(sheet).getByLabelText('Title'), 'Read')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Mon' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save routine' }))
    expect(await within(sheet).findByText("Couldn't save the routine.")).toBeInTheDocument()
  })

  test('a save that worked is not reported as failed when only the reload fails', async () => {
    const routineRepo = new InMemoryRoutineRepository()
    render(<SetupView {...base({ routineRepo })} />)
    await userEvent.click(await screen.findByRole('button', { name: 'New routine' }))
    vi.spyOn(routineRepo, 'list').mockRejectedValue(new RepositoryError('network', 'offline'))
    const sheet = screen.getByRole('dialog', { name: 'New routine' })
    await userEvent.type(within(sheet).getByLabelText('Title'), 'Read')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Mon' }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save routine' }))
    expect(await screen.findByRole('article', { name: 'Read' })).toBeInTheDocument()
    expect(screen.queryByText("Couldn't save the routine.")).not.toBeInTheDocument()
  })

  test('the day chips are read out as a picture of the days', async () => {
    const routineRepo = new InMemoryRoutineRepository()
    await routineRepo.create({ title: 'Gym', category: 'office', startTime: '18:00', durationMin: 60, days: ['Mon', 'Sun'], active: true })
    render(<SetupView {...base({ routineRepo })} />)
    const row = await screen.findByRole('article', { name: 'Gym' })
    expect(within(row).getByRole('img', { name: 'Days: Mon, Sun' })).toBeInTheDocument()
  })
})
