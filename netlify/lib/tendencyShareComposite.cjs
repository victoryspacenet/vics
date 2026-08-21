/**
 * 성향 리포트 공유 OG 썸네일 (1200×630) — 로고 · 성향 문구 · URL
 */
const Jimp = require('jimp')
const { wrapToWidth, renderTextLayer } = require('./shareTextSvg.cjs')

const OUT_W = 1200
const OUT_H = 630
const BG = 0x0f0c1dff

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
  const middleLine = sanitizeLine(opts.middleLine, 100) || 'VictorySpace 성향 리포트'
  const urlLine = shortenUrlForDisplay(opts.shareUrl)

  let contentTop = 56

  if (opts.logoUrl) {
    try {
      const logo = await Jimp.read(opts.logoUrl)
      logo.scaleToFit(300, 92)
      const lx = Math.floor((OUT_W - logo.bitmap.width) / 2)
      canvas.composite(logo, lx, contentTop)
      contentTop += logo.bitmap.height + 48
    } catch (e) {
      console.warn('[tendencyShareComposite] logo load failed', e?.message || e)
    }
  }

  const lines = wrapToWidth(middleLine, 52, OUT_W - 200, 3)
  const lineHeight = 72
  const blockTop = Math.max(contentTop + 40, Math.floor(OUT_H / 2) - ((lines.length - 1) * lineHeight) / 2)

  const nodes = lines.map((line, i) => ({
    x: OUT_W / 2,
    y: blockTop + i * lineHeight,
    text: line,
    size: 52,
  }))
  nodes.push({ x: OUT_W / 2, y: OUT_H - 58, text: urlLine, size: 24, opacity: 0.75 })

  const textLayer = await renderTextLayer({ width: OUT_W, height: OUT_H, nodes })
  if (textLayer) canvas.composite(textLayer, 0, 0)

  return canvas.quality(88).getBufferAsync(Jimp.MIME_JPEG)
}

module.exports = { composeTendencyShareOgImage, sanitizeLine }
