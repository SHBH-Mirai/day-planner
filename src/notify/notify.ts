import { formatLocalTime } from '../domain/time'
import type { Nudge } from '../scheduler/dueNudges'

export type PermissionState = NotificationPermission | 'unsupported'

export function nudgeText(n: Nudge): string {
  return n.kind === 'start'
    ? `▶ START: ${n.task.title} until ${formatLocalTime(n.task.end)}`
    : `⏹ STOP: ${n.task.title}. Done?`
}

/** The first line of a description, for the pop-up body. */
export function firstLine(text: string | undefined): string | undefined {
  return text?.split('\n')[0].trim() || undefined
}

export function notificationPermission(): PermissionState {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

/** Must be called from a click handler: browsers ignore requests without a user gesture. */
export async function requestNotificationPermission(): Promise<PermissionState> {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.requestPermission()
}

/** Pops an OS notification. Returns false when it didn't (no permission, no API, or missed). */
export function showOsNotification(n: Nudge): boolean {
  if (n.missed || typeof Notification === 'undefined' || Notification.permission !== 'granted') return false
  const body = firstLine(n.task.description)
  new Notification(nudgeText(n), body ? { tag: n.key, body } : { tag: n.key })
  return true
}
