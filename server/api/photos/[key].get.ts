/**
 * Serves one photo out of the bucket. Keys are UUIDs we issued, so the
 * pattern check is both the 404 fast-path and the traversal guard.
 */
export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, 'key') ?? ''

  if (!/^[0-9a-f-]{36}\.(?:jpg|png|webp)$/.test(key)) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  // With no bucket bound there is nothing here to find — same answer as a key
  // that was never issued, rather than a 500 on an <img> the page already drew.
  const object = await usePhotos(event)?.get(key)

  if (!object) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  setHeader(event, 'content-type', object.httpMetadata?.contentType ?? 'image/jpeg')
  // The key is unique per upload and never rewritten, so the cache can keep it.
  setHeader(event, 'cache-control', 'public, max-age=31536000, immutable')

  return object.body
})
