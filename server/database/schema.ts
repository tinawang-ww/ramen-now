import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const shops = sqliteTable('shops', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const reports = sqliteTable('reports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  shopId: integer('shop_id')
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  /** How many people were queuing when this report was filed. */
  people: integer('people').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, table => [
  index('reports_shop_created_idx').on(table.shopId, table.createdAt),
])

export type Shop = typeof shops.$inferSelect
export type Report = typeof reports.$inferSelect
