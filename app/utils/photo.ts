/** Mirrors the server's cap in server/utils/photos.ts. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024

const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** Longest edge after compression — plenty for a feed, tiny next to a camera original. */
const MAX_EDGE = 1600

/**
 * Downscale to a feed-sized JPEG before upload. This is also the HEIC path:
 * Safari decodes HEIC into the bitmap, and what leaves is a JPEG every
 * browser can show. When decoding fails the original goes as-is, and the
 * caller's type/size check decides whether that's acceptable.
 */
export async function compressPhoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))

    const ctx = canvas.getContext('2d')
    if (!ctx)
      return file

    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', 0.82))

    if (blob)
      return blob
  }
  catch {
    // Fall through: the original file speaks for itself below.
  }

  return file
}

/** True when a blob can go to the server as-is. */
export function isUploadablePhoto(blob: Blob) {
  return PHOTO_TYPES.has(blob.type) && blob.size <= MAX_PHOTO_BYTES
}
