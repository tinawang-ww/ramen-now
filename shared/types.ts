export interface ShopSummary {
  id: number
  name: string
  /** People queuing in the newest report, or null when nobody has reported yet. */
  people: number | null
  /** Newest report's timestamp in ms, or null. */
  reportedAt: number | null
  reportCount: number
}
