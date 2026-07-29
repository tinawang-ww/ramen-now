/**
 * Travelling between the two main surfaces should look like travelling in that
 * direction. Everything else — into or out of /login and /me, and the first
 * load — keeps whatever transition it already had.
 */
export default defineNuxtRouteMiddleware((to, from) => {
  const toIndex = surfaceIndex(to.path)
  const fromIndex = surfaceIndex(from.path)

  if (toIndex < 0 || fromIndex < 0 || toIndex === fromIndex)
    return

  to.meta.pageTransition = {
    name: toIndex > fromIndex ? 'surface-forward' : 'surface-back',
    mode: 'out-in',
  }
})
