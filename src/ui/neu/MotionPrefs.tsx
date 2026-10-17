import type { ReactNode } from 'react'
import { MotionConfig } from 'motion/react'

/** Motion follows the device's "reduce motion" setting: movement becomes simple fades. */
export function MotionPrefs({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
