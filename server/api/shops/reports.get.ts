import { sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const idsStr = query.ids as string
  if (!idsStr)
    return []

  const ids = idsStr.split(',').map(Number).filter(id => !Number.isNaN(id))
  if (ids.length === 0)
    return []

  // Ensure we don't accidentally query too many if something goes wrong on the client
  if (ids.length > 50) {
    throw createError({ statusCode: 400, statusMessage: 'Too many IDs' })
  }

  const db = useDb(event)
  const idsList = sql.join(ids.map(id => sql`${id}`), sql`, `)

  const { results } = await db.run(sql`
    select
      s.id as id,
      s.requested_at as requestedAt,
      r.people as people,
      r.created_at as reportedAt
    from shops s
    left join (
      select
        shop_id,
        people,
        created_at,
        row_number() over (partition by shop_id order by created_at desc, id desc) as rn
      from reports
    ) r on r.shop_id = s.id and r.rn = 1
    where s.id IN (${idsList})
  `)

  return results.map((row: any) => ({
    id: Number(row.id),
    requestedAt: row.requestedAt === null ? null : Number(row.requestedAt) * 1000,
    people: row.people === null ? null : Number(row.people),
    reportedAt: row.reportedAt === null ? null : Number(row.reportedAt) * 1000,
  }))
})
