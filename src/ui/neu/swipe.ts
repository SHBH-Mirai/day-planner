import type { Task } from '../../domain/task'

export type SwipeDirection = 'right' | 'left'
export type SwipeTarget = 'started' | 'done' | 'skip'

/** Share of the row width a drag must cover to count as a swipe. */
const THRESHOLD = 0.3

/** A drag counts only when it is long enough and more sideways than up/down (so scrolling still works). */
export function swipeAction(dx: number, dy: number, width: number): SwipeDirection | null {
  if (Math.abs(dx) <= Math.abs(dy) || Math.abs(dx) <= THRESHOLD * width) return null
  return dx > 0 ? 'right' : 'left'
}

/** Right moves a task forward (Started, then Done); left skips it. Finished tasks ignore swipes. */
export function swipeTarget(task: Task, direction: SwipeDirection): SwipeTarget | null {
  if (task.status !== 'planned') return null
  if (direction === 'left') return 'skip'
  return task.actualStart ? 'done' : 'started'
}
