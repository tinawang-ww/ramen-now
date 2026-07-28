import { eq, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ name?: unknown }>(event)
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''

  if (!name || name.length > 40) {
    throw createError({ statusCode: 400, statusMessage: '店名請填 1–40 個字' })
  }

  const db = useDb(event)

  // Same shop added twice (different casing, different person) is one shop.
  const existing = await db
    .select()
    .from(schema.shops)
    .where(sql`lower(${schema.shops.name}) = lower(${name})`)
    .get()

  if (existing) {
    return { id: existing.id, name: existing.name, created: false }
  }

  const inserted = await db
    .insert(schema.shops)
    .values({ name })
    .returning({ id: schema.shops.id, name: schema.shops.name })
    .get()

  if (!inserted) {
    const fallback = await db
      .select()
      .from(schema.shops)
      .where(eq(schema.shops.name, name))
      .get()

    if (!fallback)
      throw createError({ statusCode: 500, statusMessage: '新增失敗，請再試一次' })

    return { id: fallback.id, name: fallback.name, created: false }
  }

  return { id: inserted.id, name: inserted.name, created: true }
})
