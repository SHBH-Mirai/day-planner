import { AnimatePresence, m } from 'motion/react'

interface Props {
  /** What just happened, e.g. "Marked done: Standup"; null hides the bar. */
  message: string | null
  onUndo: () => void
}

/** A short-lived bar at the bottom that lets you take back a Done or Skip. */
export function UndoBar({ message, onUndo }: Props) {
  return (
    <AnimatePresence>
      {message && (
        <m.div
          className="undo-bar neu-raised"
          role="status"
          aria-label="Undo"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        >
          <span>{message}</span>
          <button className="primary" onClick={onUndo}>
            Undo
          </button>
        </m.div>
      )}
    </AnimatePresence>
  )
}
