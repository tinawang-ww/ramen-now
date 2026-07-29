import { eq } from 'drizzle-orm'
import { isValidPeople, MAX_PEOPLE } from '~~/shared/queue'

export default defineEventHandler(async (event) => {
  const shopId = Number(getRouterParam(event, 'id'))

  if (!Number.isInteger(shopId) || shopId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '店家不存在' })
  }

  const body = await readBody<{ people?: unknown }>(event)
  const people = typeof body?.people === 'number' ? body.people : Number.NaN

  if (!isValidPeople(people)) {
    throw createError({ statusCode: 400, statusMessage: `排隊人數請填 0–${MAX_PEOPLE}` })
  }

  const db = useDb(event)
  const session = await getUserSession(event)

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
    // Signed out means a null author, not a rejected report: filing anonymously
    // stays the one-tap path it has always been.
    .values({ shopId, people, userId: session.user?.id ?? null })
    .returning({ people: schema.reports.people, createdAt: schema.reports.createdAt })
    .get()

  return {
    people: report?.people ?? people,
    reportedAt: (report?.createdAt ?? new Date()).getTime(),
  }
})
