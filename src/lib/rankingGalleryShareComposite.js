import { drawCard, CARD_W, CARD_H } from './cardDraw'
import { getGalleryDrawOpts } from './galleryUtils'
import { resolveGalleryCardImageUrl } from './sanitize'
import {
  buildRankingGalleryShareHeadline,
  buildRankingGalleryShareSubline,
  getRankingPageShareUrl,
} from './socialShare'

export const RANKING_SHARE_CARD_W = 1080

const OUTER_PAD = 28
const CARD_RADIUS = 32
const CARD_PAD_X = 40
const CARD_PAD_Y = 36
const MINI_CARD_W = 268
const MINI_CARD_H = Math.round(MINI_CARD_W * (CARD_H / CARD_W))

const GAP = {
  afterMiniCard: 28,
  afterHeadline: 12,
  afterSubline: 18,
  afterCta: 14,
}

const FONT = {
  headline: '900 34px system-ui, "Pretendard Variable", sans-serif',
  subline: '700 28px system-ui, "Pretendard Variable", sans-serif',
  cta: '600 24px system-ui, "Pretendard Variable", sans-serif',
  url: '600 22px system-ui, "Pretendard Variable", sans-serif',
}

const LINE_H = {
  headline: 42,
  cta: 34,
  url: 30,
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function wrapLines(ctx, text, maxWidth) {
  const str = String(text || '')
  if (!str) return ['']

  const words = str.split(/\s+/).filter(Boolean)
  if (words.length > 1) {
    const lines = []
    let line = ''
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line)
        line = word
      } else {
        line = test
      }
    }
    if (line) lines.push(line)
    return lines
  }

  const lines = []
  let line = ''
  for (const ch of str) {
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = ch
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

function createMeasureCtx(font) {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (ctx && font) ctx.font = font
  return ctx
}

function loadImageSrc(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function createRankingCardPreviewSource(card) {
  const thumbUrl = resolveGalleryCardImageUrl(card?.thumbnail)
  if (thumbUrl) {
    try {
      return await loadImageSrc(thumbUrl)
    } catch {
      /* canvas fallback */
    }
  }

  const drawOpts = getGalleryDrawOpts(card)
  if (!drawOpts) return null

  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  drawCard(canvas, drawOpts)
  return canvas
}

function drawMiniRankingCard(ctx, source, centerX, y) {
  const x = centerX - MINI_CARD_W / 2
  ctx.save()
  roundRect(ctx, x, y, MINI_CARD_W, MINI_CARD_H, 18)
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 8
  ctx.fillStyle = '#000'
  ctx.fill()
  ctx.restore()

  ctx.save()
  roundRect(ctx, x, y, MINI_CARD_W, MINI_CARD_H, 18)
  ctx.clip()
  ctx.drawImage(source, x, y, MINI_CARD_W, MINI_CARD_H)
  ctx.restore()

  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = 2
  roundRect(ctx, x, y, MINI_CARD_W, MINI_CARD_H, 18)
  ctx.stroke()
}

function drawLinkUrl(ctx, lines, centerX, startY) {
  ctx.font = FONT.url
  ctx.fillStyle = 'rgba(103,232,249,0.95)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'

  let y = startY
  for (const line of lines) {
    const w = ctx.measureText(line).width
    ctx.fillText(line, centerX, y)
    const underlineY = y + 26
    ctx.beginPath()
    ctx.strokeStyle = 'rgba(103,232,249,0.6)'
    ctx.lineWidth = 2
    ctx.moveTo(centerX - w / 2, underlineY)
    ctx.lineTo(centerX + w / 2, underlineY)
    ctx.stroke()
    y += LINE_H.url
  }
}

/**
 * @param {CanvasRenderingContext2D | null} ctx
 * @param {{ card?: object, nickname?: string, rank?: number, tierName?: string, shareUrl?: string }} opts
 */
async function layoutRankingGalleryShareCard(ctx, opts = {}) {
  const W = RANKING_SHARE_CARD_W
  const cardW = W - OUTER_PAD * 2
  const textMaxW = cardW - CARD_PAD_X * 2

  const shareUrl = opts.shareUrl || getRankingPageShareUrl()
  const headline = buildRankingGalleryShareHeadline(opts.nickname)
  const subline = buildRankingGalleryShareSubline(opts.rank, opts.tierName)
  const cta = 'VictorySpace에서 나도 도전해 보세요 👇'

  const previewSource = opts.card ? await createRankingCardPreviewSource(opts.card) : null
  const miniCardBlockH = previewSource ? MINI_CARD_H + GAP.afterMiniCard : 0

  const measureHeadline = ctx || createMeasureCtx(FONT.headline)
  if (measureHeadline) measureHeadline.font = FONT.headline
  const headlineLines = wrapLines(measureHeadline, headline, textMaxW)

  const measureCta = ctx || createMeasureCtx(FONT.cta)
  if (measureCta) measureCta.font = FONT.cta
  const ctaLines = wrapLines(measureCta, cta, textMaxW)

  const measureUrl = ctx || createMeasureCtx(FONT.url)
  if (measureUrl) measureUrl.font = FONT.url
  const urlLines = wrapLines(measureUrl, shareUrl, textMaxW)

  const sublineH = 34
  const contentH =
    CARD_PAD_Y
    + miniCardBlockH
    + headlineLines.length * LINE_H.headline
    + GAP.afterHeadline
    + sublineH
    + GAP.afterSubline
    + ctaLines.length * LINE_H.cta
    + GAP.afterCta
    + urlLines.length * LINE_H.url
    + CARD_PAD_Y

  const canvasH = OUTER_PAD * 2 + contentH

  return {
    W,
    canvasH,
    cardW,
    contentH,
    shareUrl,
    subline,
    headlineLines,
    ctaLines,
    urlLines,
    previewSource,
    miniCardBlockH,
  }
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ card?: object, nickname?: string, rank?: number, tierName?: string, shareUrl?: string }} opts
 */
export async function drawRankingGalleryShareCard(canvas, opts = {}) {
  const measureCtx = canvas.getContext('2d')
  const layout = await layoutRankingGalleryShareCard(measureCtx, opts)

  canvas.width = layout.W
  canvas.height = layout.canvasH

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const { W, canvasH, cardW, contentH, subline, previewSource } = layout
  const cardX = OUTER_PAD
  const cardY = OUTER_PAD

  const bg = ctx.createLinearGradient(0, 0, W, canvasH)
  bg.addColorStop(0, '#0f0c1d')
  bg.addColorStop(0.55, '#1a1035')
  bg.addColorStop(1, '#0f172a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, canvasH)

  ctx.fillStyle = 'rgba(0,0,0,0.24)'
  roundRect(ctx, cardX, cardY, cardW, contentH, CARD_RADIUS)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.lineWidth = 2
  roundRect(ctx, cardX, cardY, cardW, contentH, CARD_RADIUS)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  let y = cardY + CARD_PAD_Y

  if (previewSource) {
    drawMiniRankingCard(ctx, previewSource, W / 2, y)
    y += MINI_CARD_H + GAP.afterMiniCard
  }

  ctx.fillStyle = '#ffffff'
  ctx.font = FONT.headline
  for (const line of layout.headlineLines) {
    ctx.fillText(line, W / 2, y)
    y += LINE_H.headline
  }

  y += GAP.afterHeadline
  ctx.fillStyle = 'rgba(237,233,254,0.95)'
  ctx.font = FONT.subline
  ctx.fillText(subline, W / 2, y)
  y += 34 + GAP.afterSubline

  ctx.fillStyle = 'rgba(245,208,254,0.92)'
  ctx.font = FONT.cta
  for (const line of layout.ctaLines) {
    ctx.fillText(line, W / 2, y)
    y += LINE_H.cta
  }

  y += GAP.afterCta
  drawLinkUrl(ctx, layout.urlLines, W / 2, y)
}

/**
 * @param {{ card?: object, nickname?: string, rank?: number, tierName?: string, shareUrl?: string }} opts
 * @returns {Promise<Blob|null>}
 */
export async function renderRankingGalleryShareBlob(opts = {}) {
  const canvas = document.createElement('canvas')
  await drawRankingGalleryShareCard(canvas, opts)
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}
