import type { Locale } from '~/i18n/messages'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function formatAgo(timestamp: number, now: number, locale: Locale = 'zh') {
  const diff = Math.max(0, now - timestamp)

  if (locale === 'en') {
    if (diff < MINUTE)
      return 'just now'
    if (diff < HOUR)
      return `${Math.floor(diff / MINUTE)} min ago`
    if (diff < DAY)
      return `${Math.floor(diff / HOUR)} hr ago`

    return `${Math.floor(diff / DAY)} d ago`
  }

  if (diff < MINUTE)
    return '剛剛'
  if (diff < HOUR)
    return `${Math.floor(diff / MINUTE)} 分鐘前`
  if (diff < DAY)
    return `${Math.floor(diff / HOUR)} 小時前`

  return `${Math.floor(diff / DAY)} 天前`
}
