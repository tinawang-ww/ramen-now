/**
 * Slot overrides that make Nuxt UI's form controls look like the rest of the
 * app: a hairline rule you type on, with no box, ring or focus outline.
 *
 * Every value here is a function rather than a class string on purpose. Nuxt UI
 * treats a function as a *replacement* for the classes its theme resolved for
 * that slot, where a string is merged with them — and merging leaves the
 * theme's own padding, ring and outline in play, fighting these.
 *
 * They live in one place because three files draw the same field: the two
 * search boxes, the add-a-shop name, and every row of ReviewForm.
 */

/** The typed-on rule: ReviewForm's fields, and the add-a-shop name on the board. */
export const LINE_FIELD = {
  root: () => 'relative flex w-full items-center',
  base: () => 'w-full border-b border-black/15 bg-transparent pb-1.5 text-[15px] leading-6 text-black/90 outline-none transition-colors duration-200 placeholder:text-black/25 focus:border-black/60',
}

/**
 * The search box at the top of the board and the feed. The rule sits on the
 * root so the input and the clear button in the trailing slot share it, and
 * WebKit's built-in cancel button is hidden — it sits inside the field at a
 * size and colour we can't touch.
 */
export const SEARCH_FIELD = {
  root: () => 'relative mt-8 flex w-full items-center gap-3 border-b border-black/[0.07] pb-1.5',
  base: () => 'min-w-0 flex-1 bg-transparent text-[15px] leading-6 text-black/90 outline-none placeholder:text-black/25 [&::-webkit-search-cancel-button]:hidden',
  trailing: () => 'flex items-center',
}

/** UFormField's label above one of those rules. */
export const FIELD_LABEL = {
  root: () => '',
  label: () => 'block text-[11px] leading-4 text-black/30',
  container: () => 'mt-1.5',
}
