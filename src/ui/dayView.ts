/** How a day's tasks are shown: the calm list, or the table with every control. */
export type DayView = 'list' | 'table'

export const DAY_VIEW_KEY = 'dayPlanner.view'

/** The choice remembered on this device; the list when nothing (or nothing readable) is stored. */
export function readDayView(): DayView {
  try {
    return localStorage.getItem(DAY_VIEW_KEY) === 'table' ? 'table' : 'list'
  } catch {
    return 'list'
  }
}

/** Remember the choice; blocked storage just means it isn't remembered. */
export function saveDayView(view: DayView): void {
  try {
    localStorage.setItem(DAY_VIEW_KEY, view)
  } catch {
    // Private window or blocked site data: the switch still works for this visit.
  }
}
