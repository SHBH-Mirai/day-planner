import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  /** What the first button shows, e.g. "Delete" or "✕". */
  label: ReactNode
  /** The first button's accessible name when the label alone isn't enough. */
  ariaLabel?: string
  /** Asked in place, e.g. 'Delete "Standup"?'. */
  question: string
  onConfirm: () => void
}

/**
 * A button that asks in place before it acts: the browser's own confirm() pop-up never shows
 * in the Teams desktop app (Microsoft blocks it there), so the question lives in the page.
 * Focus lands on Cancel, the safe choice; Esc or Cancel goes back to the button.
 */
export function ConfirmButton({ label, ariaLabel, question, onConfirm }: Props) {
  const [asking, setAsking] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const wasAsking = useRef(false)

  useEffect(() => {
    if (asking) cancel.current?.focus()
    else if (wasAsking.current) button.current?.focus()
    wasAsking.current = asking
  }, [asking])

  if (!asking) {
    return (
      <button ref={button} aria-label={ariaLabel} onClick={() => setAsking(true)}>
        {label}
      </button>
    )
  }

  return (
    <span
      className="confirm-inline"
      role="group"
      aria-label={question}
      onKeyDown={(e) => {
        // Esc closes only the question, not the row or sheet around it.
        if (e.key !== 'Escape') return
        e.stopPropagation()
        setAsking(false)
      }}
    >
      <span>{question}</span>
      <button className="danger" onClick={onConfirm}>
        Yes, delete
      </button>
      <button ref={cancel} onClick={() => setAsking(false)}>
        Cancel
      </button>
    </span>
  )
}
