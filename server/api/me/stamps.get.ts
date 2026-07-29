import type { StampSummary } from '~~/shared/types'
import { asc, eq, isNotNull, sql } from 'drizzle-orm'

/** Fewer than this and "top reporter" is a coin toss, not a title. */
const REGULAR_MIN = 3

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

  if (rows.length === 0)
    return []

  // The bar to clear per shop: the busiest signed-in reporter anywhere. One
  // grouped pass beats a correlated subquery per stamp.
  const perUser = db
    .select({
      shopId: schema.reports.shopId,
      cnt: sql<number>`count(*)`.as('cnt'),
    })
    .from(schema.reports)
    .where(isNotNull(schema.reports.userId))
    .groupBy(schema.reports.shopId, schema.reports.userId)
    .as('per_user')

  const tops = await db
    .select({
      shopId: perUser.shopId,
      top: sql<number>`max(${perUser.cnt})`,
    })
    .from(perUser)
    .groupBy(perUser.shopId)
    .all()

  const topByShop = new Map(tops.map(row => [row.shopId, Number(row.top)]))

  return rows.map((row) => {
    const reports = Number(row.reports)

    return {
      shopId: row.shopId,
      name: row.name,
      reports,
      // Timestamps are stored as unix seconds; the client works in ms.
      firstAt: Number(row.firstAt) * 1000,
      // Ties share the title — two people at ×5 are both regulars.
      regular: reports >= REGULAR_MIN && reports >= (topByShop.get(row.shopId) ?? 0),
    }
  })
})
