import { eq, sql } from 'drizzle-orm'

/**
 * "Someone please report this shop." Stamping the shop is enough — any report
 * filed afterwards is newer than the stamp, which is how the ping clears.
 */
export default defineEventHandler(async (event) => {
  const shopId = Number(getRouterParam(event, 'id'))

  if (!Number.isInteger(shopId) || shopId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '店家不存在' })
  }

  const db = useDb(event)

  const updated = await db
    .update(schema.shops)
    .set({ requestedAt: sql`(unixepoch())` })
    .where(eq(schema.shops.id, shopId))
    .returning({ requestedAt: schema.shops.requestedAt })
    .get()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: '店家不存在' })
  }

  return { requestedAt: (updated.requestedAt ?? new Date()).getTime() }
})
