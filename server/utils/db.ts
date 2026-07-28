import type { H3Event } from 'h3'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../database/schema'

export { schema }

export function useDb(event: H3Event) {
  const binding = event.context.cloudflare?.env?.DB

  if (!binding) {
    throw createError({
      statusCode: 500,
      statusMessage: 'D1 binding "DB" is missing. Run pnpm dev via nitro-cloudflare-dev or wrangler dev.',
    })
  }

  return drizzle(binding, { schema })
}
