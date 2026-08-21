/**
 * 랭킹 갤러리 공유 OG 썸네일 (1200×630) — 로고 · 미니 카드 · 순위 · URL
 */
const Jimp = require('jimp')
const { wrapByChars, renderTextLayer } = require('./shareTextSvg.cjs')

const OUT_W = 1200
const OUT_H = 630
const BG = 0x0f0c1dff

function sanitizeParam(value, maxLen = 40) {
  return String(value || '').trim().slice(0, maxLen)
}

/**
 * @param {{ logoUrl?: string, thumbUrl?: string, rank?: string|number, tier?: string, nickname?: string }} opts
 */
async function composeRankingShareOgImage(opts = {}) {
  const canvas = new Jimp(OUT_W, OUT_H, BG)
  const rank = sanitizeParam(opts.rank, 8) || '?'
  const tier = sanitizeParam(opts.tier, 16) || 'Player'
  const nickname = sanitizeParam(opts.nickname, 24)

  let contentTop = 40

  if (opts.logoUrl) {
    try {
      const logo = await Jimp.read(opts.logoUrl)
      logo.scaleToFit(280, 80)
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

  if (opts.thumbUrl) {
    try {
      const thumb = await Jimp.read(opts.thumbUrl)
      thumb.cover(thumbW, thumbH)
      canvas.composite(thumb, thumbX, thumbY)
      textCenterX = thumbX + thumbW + (OUT_W - thumbX - thumbW) / 2
    } catch (e) {
      console.warn('[rankingShareComposite] thumb load failed', e?.message || e)
    }
  }

  const nodes = []
  let y = Math.max(contentTop + 60, Math.floor(OUT_H / 2) - 70)

  if (nickname) {
    for (const line of wrapByChars(`${nickname}님의 VICS 랭킹 카드`, 18, 2)) {
      nodes.push({ x: textCenterX, y, text: line, size: 40, weight: 700 })
      y += 54
    }
    y += 30
  }

  nodes.push({ x: textCenterX, y, text: `#${rank} · ${tier}`, size: 68, weight: 700 })
  y += 72
  nodes.push({
    x: textCenterX,
    y,
    text: 'VictorySpace에서 나도 도전해 보세요',
    size: 30,
    weight: 400,
    opacity: 0.82,
  })
  nodes.push({
    x: OUT_W / 2,
    y: OUT_H - 58,
    text: 'www.victoryspace.net/ranking',
    size: 24,
    weight: 400,
    opacity: 0.75,
  })

  const textLayer = await renderTextLayer({ width: OUT_W, height: OUT_H, nodes })
  if (textLayer) canvas.composite(textLayer, 0, 0)

  return canvas.quality(88).getBufferAsync(Jimp.MIME_JPEG)
}

module.exports = { composeRankingShareOgImage }
