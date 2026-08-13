/**
 * Puts an image on the clipboard, so it can be pasted straight into a chat or a
 * post instead of going through a file.
 *
 * Reports failure instead of throwing: a browser with no image clipboard, and
 * one that refuses the write because the tap has been spent, are the same thing
 * to the caller — hand over the file some other way.
 */
export async function copyImage(blob: Blob): Promise<boolean> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write)
    return false

  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])

    return true
  }
  catch {
    return false
  }
}
