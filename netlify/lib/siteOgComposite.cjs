/**
 * 사이트 기본 OG 썸네일 (1200×630) — logo.png contain, 잘림 방지
 */
const Jimp = require('jimp')

const OUT_W = 1200
const OUT_H = 630
const BG = 0x111827ff
const MAX_LOGO_W = 880
const MAX_LOGO_H = 480

async function composeSiteOgImage(logoUrl) {
  const canvas = new Jimp(OUT_W, OUT_H, BG)
  if (!logoUrl) {
    return canvas.quality(88).getBufferAsync(Jimp.MIME_JPEG)
  }

  try {
    const logo = await Jimp.read(logoUrl)
    logo.scaleToFit(MAX_LOGO_W, MAX_LOGO_H)
    const x = Math.floor((OUT_W - logo.bitmap.width) / 2)
    const y = Math.floor((OUT_H - logo.bitmap.height) / 2)
    canvas.composite(logo, x, y)
  } catch (e) {
    console.warn('[siteOgComposite] logo load failed', e?.message || e)
  }

  return canvas.quality(88).getBufferAsync(Jimp.MIME_JPEG)
}

module.exports = { composeSiteOgImage }
