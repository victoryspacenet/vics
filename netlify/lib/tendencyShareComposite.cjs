/**
 * 성향 리포트 공유 OG 썸네일 (1200×630) — 로고 · 성향 문구 · URL
 */
const Jimp = require('jimp')

const OUT_W = 1200
const OUT_H = 630
const BG = 0x0f0c1dff

let fontWhite16 = null
let fontWhite32 = null
let fontWhite64 = null

async function getFonts() {
  if (!fontWhite16) {
    fontWhite16 = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE)
    fontWhite32 = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE)
    fontWhite64 = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE)
  }
  return { small: fontWhite16, medium: fontWhite32, large: fontWhite64 }
}

function sanitizeLine(value, maxLen = 120) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
}

function shortenUrlForDisplay(url) {
  const raw = String(url || '').trim()
  if (!raw) return 'victoryspace.net'
  try {
    const u = new URL(raw)
    return `${u.host}${u.pathname}`.replace(/\/+$/, '') || u.host
  } catch {
    return raw.replace(/^https?:\/\//i, '').slice(0, 64)
  }
}

/**
 * @param {{ logoUrl?: string, middleLine?: string, shareUrl?: string }} opts
 */
async function composeTendencyShareOgImage(opts = {}) {
  const canvas = new Jimp(OUT_W, OUT_H, BG)
  const fonts = await getFonts()
  const middleLine = sanitizeLine(opts.middleLine, 100) || 'VictorySpace 성향 리포트'
  const urlLine = shortenUrlForDisplay(opts.shareUrl)

  let contentTop = 48

  if (opts.logoUrl) {
    try {
      const logo = await Jimp.read(opts.logoUrl)
      logo.scaleToFit(360, 96)
      const lx = Math.floor((OUT_W - logo.bitmap.width) / 2)
      canvas.composite(logo, lx, contentTop)
      contentTop += logo.bitmap.height + 36
    } catch (e) {
      console.warn('[tendencyShareComposite] logo load failed', e?.message || e)
    }
  }

  const textWidth = OUT_W - 160
  const textX = 80

  canvas.print(
    fonts.large,
    textX,
    contentTop,
    { text: middleLine, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER },
    textWidth,
    160,
  )

  canvas.print(
    fonts.small,
    0,
    OUT_H - 72,
    { text: urlLine, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER },
    OUT_W,
    32,
  )

  return canvas.quality(88).getBufferAsync(Jimp.MIME_JPEG)
}

module.exports = { composeTendencyShareOgImage, sanitizeLine }
