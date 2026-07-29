import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const shops = sqliteTable('shops', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  /** WGS84 degrees. Null until someone pins the shop, so it sorts last by distance. */
  lat: real('lat'),
  lng: real('lng'),
  /** Newest "someone please report this" ping, or null if nobody has asked. */
  requestedAt: integer('requested_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** Label on the OS passkey picker. Not an identifier: not unique, never validated, never looked up by. */
  label: text('label').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const credentials = sqliteTable('credentials', {
  /** The credential ID itself, as handed over by the authenticator. */
  id: text('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** base64URL string. nuxt-auth-utils decodes it itself, so don't store a blob. */
  publicKey: text('public_key').notNull(),
  /** Bumped by the authenticator on each sign-in, to catch replays. */
  counter: integer('counter').notNull(),
  backedUp: integer('backed_up', { mode: 'boolean' }).notNull(),
  /** JSON array, stringified — it goes straight back into verifyAuthenticationResponse as an array. */
  transports: text('transports'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, table => [
  index('credentials_user_idx').on(table.userId),
])

export const reports = sqliteTable('reports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  shopId: integer('shop_id')
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  /** How many people were queuing when this report was filed. */
  people: integer('people').notNull(),
  /** Null for anonymous reports, which stay a first-class way to file. */
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, table => [
  index('reports_shop_created_idx').on(table.shopId, table.createdAt),
  index('reports_user_idx').on(table.userId),
])

export const reviews = sqliteTable('reviews', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  shopId: integer('shop_id')
    .notNull()
    .references(() => shops.id, { onDelete: 'cascade' }),
  /**
   * Writing one requires signing in, so unlike a report this always has an
   * author — hence notNull, and hence cascade: `set null` isn't legal here.
   */
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  ramen: text('ramen').notNull(),
  /** TWD, whole dollars. Nobody records a bowl of ramen down to the cent. */
  price: integer('price').notNull(),
  /** Free text: 「排了 20 分鐘」and 「假日中午別來」are both the right answer. */
  queue: text('queue').notNull(),
  body: text('body').notNull(),
  /** Reserved for the upload stage. Nothing writes it yet. */
  photoUrl: text('photo_url'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, table => [
  index('reviews_shop_created_idx').on(table.shopId, table.createdAt),
  index('reviews_created_idx').on(table.createdAt),
])

export type Shop = typeof shops.$inferSelect
export type Report = typeof reports.$inferSelect
export type Review = typeof reviews.$inferSelect
export type User = typeof users.$inferSelect
export type Credential = typeof credentials.$inferSelect
