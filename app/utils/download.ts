/**
 * Hands a blob to the browser as a saved file.
 *
 * The anchor has to be in the document — Firefox ignores a click on one that
 * isn't — and the object URL has to outlive that click, because the download
 * starts a tick or two later and finds nothing if the URL was already revoked.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.hidden = true

  // appendChild, not append: the worker types in scope here declare their own
  // Element.append, and it takes response bodies rather than nodes.
  document.body.appendChild(link)
  link.click()
  link.remove()

  // Long enough for any browser to have taken the bytes, short enough that the
  // blob doesn't sit in memory for the rest of the session.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
