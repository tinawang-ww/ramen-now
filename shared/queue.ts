/** Nobody reports a queue longer than this by hand. */
export const MAX_PEOPLE = 99

/** Beyond this we stop drawing one figure per person and let the number carry it. */
export const PEOPLE_ICON_CAP = 10

/** A report from three hours ago says nothing about the queue right now. */
export const FRESH_WINDOW_MS = 90 * 60 * 1000

/** A request nobody answered in three hours isn't about "now" any more. */
export const REQUEST_WINDOW_MS = 3 * 60 * 60 * 1000

/**
 * True while a "someone please report this" ping still stands. Any report filed
 * after the ping answers it, so nothing needs to clear the flag explicitly.
 */
export function isRequestPending(
  requestedAt: number | null,
  reportedAt: number | null,
  now: number,
) {
  if (requestedAt === null)
    return false

  if (reportedAt !== null && reportedAt >= requestedAt)
    return false

  return now - requestedAt < REQUEST_WINDOW_MS
}

export function clampPeople(value: number) {
  return Math.min(MAX_PEOPLE, Math.max(0, Math.round(value)))
}

export function isValidPeople(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 0
    && value <= MAX_PEOPLE
}
