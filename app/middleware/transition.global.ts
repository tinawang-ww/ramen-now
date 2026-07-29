/**
 * Travelling between the two main surfaces should look like travelling in that
 * direction. No transition anywhere else, so /login and /me are never wrapped
 * in one — which is also what keeps a stray comment in their template from
 * mattering.
 *
 * Assigned on every navigation rather than only the interesting one: route meta
 * lives on the route record, so a name left behind by an earlier trip would
 * still be there the next time that route is entered from somewhere else.
 */
export default defineNuxtRouteMiddleware((to, from) => {
  const toIndex = surfaceIndex(to.path)
  const fromIndex = surfaceIndex(from.path)
  const between = toIndex >= 0 && fromIndex >= 0 && toIndex !== fromIndex

  to.meta.pageTransition = between
    ? { name: toIndex > fromIndex ? 'surface-forward' : 'surface-back', mode: 'out-in' }
    : false
})
