/**
 * 매치업 A vs B 공유·OG용 합성 썸네일 (1200×630)
 */
const Jimp = require('jimp')

const OUT_W = 1200
const OUT_H = 630
const HALF_W = OUT_W / 2

const COLORS = {
  leftBg: 0x7c2d12ff,
  rightBg: 0x064e3bff,
  challengeBg: 0x022c22ff,
  badgeFill: 0x4f46e5ff,
  badgeRing: 0xffffffff,
  divider: 0xffffffcc,
  leftLabel: 0xf59e0bff,
  rightLabel: 0x10b981ff,
}

let fontWhite16 = null
let fontWhite32 = null
let fontWhite64 = null

const VS_BADGE_R = 44
const VS_BADGE_RING = 3

async function getFonts() {
  if (!fontWhite16) {
    fontWhite16 = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE)
    fontWhite32 = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE)
    fontWhite64 = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE)
  }
  return { small: fontWhite16, large: fontWhite32, vs: fontWhite64 }
}

function absoluteMediaUrl(raw, baseUrl) {
  if (!raw || typeof raw !== 'string') return null
  if (/^https:\/\//i.test(raw)) return raw
  if (raw.startsWith('//')) return `https:${raw}`
  if (raw.startsWith('/') && baseUrl) return `${String(baseUrl).replace(/\/+$/, '')}${raw}`
  return null
}

function resolveSide(matchup, side, baseUrl) {
  const isLeft = side === 'left'
  const type = isLeft ? matchup.left_type : matchup.right_type
  const label = String(isLeft ? (matchup.left_label || 'A') : (matchup.right_label || 'B')).slice(0, 12)
  const thumb = isLeft ? matchup.left_thumbnail_url : matchup.right_thumbnail_url
  const url = isLeft ? matchup.left_url : matchup.right_url

  let imageUrl = null
  if (type === 'image') {
    imageUrl = absoluteMediaUrl(thumb || url, baseUrl)
  } else if (type === 'video') {
    imageUrl = absoluteMediaUrl(thumb || url, baseUrl)
  }

  return {
    imageUrl,
    label,
    bg: isLeft ? COLORS.leftBg : COLORS.rightBg,
    labelBg: isLeft ? COLORS.leftLabel : COLORS.rightLabel,
    type: type || 'text',
  }
}

function hasRightContent(matchup) {
  return Boolean(
    matchup.right_type
    || matchup.right_url
    || matchup.right_thumbnail_url
    || matchup.right_text
    || matchup.is_complete,
  )
}

async function renderSidePanel(side, fonts) {
  let panel = new Jimp(HALF_W, OUT_H, side.bg)

  if (side.imageUrl) {
    try {
      const img = await Jimp.read(side.imageUrl)
      img.scaleToFit(HALF_W, OUT_H)
      const x = Math.floor((HALF_W - img.bitmap.width) / 2)
      const y = Math.floor((OUT_H - img.bitmap.height) / 2)
      panel.composite(img, x, y)
    } catch {
      panel = new Jimp(HALF_W, OUT_H, side.bg)
    }
  } else if (side.type === 'challenge') {
    panel.print(fonts.large, 0, Math.floor(OUT_H / 2) - 20, {
      text: '?',
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    }, HALF_W, OUT_H)
  }

  const labelStrip = new Jimp(40, 26, side.labelBg)
  labelStrip.print(fonts.small, 0, 4, {
    text: side.label,
    alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
  }, 40, 26)
  panel.composite(labelStrip, 14, 14)
  return panel
}

function drawVsBadge(canvas) {
  const cx = HALF_W
  const cy = Math.floor(OUT_H / 2)
  const r = VS_BADGE_R
  const ring = VS_BADGE_RING
  for (let y = cy - r - ring; y <= cy + r + ring; y++) {
    if (y < 0 || y >= OUT_H) continue
    for (let x = cx - r - ring; x <= cx + r + ring; x++) {
      if (x < 0 || x >= OUT_W) continue
      const d2 = (x - cx) ** 2 + (y - cy) ** 2
      if (d2 <= (r + ring) ** 2 && d2 >= (r + 1) ** 2) {
        canvas.setPixelColor(COLORS.badgeRing, x, y)
      } else if (d2 <= r * r) {
        canvas.setPixelColor(COLORS.badgeFill, x, y)
      }
    }
  }
}

function printVsLabel(canvas, fonts) {
  const cx = HALF_W
  const cy = Math.floor(OUT_H / 2)
  const box = VS_BADGE_R * 2 + 8
  canvas.print(fonts.vs, cx - Math.floor(box / 2), cy - Math.floor(box / 2), {
    text: 'VS',
    alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE,
  }, box, box)
}

async function composeMatchupShareImage(matchup, baseUrl) {
  const fonts = await getFonts()
  const canvas = new Jimp(OUT_W, OUT_H, 0x111827ff)

  const left = resolveSide(matchup, 'left', baseUrl)
  let right = resolveSide(matchup, 'right', baseUrl)
  if (!hasRightContent(matchup) && !right.imageUrl) {
    right = {
      imageUrl: null,
      label: right.label,
      bg: COLORS.challengeBg,
      labelBg: COLORS.rightLabel,
      type: 'challenge',
    }
  }

  const leftPanel = await renderSidePanel(left, fonts)
  const rightPanel = await renderSidePanel(right, fonts)
  canvas.composite(leftPanel, 0, 0)
  canvas.composite(rightPanel, HALF_W, 0)

  for (let y = 0; y < OUT_H; y++) {
    canvas.setPixelColor(COLORS.divider, HALF_W, y)
  }

  drawVsBadge(canvas)
  printVsLabel(canvas, fonts)

  return canvas.quality(88).getBufferAsync(Jimp.MIME_JPEG)
}

module.exports = {
  composeMatchupShareImage,
  absoluteMediaUrl,
}
