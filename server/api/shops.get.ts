import { sql } from 'drizzle-orm'

export interface ShopRow {
  id: number
  name: string
  level: number | null
  reportedAt: number | null
  reportCount: number
}

export default defineEventHandler(async (event) => {
  const db = useDb(event)

  // One round trip: every shop plus its newest report, via a window function.
  const { results } = await db.run(sql`
    select
      s.id as id,
      s.name as name,
      r.level as level,
      r.created_at as reportedAt,
      coalesce(c.count, 0) as reportCount
    from shops s
    left join (
      select
        shop_id,
        level,
        created_at,
        row_number() over (partition by shop_id order by created_at desc, id desc) as rn
      from reports
    ) r on r.shop_id = s.id and r.rn = 1
    left join (
      select shop_id, count(*) as count from reports group by shop_id
    ) c on c.shop_id = s.id
    order by coalesce(r.created_at, 0) desc, s.id desc
  `)

  return (results as unknown as ShopRow[]).map(row => ({
    id: Number(row.id),
    name: row.name,
    level: row.level === null ? null : Number(row.level),
    // D1 stores our timestamps as unix seconds; the client wants milliseconds.
    reportedAt: row.reportedAt === null ? null : Number(row.reportedAt) * 1000,
    reportCount: Number(row.reportCount),
  }))
})
