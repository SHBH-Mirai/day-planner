import type { ReactNode } from 'react'
import { LazyMotion, MotionConfig } from 'motion/react'

// One retry: a redeploy or a blip while the app starts shouldn't cost the animations.
const load = () => import('./motionFeatures').then((mod) => mod.default)
const loadFeatures = () => load().catch(load)

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
