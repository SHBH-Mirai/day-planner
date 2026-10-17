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
    // Ticked done without Started, so Actual shows its planned hour (one rule with the totals).
    expect(within(doneRow).getAllByRole('cell').map((c) => c.textContent)).toEqual(['60', '60'])
    expect(within(within(table).getByRole('row', { name: /Report/ })).getByText('—')).toBeInTheDocument()
  })

  test('big numbers: planned and actual time, done and skipped counts', () => {
    const done = makeTask({
      title: 'Client work',
      status: 'done',
      start: ist(D, '09:00'),
      end: ist(D, '10:00'),
      originalEnd: ist(D, '10:00'),
      actualEnd: ist(D, '10:15'),
    })
    const planned = makeTask({ title: 'Report', start: ist(D, '11:00'), end: ist(D, '11:30') })
    const skipped = makeTask({ title: 'Gym', status: 'skipped', start: ist(D, '18:00'), end: ist(D, '19:00') })
    render(<SummaryView tasks={[done, planned, skipped]} />)
    const stats = screen.getByRole('group', { name: 'Day totals' })
    expect(within(stats).getByText('Planned').nextSibling).toHaveTextContent('1h 30m')
    // Ticked done without Started, so it counts its planned hour (one rule with the focus strip).
    expect(within(stats).getByText('Actual').nextSibling).toHaveTextContent(/^1h$/)
    expect(within(stats).getByText('Done').nextSibling).toHaveTextContent('1')
    expect(within(stats).getByText('Skipped').nextSibling).toHaveTextContent('1')
  })

  test('the category bar is described by its legend', () => {
    const office = makeTask({ category: 'office', start: ist(D, '09:00'), end: ist(D, '10:00') })
    render(<SummaryView tasks={[office]} />)
    expect(screen.getByRole('img', { name: 'Time by category' })).toHaveAccessibleDescription(/Office 1h/)
  })

  test('a bar split by category, one labelled segment per category with time', () => {
    const office = makeTask({ category: 'office', start: ist(D, '09:00'), end: ist(D, '10:00') })
    const content = makeTask({ category: 'youtube', start: ist(D, '20:00'), end: ist(D, '21:30') })
    render(<SummaryView tasks={[office, content]} />)
    const bar = screen.getByRole('img', { name: 'Time by category' })
    expect(within(bar).getByLabelText('Office 60 min')).toBeInTheDocument()
    expect(within(bar).getByLabelText('Content 90 min')).toBeInTheDocument()
    expect(within(bar).queryByLabelText(/Freelance/)).not.toBeInTheDocument()
  })

  test('the category table agrees with the bar for a task ticked done late without Started', () => {
    const late = makeTask({
      category: 'office',
      status: 'done',
      start: ist(D, '09:00'),
      end: ist(D, '10:30'),
      originalEnd: ist(D, '10:30'),
      actualEnd: ist(D, '15:51'),
    })
    render(<SummaryView tasks={[late]} />)
    expect(within(screen.getByRole('img', { name: 'Time by category' })).getByLabelText('Office 90 min')).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'By category' })
    expect(within(within(table).getByRole('row', { name: /Office/ })).getByText('90')).toBeInTheDocument()
  })

  test('shows minutes per category', () => {
    const t = makeTask({ category: 'youtube', start: ist(D, '20:00'), end: ist(D, '21:30') })
    render(<SummaryView tasks={[t]} />)
    const table = screen.getByRole('table', { name: 'By category' })
    expect(within(within(table).getByRole('row', { name: /Content/ })).getByText('90')).toBeInTheDocument()
  })
})
