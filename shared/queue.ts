/** Nobody reports a queue longer than this by hand. */
export const MAX_PEOPLE = 99

/** Beyond this we stop drawing one figure per person and let the number carry it. */
export const PEOPLE_ICON_CAP = 10

/** A report from three hours ago says nothing about the queue right now. */
export const FRESH_WINDOW_MS = 90 * 60 * 1000

export function clampPeople(value: number) {
  return Math.min(MAX_PEOPLE, Math.max(0, Math.round(value)))
}

export function isValidPeople(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 0
    && value <= MAX_PEOPLE
}
