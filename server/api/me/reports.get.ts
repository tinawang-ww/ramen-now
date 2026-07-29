import { count, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const db = useDb(event)

  // Anonymous reports have a null user_id, which eq() never matches — so they
  // count towards nobody. That is the intent, not an oversight.
  const row = await db
    .select({ count: count() })
    .from(schema.reports)
    .where(eq(schema.reports.userId, user.id))
    .get()

  return { count: Number(row?.count ?? 0) }
})
