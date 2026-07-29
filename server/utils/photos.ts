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

export function usePhotos(event: H3Event) {
  // Same access pattern as useDb: the binding shape comes from wrangler.jsonc.
  const env = event.context.cloudflare?.env as { PHOTOS?: R2Bucket } | undefined

  if (!env?.PHOTOS) {
    throw createError({
      statusCode: 500,
      statusMessage: 'R2 binding "PHOTOS" is missing. Run pnpm dev via nitro-cloudflare-dev or wrangler dev.',
    })
  }

  return env.PHOTOS
}
