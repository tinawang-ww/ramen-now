const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function formatAgo(timestamp: number, now: number) {
  const diff = Math.max(0, now - timestamp)

  if (diff < MINUTE)
    return '剛剛'
  if (diff < HOUR)
    return `${Math.floor(diff / MINUTE)} 分鐘前`
  if (diff < DAY)
    return `${Math.floor(diff / HOUR)} 小時前`

  return `${Math.floor(diff / DAY)} 天前`
}
