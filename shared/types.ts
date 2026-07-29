export interface ShopSummary {
  id: number
  name: string
  /** WGS84 degrees, or null when the shop has no pin yet. */
  lat: number | null
  lng: number | null
  /** People queuing in the newest report, or null when nobody has reported yet. */
  people: number | null
  /** Newest report's timestamp in ms, or null. */
  reportedAt: number | null
  /** Newest report request's timestamp in ms, or null when nobody has asked. */
  requestedAt: number | null
}
