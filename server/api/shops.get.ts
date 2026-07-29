import type { ShopSummary } from '~~/shared/types'
import { sql } from 'drizzle-orm'

interface RawRow {
  id: number
  name: string
  lat: number | null
  lng: number | null
  counterSeats: number | null
  tableSeats: number | null
  requestedAt: number | null
  people: number | null
  reportedAt: number | null
}

export default defineCachedEventHandler(async (event): Promise<ShopSummary[]> => {
  const db = useDb(event)

  // One round trip: every shop plus its newest report, via a window function.
  const { results } = await db.run(sql`
    select
      s.id as id,
      s.name as name,
      s.lat as lat,
      s.lng as lng,
      s.counter_seats as counterSeats,
      s.table_seats as tableSeats,
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
    order by coalesce(r.created_at, 0) desc, s.id desc
  `)

  return (results as unknown as RawRow[]).map(row => ({
    id: Number(row.id),
    name: row.name,
    lat: row.lat === null ? null : Number(row.lat),
    lng: row.lng === null ? null : Number(row.lng),
    counterSeats: row.counterSeats === null ? null : Number(row.counterSeats),
    tableSeats: row.tableSeats === null ? null : Number(row.tableSeats),
    // Timestamps are stored as unix seconds; the client works in ms.
    requestedAt: row.requestedAt === null ? null : Number(row.requestedAt) * 1000,
    people: row.people === null ? null : Number(row.people),
    reportedAt: row.reportedAt === null ? null : Number(row.reportedAt) * 1000,
  }))
}, {
  maxAge: 10,
  swr: true,
  name: 'shops-list'
})
