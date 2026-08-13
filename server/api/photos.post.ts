/**
 * Takes one image, gives back the URL the review should carry. A photo rides
 * on a write-up and write-ups need an account, so uploading does too — that
 * alone shuts out drive-by bucket filling.
 */
export default defineEventHandler(async (event) => {
  await requireUserSession(event, { message: '請先登入再上傳照片' })

  const bucket = usePhotos(event)

  // No bucket, no upload — said plainly and early, before a 5MB body gets read
  // for nowhere to put it.
  if (!bucket) {
    throw createError({ statusCode: 503, statusMessage: '照片功能暫時停用' })
  }

  const type = getHeader(event, 'content-type') ?? ''
  const ext = PHOTO_TYPES[type]

  if (!ext) {
    throw createError({ statusCode: 415, statusMessage: '照片請用 JPEG、PNG 或 WebP' })
  }

  // Reject on the declared size first, so an oversized body is never buffered.
  const declared = Number(getHeader(event, 'content-length') ?? 0)

  if (declared > MAX_PHOTO_BYTES) {
    throw createError({ statusCode: 413, statusMessage: '照片太大，請在 5MB 以內' })
  }

  const body = await readRawBody(event, false)

  if (!body?.length) {
    throw createError({ statusCode: 400, statusMessage: '沒有收到照片' })
  }

  if (body.length > MAX_PHOTO_BYTES) {
    throw createError({ statusCode: 413, statusMessage: '照片太大，請在 5MB 以內' })
  }

  const key = `${crypto.randomUUID()}.${ext}`

  await bucket.put(key, body, {
    httpMetadata: { contentType: type },
  })

  return { url: `/api/photos/${key}` }
})
