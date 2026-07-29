import type { StampSummary } from '~~/shared/types'

/** UTC on purpose: local formatting could differ between server and client. */
export function stampDate(ms: number) {
  return new Date(ms).toISOString().slice(0, 10).replaceAll('-', '.')
}

/**
 * The palette again, as canvas-ready values — a canvas can't read the CSS
 * variables of a page it was never attached to.
 */
const PAPER = '#fffdf9'
const INK = '#00012a'
const MIST = '#8fb1be'
const TONES = ['#d53302', MIST, '#a0cbad', 'rgba(0, 1, 42, 0.55)']

const FONT = '"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", ui-sans-serif, system-ui, sans-serif'

const WIDTH = 1080
const MARGIN = 96
const COLUMNS = 4
const CELL = (WIDTH - MARGIN * 2) / COLUMNS
const CELL_HEIGHT = 310
const GRID_TOP = 330

/** A card is one passport page, not an archive — past this the number talks. */
const MAX_STAMPS = 12

export interface StampCardText {
  title: string
  subtitle: string
  /** "and {n} more" when the book outgrew the card; empty otherwise. */
  more: string
  tagline: string
  /** The host alone — the card is an invitation, not a tracking link. */
  origin: string
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth)
    return text

  let out = text
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth)
    out = out.slice(0, -1)

  return `${out}…`
}

/** Draws the stamp book as a shareable PNG — same inks and tilts as the page. */
export function renderStampBook(stamps: StampSummary[], text: StampCardText): Promise<Blob> {
  const drawn = stamps.slice(0, MAX_STAMPS)
  const rows = Math.max(1, Math.ceil(drawn.length / COLUMNS))

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = GRID_TOP + rows * CELL_HEIGHT + (text.more ? 60 : 0) + 190

  const ctx = canvas.getContext('2d')
  if (!ctx)
    throw new Error('canvas 2d context unavailable')

  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = INK
  ctx.font = `600 72px ${FONT}`
  ctx.fillText(text.title, MARGIN, 168)

  ctx.fillStyle = 'rgba(0, 1, 42, 0.45)'
  ctx.font = `400 34px ${FONT}`
  ctx.fillText(text.subtitle, MARGIN, 234)

  drawn.forEach((stamp, index) => {
    const cx = MARGIN + CELL * ((index % COLUMNS) + 0.5)
    const cy = GRID_TOP + Math.floor(index / COLUMNS) * CELL_HEIGHT + 100
    const tone = TONES[stamp.shopId % TONES.length]!

    // Same tilt rule as the page: keyed on the id, hand-stamped but stable.
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(((stamp.shopId % 7) - 3) * Math.PI / 180)

    ctx.strokeStyle = tone
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.arc(0, 0, 86, 0, Math.PI * 2)
    ctx.stroke()

    ctx.fillStyle = tone
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `500 68px ${FONT}`
    ctx.fillText([...stamp.name][0] ?? '', 0, -14)
    ctx.font = `400 26px ${FONT}`
    ctx.fillText(`×${stamp.reports}`, 0, 42)
    ctx.restore()

    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = 'rgba(0, 1, 42, 0.5)'
    ctx.font = `400 26px ${FONT}`
    ctx.fillText(truncate(ctx, stamp.name, CELL - 16), cx, cy + 132)
    ctx.fillStyle = MIST
    ctx.font = `400 22px ${FONT}`
    ctx.fillText(stampDate(stamp.firstAt), cx, cy + 168)
    ctx.textAlign = 'left'
  })

  ctx.textAlign = 'center'

  if (text.more) {
    ctx.fillStyle = 'rgba(0, 1, 42, 0.4)'
    ctx.font = `400 28px ${FONT}`
    ctx.fillText(text.more, WIDTH / 2, GRID_TOP + rows * CELL_HEIGHT + 30)
  }

  ctx.fillStyle = 'rgba(0, 1, 42, 0.35)'
  ctx.font = `400 28px ${FONT}`
  ctx.fillText(text.tagline, WIDTH / 2, canvas.height - 118)
  ctx.fillStyle = MIST
  ctx.font = `400 26px ${FONT}`
  ctx.fillText(text.origin, WIDTH / 2, canvas.height - 66)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
      'image/png',
    )
  })
}
