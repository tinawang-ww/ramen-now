/**
 * The stamp art, in the order ShopRow established — a shop's picture is keyed
 * on its id, so the same shop wears the same bowl everywhere: the board row,
 * the report modal, and the passport on /me.
 */
export const SHOP_STAMPS = [
  '/stamps/ramen2.webp',
  '/stamps/ramen3.webp',
  '/stamps/ramen4.webp',
  '/stamps/ramen5.webp',
  '/stamps/stamp1.webp',
  '/stamps/stamp2.webp',
  '/stamps/stamp3.webp',
] as const

export function shopStampSrc(shopId: number) {
  return SHOP_STAMPS[shopId % SHOP_STAMPS.length]!
}
