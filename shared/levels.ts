export interface QueueLevel {
  value: number
  /** Short label used on the report buttons and the list rows. */
  label: string
  /** Rough wait time, shown as a hint under the label. */
  hint: string
}

export const QUEUE_LEVELS: QueueLevel[] = [
  { value: 0, label: '直接進', hint: '不用排' },
  { value: 1, label: '小排', hint: '15 分內' },
  { value: 2, label: '長排', hint: '30 分左右' },
  { value: 3, label: '爆炸', hint: '1 小時以上' },
]

/** A report older than this is stale — we stop presenting it as "now". */
export const FRESH_WINDOW_MS = 90 * 60 * 1000

export function levelOf(value: number | null | undefined) {
  if (value === null || value === undefined)
    return undefined
  return QUEUE_LEVELS.find(level => level.value === value)
}

export function isValidLevel(value: unknown): value is number {
  return typeof value === 'number' && QUEUE_LEVELS.some(level => level.value === value)
}
