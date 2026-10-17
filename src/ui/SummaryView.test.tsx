import { describe, expect, test } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { SummaryView } from './SummaryView'
import { ist, makeTask } from '../test-utils/makeTask'

const D = '2026-10-17'

describe('SummaryView', () => {
  test('one row per task with planned and actual minutes, — when not done', () => {
    const done = makeTask({
      title: 'Client work',
      category: 'freelance',
      status: 'done',
      start: ist(D, '09:00'),
      end: ist(D, '10:00'),
      originalEnd: ist(D, '10:00'),
      actualEnd: ist(D, '10:15'),
    })
    const planned = makeTask({ title: 'Report', start: ist(D, '11:00'), end: ist(D, '11:30') })
    render(<SummaryView tasks={[done, planned]} />)
    const table = screen.getByRole('table', { name: 'Tasks' })
    const doneRow = within(table).getByRole('row', { name: /Client work/ })
    expect(within(doneRow).getByText('60')).toBeInTheDocument()
    expect(within(doneRow).getByText('75')).toBeInTheDocument()
    expect(within(within(table).getByRole('row', { name: /Report/ })).getByText('—')).toBeInTheDocument()
  })

  test('shows minutes per category', () => {
    const t = makeTask({ category: 'youtube', start: ist(D, '20:00'), end: ist(D, '21:30') })
    render(<SummaryView tasks={[t]} />)
    const table = screen.getByRole('table', { name: 'By category' })
    expect(within(within(table).getByRole('row', { name: /Content/ })).getByText('90')).toBeInTheDocument()
  })
})
