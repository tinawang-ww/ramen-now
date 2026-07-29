export const MAX_RAMEN = 40
export const MAX_QUEUE = 60
export const MAX_BODY = 500

/** A bowl of ramen nobody prices above this by hand. */
export const MAX_PRICE = 9999

/** One page of the feed. Search runs in SQL so it isn't capped by this. */
export const FEED_LIMIT = 50

/**
 * Trim and collapse runs of whitespace, the same normalisation shops.post.ts
 * does to a shop name. Not for the body of a write-up — newlines are content
 * there, so that one only gets trimmed.
 */
export function tidyLine(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

export function isValidPrice(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    // Zero is almost always an empty field rather than a free bowl.
    && value > 0
    && value <= MAX_PRICE
}
