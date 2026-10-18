import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmButton } from './ConfirmButton'

function setup() {
  const onConfirm = vi.fn()
  render(<ConfirmButton label="Delete" question={'Delete "Standup"?'} onConfirm={onConfirm} />)
  return onConfirm
}

describe('ConfirmButton', () => {
  it('asks in place before acting', async () => {
    const onConfirm = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete "Standup"?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Yes, delete' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('Yes, delete runs the action once', async () => {
    const onConfirm = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('Cancel or Esc goes back without acting, and focus returns to the button', async () => {
    const onConfirm = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.queryByText('Delete "Standup"?')).not.toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('never uses the browser pop-up, which the Teams desktop app blocks', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    const onConfirm = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete' }))
    expect(confirm).not.toHaveBeenCalled()
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('keeps an accessible name of its own on the first button', () => {
    render(<ConfirmButton label="✕" ariaLabel="Remove: Standup" question={'Delete "Standup"?'} onConfirm={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Remove: Standup' })).toBeInTheDocument()
  })
})
