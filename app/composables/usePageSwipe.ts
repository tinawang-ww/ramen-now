import type { MaybeRefOrGetter } from 'vue'

/** A swipe starting this close to the left edge belongs to iOS Safari's back gesture. */
const EDGE_GUARD_PX = 32

/**
 * Controls where a horizontal drag means something else: moving the caret,
 * selecting text. Buttons and links are deliberately absent — the board's rows
 * are full-width buttons, so excluding them would kill the gesture across most
 * of the page, and a touch that travels far enough to count as a swipe is past
 * the browser's slop threshold, so it never lands as a click anyway.
 */
const INTERACTIVE = 'input, textarea, select, [contenteditable], [role="slider"]'

/**
 * Swipe left or right to move between the main surfaces. Additive only: the nav
 * links stay the primary route, and the only keyboard one.
 *
 * `passive` is left at its default true, so this never blocks native scrolling.
 * The cost is that the page can't track the finger 1:1 — it commits on release.
 * Following the finger would mean both surfaces living in one scroll-snap
 * container, which would cost /feed its own URL.
 */
export function usePageSwipe(target: MaybeRefOrGetter<EventTarget | null | undefined>) {
  const route = useRoute()

  /** Set per gesture by onSwipeStart; false means "this one is not ours". */
  let eligible = false

  const { lengthX, lengthY } = useSwipe(target, {
    // 50 is a little eager for a full-page change.
    threshold: 60,

    onSwipeStart(event) {
      eligible = false

      if (surfaceIndex(route.path) < 0)
        return

      const from = event.touches[0]

      if (!from || from.clientX < EDGE_GUARD_PX)
        return

      if ((event.target as HTMLElement | null)?.closest(INTERACTIVE))
        return

      eligible = true
    },

    onSwipeEnd(_event, direction) {
      if (!eligible)
        return

      eligible = false

      // direction already picks the dominant axis, but a diagonal thumb-scroll
      // still reads as left/right — this is what keeps scrolling from paging.
      if (Math.abs(lengthX.value) <= Math.abs(lengthY.value) * 1.5)
        return

      const step = direction === 'left' ? 1 : direction === 'right' ? -1 : 0

      if (step === 0)
        return

      const next = SURFACES[surfaceIndex(route.path) + step]

      // Nothing past either end. With two surfaces, wrapping would imply a third.
      if (!next)
        return

      navigateTo(next.path)
    },
  })
}
