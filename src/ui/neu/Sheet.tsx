import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** A panel that slides up from the bottom. Esc, the backdrop or Close shut it; Tab stays inside. */
export function Sheet({ open, onClose, title, children }: Props) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  // Each opening gets its own key, so reopening during the close animation never brings back an old draft.
  const [openings, setOpenings] = useState(0)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setOpenings((n) => n + 1)
  }

  useEffect(() => {
    if (!open) return
    const before = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>('input, select, textarea') ?? panel?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    return () => before?.focus()
  }, [open])

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !panelRef.current) return
    const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    } else if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <Backdrop key={openings} onClose={onClose}>
          <motion.div
            ref={panelRef}
            className="sheet"
            // Focusable itself, so Esc and the Tab trap still work after a click on an empty part of it.
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onKeyDown}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <div className="sheet-header">
              <h2 id={titleId}>{title}</h2>
              <button className="sheet-close" aria-label="Close" onClick={onClose}>
                ✕
              </button>
            </div>
            {children}
          </motion.div>
        </Backdrop>
      )}
    </AnimatePresence>
  )
}

/** The dimmed layer behind the sheet. While it fades out it lets clicks through, so a quick tap on + still works. */
function Backdrop({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const present = useIsPresent()
  // Only a press that starts on the backdrop closes it: a text selection let go out here must not.
  const pressedHere = useRef(false)
  return (
    <motion.div
      className="sheet-backdrop"
      data-testid="sheet-backdrop"
      onPointerDown={(e) => (pressedHere.current = e.target === e.currentTarget)}
      onClick={(e) => {
        if (present && pressedHere.current && e.target === e.currentTarget) onClose()
        pressedHere.current = false
      }}
      style={{ pointerEvents: present ? 'auto' : 'none' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {children}
    </motion.div>
  )
}
