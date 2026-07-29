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

export interface StampSummary {
  shopId: number
  name: string
  /** Reports this user has filed for the shop — the ×N inked on the stamp. */
  reports: number
  /** First report's timestamp in ms — the date on the stamp. */
  firstAt: number
}

export interface ReviewSummary {
  id: number
  shopId: number
  shopName: string
  ramen: string
  /** TWD, whole dollars. */
  price: number
  /** Free text — what the queue was like when they went, not a head count. */
  queue: string
  body: string
  /** Always null for now; the upload stage is what fills it. */
  photoUrl: string | null
  /** The author's passkey-picker label. There is no anonymous write-up. */
  author: string
  /** Timestamp in ms. */
  createdAt: number
}
