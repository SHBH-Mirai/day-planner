import { useContext } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MotionConfigContext } from 'motion/react'
import { MotionPrefs } from './MotionPrefs'

function Probe() {
  return <span>{useContext(MotionConfigContext).reducedMotion}</span>
}

describe('MotionPrefs', () => {
  it("makes motion follow the device's reduced-motion setting", () => {
    render(
      <MotionPrefs>
        <Probe />
      </MotionPrefs>,
    )
    expect(screen.getByText('user')).toBeInTheDocument()
  })
})
