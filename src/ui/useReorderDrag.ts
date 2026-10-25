import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { dropIndex } from '../domain/reorder'

/**
 * Drag a row by its handle: while the pointer moves, a line shows where the task will land;
 * on release `onDrop(movedId, beforeId)` runs. Escape cancels. Rows are the `[data-task-id]`
 * elements inside `listRef`, in screen order.
 */
export function useReorderDrag(onDrop: (movedId: string, beforeId: string | null) => void) {
  const listRef = useRef<HTMLOListElement | null>(null)
  const [drag, setDrag] = useState<{ id: string; index: number } | null>(null)
  const stopRef = useRef<(() => void) | null>(null)
  // A list that unmounts mid-drag drops its window listeners.
  useEffect(() => () => stopRef.current?.(), [])

  function start(id: string, e: ReactPointerEvent) {
    if (e.button > 0 || stopRef.current) return
    e.preventDefault()
    const rows = () => [...(listRef.current?.querySelectorAll<HTMLElement>('[data-task-id]') ?? [])]
    let index = -1
    const move = (ev: PointerEvent) => {
      index = dropIndex(
        ev.clientY,
        rows().map((el) => {
          const r = el.getBoundingClientRect()
          return { top: r.top, height: r.height }
        }),
      )
      setDrag({ id, index })
    }
    const end = (ev: PointerEvent) => {
      cleanup()
      setDrag(null)
      if (ev.type === 'pointerup' && index >= 0) onDrop(id, rows()[index]?.dataset.taskId ?? null)
    }
    const key = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return
      cleanup()
      setDrag(null)
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      window.removeEventListener('keydown', key)
      stopRef.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    window.addEventListener('keydown', key)
    stopRef.current = cleanup
    setDrag({ id, index: -1 })
  }

  /** The drop line for row `i` of `n`: above it, below the last row, or none. */
  function mark(i: number, n: number): 'before' | 'after' | undefined {
    if (!drag || drag.index < 0) return undefined
    if (drag.index === i) return 'before'
    return drag.index === n && i === n - 1 ? 'after' : undefined
  }

  return { listRef, start, mark, dragging: drag?.id }
}
