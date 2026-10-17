import type { ReactNode } from 'react'
import { LazyMotion, MotionConfig } from 'motion/react'

const loadFeatures = () => import('./motionFeatures').then((mod) => mod.default)

/**
 * Motion follows the device's "reduce motion" setting (movement becomes simple fades),
 * and its animation features load after the app starts, keeping the first download small.
 * `strict` makes a stray full `motion.*` element an error, so the saving can't slip away.
 */
export function MotionPrefs({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  )
}
