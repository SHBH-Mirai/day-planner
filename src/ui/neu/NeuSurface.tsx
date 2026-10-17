import type { ElementType, ReactNode } from 'react'

interface Props {
  variant?: 'raised' | 'inset'
  as?: ElementType
  className?: string
  children?: ReactNode
}

/** A soft panel that looks pushed out of (raised) or into (inset) the page. */
export function NeuSurface({ variant = 'raised', as: Tag = 'div', className, children }: Props) {
  return <Tag className={['neu-' + variant, className].filter(Boolean).join(' ')}>{children}</Tag>
}
