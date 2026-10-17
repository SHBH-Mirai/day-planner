import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NeuSurface } from './NeuSurface'
import { NeuButton } from './NeuButton'

describe('NeuSurface', () => {
  it('is raised by default', () => {
    render(<NeuSurface>hello</NeuSurface>)
    expect(screen.getByText('hello')).toHaveClass('neu-raised')
  })

  it('can be pressed in, as another element, with extra classes', () => {
    render(
      <NeuSurface variant="inset" as="section" className="strip">
        hello
      </NeuSurface>,
    )
    const el = screen.getByText('hello')
    expect(el.tagName).toBe('SECTION')
    expect(el).toHaveClass('neu-inset', 'strip')
  })
})

describe('NeuButton', () => {
  it('calls onClick once per press', async () => {
    const onClick = vi.fn()
    render(<NeuButton onClick={onClick}>Save</NeuButton>)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('exposes a pressed state when it is a toggle', () => {
    render(<NeuButton pressed>Today</NeuButton>)
    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('has no pressed state when it is a plain button', () => {
    render(<NeuButton>Save</NeuButton>)
    expect(screen.getByRole('button', { name: 'Save' })).not.toHaveAttribute('aria-pressed')
  })

  it('takes an accessible name and a primary style', () => {
    render(
      <NeuButton aria-label="Add task" primary>
        +
      </NeuButton>,
    )
    expect(screen.getByRole('button', { name: 'Add task' })).toHaveClass('primary')
  })
})
