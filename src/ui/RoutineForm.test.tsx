import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RoutineForm } from './RoutineForm'
import type { Routine } from '../domain/routine'

const gym: Routine = { id: 'r1', title: 'Gym', category: 'office', startTime: '07:15', durationMin: 45, days: ['Mon'], active: true }
const desc = () => screen.getByLabelText('Description (optional)')

describe('RoutineForm description', () => {
  test('shows the saved description when editing', () => {
    render(<RoutineForm initial={{ ...gym, description: 'Warm up first' }} onSubmit={vi.fn(async () => true)} onCancel={vi.fn()} />)
    expect(desc()).toHaveValue('Warm up first')
  })

  test('submits it trimmed', async () => {
    const onSubmit = vi.fn(async () => true)
    render(<RoutineForm initial={gym} onSubmit={onSubmit} onCancel={vi.fn()} />)
    fireEvent.change(desc(), { target: { value: '  Scene, record  ' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save routine' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ description: 'Scene, record' }))
  })

  test('over 500 characters shows the error and does not submit', async () => {
    const onSubmit = vi.fn(async () => true)
    render(<RoutineForm initial={gym} onSubmit={onSubmit} onCancel={vi.fn()} />)
    fireEvent.change(desc(), { target: { value: 'x'.repeat(501) } })
    await userEvent.click(screen.getByRole('button', { name: 'Save routine' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Keep the description under 500 characters')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test('clearing it submits description: undefined, with the key present', async () => {
    const onSubmit = vi.fn(async (_draft: object) => true)
    render(<RoutineForm initial={{ ...gym, description: 'Old' }} onSubmit={onSubmit} onCancel={vi.fn()} />)
    await userEvent.clear(desc())
    await userEvent.click(screen.getByRole('button', { name: 'Save routine' }))
    const draft = onSubmit.mock.calls[0][0]
    expect('description' in draft).toBe(true)
    expect((draft as { description?: string }).description).toBeUndefined()
  })
})

describe('RoutineForm description layout', () => {
  test('the description comes after Category', () => {
    render(<RoutineForm initial={gym} onSubmit={vi.fn(async () => true)} onCancel={vi.fn()} />)
    expect(screen.getByLabelText('Category').compareDocumentPosition(desc()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
