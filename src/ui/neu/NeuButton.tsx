import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { motion } from 'motion/react'

type NativeProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'>

interface Props extends NativeProps {
  /** Set for toggle buttons (true/false); leave out for plain buttons. */
  pressed?: boolean
  primary?: boolean
  children?: ReactNode
}

/** A button that sinks into the surface when tapped, with a small spring. */
export function NeuButton({ pressed, primary, className, type = 'button', children, ...rest }: Props) {
  return (
    <motion.button
      {...rest}
      type={type}
      aria-pressed={pressed}
      className={[primary && 'primary', className].filter(Boolean).join(' ') || undefined}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
    >
      {children}
    </motion.button>
  )
}
