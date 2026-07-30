export interface ShopSummary {
  id: number
  name: string
  /** WGS84 degrees, or null when the shop has no pin yet. */
  lat: number | null
  lng: number | null
  /** Counter seats, or null when nobody has counted them. 0 is a real answer. */
  counterSeats: number | null
  /** Table seats, or null when nobody has counted them. 0 is a real answer. */
  tableSeats: number | null
  /** People queuing in the newest report, or null when nobody has reported yet. */
  people: number | null
  /** Newest report's timestamp in ms, or null. */
  reportedAt: number | null
  /** Newest report request's timestamp in ms, or null when nobody has asked. */
  requestedAt: number | null
}

export interface QueueHour {
  /** Hour of day in Taipei time, 0–23. */
  hour: number
  /** Mean reported head count for that hour, one decimal. */
  avg: number
  samples: number
}

export interface StampSummary {
  shopId: number
  name: string
  /** Reports this user has filed for the shop — the ×N inked on the stamp. */
  reports: number
  /** First report's timestamp in ms — the date on the stamp. */
  firstAt: number
  /** Nobody has reported here more than this user (and they've done it ≥3 times). */
  regular: boolean
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
