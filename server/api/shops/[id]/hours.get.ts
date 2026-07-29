import type { QueueHour } from '~~/shared/types'
import { and, eq, gte, sql } from 'drizzle-orm'

/**
 * Below these the "typical line" would just echo two lucky reports — better
 * to show nothing than a confident wrong chart.
 */
const MIN_SAMPLES = 5
const MIN_HOURS = 3

/** Old queues describe an old shop: a rebrand, a menu change, a TV feature. */
const WINDOW_DAYS = 90

/**
 * The typical queue by hour of day, from this shop's own report history.
 * Taiwan sits at UTC+8 with no DST, so a fixed shift beats a tz library.
 */
export default defineEventHandler(async (event): Promise<{ hours: QueueHour[] }> => {
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const db = useDb(event)

  const hour = sql<number>`cast(strftime('%H', datetime(${schema.reports.createdAt} + 28800, 'unixepoch')) as integer)`
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const rows = await db
    .select({
      hour,
      avg: sql<number>`avg(${schema.reports.people})`,
      samples: sql<number>`count(*)`,
    })
    .from(schema.reports)
    .where(and(eq(schema.reports.shopId, id), gte(schema.reports.createdAt, since)))
    .groupBy(hour)
    .orderBy(hour)
    .all()

  const total = rows.reduce((sum, row) => sum + Number(row.samples), 0)

  if (total < MIN_SAMPLES || rows.length < MIN_HOURS) {
    return { hours: [] }
  }

  return {
    hours: rows.map(row => ({
      hour: Number(row.hour),
      avg: Math.round(Number(row.avg) * 10) / 10,
      samples: Number(row.samples),
    })),
  }
})
