import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressRing } from './ProgressRing'

describe('ProgressRing', () => {
  it('names the progress and shows the percentage', () => {
    render(<ProgressRing done={2} total={5} />)
    expect(screen.getByRole('img', { name: '2 of 5 done' })).toBeInTheDocument()
    expect(screen.getByText('40%')).toBeInTheDocument()
  })

  it('shows 0% for an empty day, never NaN', () => {
    render(<ProgressRing done={0} total={0} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
  })

  it('shows 100% when everything is done', () => {
    render(<ProgressRing done={5} total={5} />)
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('rounds to a whole percent', () => {
    render(<ProgressRing done={1} total={3} />)
    expect(screen.getByText('33%')).toBeInTheDocument()
  })
})
