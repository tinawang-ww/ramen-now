import type { Locale } from './locale'

export interface Coords {
  lat: number
  lng: number
}

const EARTH_RADIUS_KM = 6371

function toRadians(degrees: number) {
  return degrees * Math.PI / 180
}

/** Great-circle distance in km. Plenty accurate for "which shop is closer". */
export function distanceKm(from: Coords, to: Coords) {
  const dLat = toRadians(to.lat - from.lat)
  const dLng = toRadians(to.lng - from.lng)

  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/**
 * Under a km reads in metres, and never with false precision.
 *
 * locale is required: defaulting it would let a new call site render Chinese
 * into an English page and still typecheck.
 */
export function formatDistance(km: number, locale: Locale) {
  if (km < 0.1)
    return locale === 'en' ? 'right nearby' : '就在附近'
  if (km < 1)
    return `${Math.round(km * 100) * 10} m`
  if (km < 10)
    return `${km.toFixed(1)} km`

  return `${Math.round(km)} km`
}
