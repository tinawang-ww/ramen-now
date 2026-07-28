import type { D1Database } from '@cloudflare/workers-types'
import type { H3Event } from 'h3'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../database/schema'

export { schema }

export function useDb(event: H3Event) {
  // Nitro types the Cloudflare env loosely; the binding shape comes from wrangler.jsonc.
  const env = event.context.cloudflare?.env as { DB?: D1Database } | undefined

  if (!env?.DB) {
    throw createError({
      statusCode: 500,
      statusMessage: 'D1 binding "DB" is missing. Run pnpm dev via nitro-cloudflare-dev or wrangler dev.',
    })
  }

  return drizzle(env.DB, { schema })
}
