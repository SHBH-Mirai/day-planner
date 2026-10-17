import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Switch } from './Switch'

describe('Switch', () => {
  it('is a named switch showing its state', () => {
    render(<Switch label="Start cards in Teams" checked onChange={vi.fn()} />)
    expect(screen.getByRole('switch', { name: 'Start cards in Teams' })).toHaveAttribute('aria-checked', 'true')
  })

  it('asks to flip on click and on Space', async () => {
    const onChange = vi.fn()
    render(<Switch label="Active" checked={false} onChange={onChange} />)
    const sw = screen.getByRole('switch', { name: 'Active' })
    await userEvent.click(sw)
    sw.focus()
    await userEvent.keyboard(' ')
    expect(onChange).toHaveBeenNthCalledWith(1, true)
    expect(onChange).toHaveBeenNthCalledWith(2, true)
  })

  it('can be disabled', async () => {
    const onChange = vi.fn()
    render(<Switch label="Active" checked={false} onChange={onChange} disabled />)
    await userEvent.click(screen.getByRole('switch', { name: 'Active' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
