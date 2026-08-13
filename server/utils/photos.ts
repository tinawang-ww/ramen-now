import type { R2Bucket } from '@cloudflare/workers-types'
import type { H3Event } from 'h3'

/** The three formats every phone can hand over; HEIC gets converted client-side. */
export const PHOTO_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/** The client downscales to ~1600px JPEG first, so hitting this means bypassing the app. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024

/**
 * The only shape reviews.post.ts will store: a key this server issued. It
 * makes photo_url unable to point anywhere but our own bucket route.
 */
export const PHOTO_URL_PATTERN
  = /^\/api\/photos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp)$/

/**
 * The bucket, or null where there isn't one.
 *
 * Null is a real deployment state, not a misconfiguration: R2 isn't enabled on
 * the account this app deploys to, so wrangler.jsonc carries no PHOTOS binding
 * and every photo route has to answer for itself rather than throw a 500. The
 * binding is the single source of truth — restore it in wrangler.jsonc and
 * both routes come back to life without another switch to flip.
 */
export function usePhotos(event: H3Event): R2Bucket | null {
  // Same access pattern as useDb: the binding shape comes from wrangler.jsonc.
  const env = event.context.cloudflare?.env as { PHOTOS?: R2Bucket } | undefined

  return env?.PHOTOS ?? null
}
