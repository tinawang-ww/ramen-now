/**
 * The languages the app speaks. It lives in shared/ rather than app/i18n
 * because formatters down here — distances, and one day server-side validation
 * messages — need to name a language without importing the app's dictionary.
 *
 * app/i18n/messages.ts asserts its dictionaries cover exactly this union, so
 * adding a locale here fails typecheck until the strings exist.
 */
export type Locale = 'zh' | 'en'
