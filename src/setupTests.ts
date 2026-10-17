import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { MotionGlobalConfig } from 'motion/react'
import { afterEach, vi } from 'vitest'

// Tests check outcomes, not animation timing.
MotionGlobalConfig.skipAnimations = true

// Vitest globals are off, so RTL can't register its own cleanup.
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
