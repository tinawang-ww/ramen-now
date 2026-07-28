import { eq } from 'drizzle-orm'
import { isValidLevel } from '~~/shared/levels'

export default defineEventHandler(async (event) => {
  const shopId = Number(getRouterParam(event, 'id'))

  if (!Number.isInteger(shopId) || shopId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '店家不存在' })
  }

  const body = await readBody<{ level?: unknown }>(event)
  const level = typeof body?.level === 'number' ? body.level : Number.NaN

  if (!isValidLevel(level)) {
    throw createError({ statusCode: 400, statusMessage: '請選擇排隊狀況' })
  }

  const db = useDb(event)

  const shop = await db
    .select({ id: schema.shops.id })
    .from(schema.shops)
    .where(eq(schema.shops.id, shopId))
    .get()

  if (!shop) {
    throw createError({ statusCode: 404, statusMessage: '店家不存在' })
  }

  const report = await db
    .insert(schema.reports)
    .values({ shopId, level })
    .returning({ level: schema.reports.level, createdAt: schema.reports.createdAt })
    .get()

  return {
    level: report?.level ?? level,
    reportedAt: (report?.createdAt ?? new Date()).getTime(),
  }
})
