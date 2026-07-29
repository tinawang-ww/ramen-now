/**
 * The two main surfaces, in the order they sit next to each other. This is the
 * single source of that order: the nav row, the page transition direction and
 * the swipe gesture all read it, so "食記 is to the right of 看板" is stated
 * once instead of three times. Labels are message keys — the nav translates
 * them with t() so they follow the language toggle.
 */
export const SURFACES = [
  { path: '/', labelKey: 'nav.board' },
  { path: '/feed', labelKey: 'nav.feed' },
] as const

/** -1 for anything that isn't a main surface, which is how /login and /me opt out. */
export function surfaceIndex(path: string) {
  return SURFACES.findIndex(surface => surface.path === path)
}
