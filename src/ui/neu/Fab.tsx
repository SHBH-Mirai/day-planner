import { m } from 'motion/react'

interface Props {
  onClick: () => void
  'aria-label': string
}

/** The round floating + button, bottom right. */
export function Fab({ onClick, 'aria-label': label }: Props) {
  return (
    <m.button
      className="fab"
      aria-label={label}
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
    >
      <span aria-hidden="true">+</span>
    </m.button>
  )
}
