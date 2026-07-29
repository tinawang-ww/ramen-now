import type { Locale, MessageKey } from '~/i18n/messages'
import { messages } from '~/i18n/messages'

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/**
 * The language switch. State lives in useState so every component reads the
 * same ref; a cookie mirrors it so the server renders the language the visitor
 * last picked instead of flashing Chinese first.
 */
export function useLocale() {
  const cookie = useCookie<Locale>('locale', { maxAge: COOKIE_MAX_AGE })

  const locale = useState<Locale>('locale', () =>
    // Guarded because the cookie is client-editable and might hold anything.
    cookie.value && cookie.value in messages ? cookie.value : 'zh')

  function toggleLocale() {
    locale.value = locale.value === 'zh' ? 'en' : 'zh'
    cookie.value = locale.value
  }

  /** Reads locale.value on every call, so computeds and templates re-run on toggle. */
  function t(key: MessageKey, params?: Record<string, string | number>) {
    let text: string = messages[locale.value][key]

    if (params) {
      for (const [name, value] of Object.entries(params))
        text = text.replaceAll(`{${name}}`, String(value))
    }

    return text
  }

  return { locale, t, toggleLocale }
}
