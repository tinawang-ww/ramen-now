import type { StampSummary } from '~~/shared/types'
import { asc, eq, sql } from 'drizzle-orm'

/**
 * The stamp book: one stamp per shop this user has reported at. Anonymous
 * reports have a null user_id, which eq() never matches — same rule as the
 * report count, they belong to nobody.
 */
export default defineEventHandler(async (event): Promise<StampSummary[]> => {
  const { user } = await requireUserSession(event)

  const db = useDb(event)

  const firstAt = sql<number>`min(${schema.reports.createdAt})`

  const rows = await db
    .select({
      shopId: schema.reports.shopId,
      name: schema.shops.name,
      reports: sql<number>`count(*)`,
      firstAt,
    })
    .from(schema.reports)
    .innerJoin(schema.shops, eq(schema.shops.id, schema.reports.shopId))
    .where(eq(schema.reports.userId, user.id))
    .groupBy(schema.reports.shopId, schema.shops.name)
    // Oldest first: the book fills up page by page, like the real thing.
    .orderBy(asc(firstAt))
    .all()

  return rows.map(row => ({
    shopId: row.shopId,
    name: row.name,
    reports: Number(row.reports),
    // Timestamps are stored as unix seconds; the client works in ms.
    firstAt: Number(row.firstAt) * 1000,
  }))
})
