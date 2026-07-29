import type { ReviewSummary } from '~~/shared/types'
import { eq } from 'drizzle-orm'
import { isValidPrice, MAX_BODY, MAX_PRICE, MAX_QUEUE, MAX_RAMEN, tidyLine } from '~~/shared/review'

export default defineEventHandler(async (event): Promise<ReviewSummary> => {
  // The first write in this app that needs an account: a write-up has an author
  // and sticks around, unlike a head count that expires in 90 minutes.
  const { user } = await requireUserSession(event, { message: '請先登入再寫食記' })

  const body = await readBody<{
    shopId?: unknown
    ramen?: unknown
    price?: unknown
    queue?: unknown
    body?: unknown
  }>(event)

  const shopId = typeof body?.shopId === 'number' ? body.shopId : Number.NaN

  if (!Number.isInteger(shopId) || shopId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '店家不存在' })
  }

  const ramen = tidyLine(body?.ramen)

  if (!ramen || ramen.length > MAX_RAMEN) {
    throw createError({ statusCode: 400, statusMessage: `拉麵名稱請填 1–${MAX_RAMEN} 個字` })
  }

  const price = typeof body?.price === 'number' ? body.price : Number.NaN

  if (!isValidPrice(price)) {
    throw createError({ statusCode: 400, statusMessage: `價格請填 1–${MAX_PRICE} 元` })
  }

  const queue = tidyLine(body?.queue)

  if (!queue || queue.length > MAX_QUEUE) {
    throw createError({ statusCode: 400, statusMessage: `排隊情形請填 1–${MAX_QUEUE} 個字` })
  }

  // Only trimmed, not collapsed: newlines are content in a write-up.
  const text = typeof body?.body === 'string' ? body.body.trim() : ''

  if (!text || text.length > MAX_BODY) {
    throw createError({ statusCode: 400, statusMessage: `心得請填 1–${MAX_BODY} 個字` })
  }

  const db = useDb(event)

  const shop = await db
    .select({ id: schema.shops.id, name: schema.shops.name })
    .from(schema.shops)
    .where(eq(schema.shops.id, shopId))
    .get()

  if (!shop) {
    throw createError({ statusCode: 404, statusMessage: '店家不存在' })
  }

  const review = await db
    .insert(schema.reviews)
    .values({ shopId, userId: user.id, ramen, price, queue, body: text })
    .returning({ id: schema.reviews.id, createdAt: schema.reviews.createdAt })
    .get()

  // The whole card comes back so the feed can prepend it without refetching.
  return {
    id: review?.id ?? 0,
    shopId: shop.id,
    shopName: shop.name,
    ramen,
    price,
    queue,
    body: text,
    photoUrl: null,
    author: user.label,
    createdAt: (review?.createdAt ?? new Date()).getTime(),
  }
})
