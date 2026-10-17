import { describe, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SetupView } from './SetupView'
import { InMemorySettingsRepository } from '../storage/InMemorySettingsRepository'
import { InMemoryRoutineRepository } from '../storage/InMemoryRoutineRepository'
import { RepositoryError } from '../storage/TaskRepository'

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
