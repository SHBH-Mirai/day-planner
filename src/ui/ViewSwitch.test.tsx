import { expect, test, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ViewSwitch } from './ViewSwitch'

test('shows List and Table, marks the current one, and reports a change', async () => {
  const onChange = vi.fn()
  render(<ViewSwitch value="list" onChange={onChange} />)
  const group = screen.getByRole('group', { name: 'Layout' })
  expect(within(group).getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true')
  expect(within(group).getByRole('button', { name: 'Table' })).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(within(group).getByRole('button', { name: 'Table' }))
  expect(onChange).toHaveBeenCalledWith('table')
})
