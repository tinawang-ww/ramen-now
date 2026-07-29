import type { ReviewSummary } from '~~/shared/types'
import { desc, eq } from 'drizzle-orm'
import { FEED_LIMIT } from '~~/shared/review'

export default defineEventHandler(async (event): Promise<ReviewSummary[]> => {
  const db = useDb(event)

  // Inner joins rather than left: both foreign keys are notNull, so a write-up
  // without a shop or an author can't exist.
  const rows = await db
    .select({
      id: schema.reviews.id,
      shopId: schema.reviews.shopId,
      shopName: schema.shops.name,
      ramen: schema.reviews.ramen,
      price: schema.reviews.price,
      queue: schema.reviews.queue,
      body: schema.reviews.body,
      photoUrl: schema.reviews.photoUrl,
      author: schema.users.label,
      createdAt: schema.reviews.createdAt,
    })
    .from(schema.reviews)
    .innerJoin(schema.shops, eq(schema.shops.id, schema.reviews.shopId))
    .innerJoin(schema.users, eq(schema.users.id, schema.reviews.userId))
    // The id tie-break isn't decoration: write-ups filed in the same second
    // would otherwise come back in an unstable order.
    .orderBy(desc(schema.reviews.createdAt), desc(schema.reviews.id))
    .limit(FEED_LIMIT)
    .all()

  return rows.map(row => ({
    ...row,
    // Timestamps are stored as unix seconds; the client works in ms.
    createdAt: row.createdAt.getTime(),
  }))
})
