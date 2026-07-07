/**
 * 랭킹 갤러리 공유 OG 썸네일 (1200×630) — 로고 · 미니 카드 · 순위 · URL
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

function sanitizeParam(value, maxLen = 40) {
  return String(value || '').trim().slice(0, maxLen)
}

/**
 * @param {{ logoUrl?: string, thumbUrl?: string, rank?: string|number, tier?: string, nickname?: string }} opts
 */
async function composeRankingShareOgImage(opts = {}) {
  const canvas = new Jimp(OUT_W, OUT_H, BG)
  const fonts = await getFonts()
  const rank = sanitizeParam(opts.rank, 8) || '?'
  const tier = sanitizeParam(opts.tier, 16) || 'Player'

  let contentTop = 40

  if (opts.logoUrl) {
    try {
      const logo = await Jimp.read(opts.logoUrl)
      logo.scaleToFit(320, 88)
      const lx = Math.floor((OUT_W - logo.bitmap.width) / 2)
      canvas.composite(logo, lx, contentTop)
      contentTop += logo.bitmap.height + 24
    } catch (e) {
      console.warn('[rankingShareComposite] logo load failed', e?.message || e)
    }
  }

  const thumbW = 168
  const thumbH = Math.round(thumbW * (16 / 9))
  const thumbX = 96
  const thumbY = Math.floor((OUT_H - thumbH) / 2)
  let textCenterX = OUT_W / 2
  let textWidth = OUT_W - 160

  if (opts.thumbUrl) {
    try {
      const thumb = await Jimp.read(opts.thumbUrl)
      thumb.cover(thumbW, thumbH)
      canvas.composite(thumb, thumbX, thumbY)
      textCenterX = thumbX + thumbW + (OUT_W - thumbX - thumbW) / 2
      textWidth = OUT_W - thumbX - thumbW - 80
    } catch (e) {
      console.warn('[rankingShareComposite] thumb load failed', e?.message || e)
    }
  }

  const rankLine = `#${rank} · ${tier}`
  const urlLine = 'www.victoryspace.net/ranking'

  canvas.print(
    fonts.large,
    Math.floor(textCenterX - textWidth / 2),
    Math.max(contentTop, thumbY + 40),
    { text: rankLine, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER },
    textWidth,
    80,
  )

  canvas.print(
    fonts.medium,
    Math.floor(textCenterX - textWidth / 2),
    Math.max(contentTop + 88, thumbY + 140),
    { text: 'VictorySpace Ranking', alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER },
    textWidth,
    48,
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

module.exports = { composeRankingShareOgImage }
