import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sheet } from './Sheet'
import { Fab } from './Fab'

function renderSheet(open: boolean, onClose = vi.fn(), onSubmit = vi.fn((e: { preventDefault(): void }) => e.preventDefault())) {
  render(
    <Sheet open={open} onClose={onClose} title="New task">
      <form onSubmit={onSubmit}>
        <label>
          Title
          <input />
        </label>
        <button type="submit">Save</button>
      </form>
    </Sheet>,
  )
  return { onClose, onSubmit }
}

describe('Sheet', () => {
  it('renders nothing while closed', () => {
    renderSheet(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('is a modal dialog named by its title, with focus inside', () => {
    renderSheet(true)
    const dialog = screen.getByRole('dialog', { name: 'New task' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
  })

  it('closes on Esc without submitting the form', async () => {
    const { onClose, onSubmit } = renderSheet(true)
    await userEvent.type(screen.getByLabelText('Title'), 'Half a ta')
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('closes when the backdrop is clicked, but not when the panel is', async () => {
    const { onClose } = renderSheet(true)
    await userEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
    await userEvent.click(screen.getByTestId('sheet-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps Tab inside the sheet', async () => {
    renderSheet(true)
    const save = screen.getByRole('button', { name: 'Save' })
    const close = screen.getByRole('button', { name: 'Close' })
    save.focus()
    await userEvent.tab()
    expect(close).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(save).toHaveFocus()
  })

  it('has a Close button', async () => {
    const { onClose } = renderSheet(true)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('Fab', () => {
  it('is a named button that calls onClick', async () => {
    const onClick = vi.fn()
    render(<Fab aria-label="New task" onClick={onClick} />)
    await userEvent.click(screen.getByRole('button', { name: 'New task' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
