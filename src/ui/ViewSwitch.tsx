import { m } from 'motion/react'
import type { DayView } from './dayView'
import { NeuButton } from './neu/NeuButton'
import { NeuSurface } from './neu/NeuSurface'

const OPTIONS: [DayView, string][] = [
  ['list', 'List'],
  ['table', 'Table'],
]

/** List | Table, above the day's tasks. */
export function ViewSwitch({ value, onChange }: { value: DayView; onChange: (view: DayView) => void }) {
  return (
    <NeuSurface variant="inset" className="view-switch">
      <div role="group" aria-label="Layout">
        {OPTIONS.map(([view, label]) => (
          <NeuButton key={view} pressed={value === view} onClick={() => onChange(view)}>
            {value === view && <m.span layoutId="layout-pill" className="day-pill" aria-hidden="true" />}
            {label}
          </NeuButton>
        ))}
      </div>
    </NeuSurface>
  )
}
