/**
 * 매치업 A vs B 공유·OG용 합성 썸네일 (1200×630)
 */
const Jimp = require('jimp')
const { getMatchupSharePhase } = require('./matchupShareCopy.cjs')
const { renderKoreanSvgToJimp } = require('./koreanSvgRender.cjs')

const OUT_W = 1200
const OUT_H = 630
const HALF_W = OUT_W / 2

const COLORS = {
  leftBg: 0x7c2d12ff,
  rightBg: 0x064e3bff,
  challengeBg: 0x022c22ff,
  badgeRing: 0xffffffff,
  divider: 0xffffffcc,
  leftLabel: 0xf59e0bff,
  rightLabel: 0x10b981ff,
}

let fontWhite16 = null
let fontWhite32 = null

const VS_BADGE_R = 48
const VS_BADGE_RING = 4
const VS_GRADIENT_STOPS = [
  [0, [2, 132, 199]],
  [0.12, [14, 165, 233]],
  [0.26, [56, 189, 248]],
  [0.5, [99, 102, 241]],
  [0.68, [251, 113, 133]],
  [0.84, [239, 68, 68]],
  [1, [220, 38, 38]],
]

function lerpChannel(a, b, t) {
  return Math.round(a + (b - a) * t)
}

function colorAtVsGradient(t) {
  const clamped = Math.max(0, Math.min(1, t))
  for (let i = 0; i < VS_GRADIENT_STOPS.length - 1; i += 1) {
    const [t0, c0] = VS_GRADIENT_STOPS[i]
    const [t1, c1] = VS_GRADIENT_STOPS[i + 1]
    if (clamped >= t0 && clamped <= t1) {
      const local = t1 === t0 ? 0 : (clamped - t0) / (t1 - t0)
      return Jimp.rgbaToInt(
        lerpChannel(c0[0], c1[0], local),
        lerpChannel(c0[1], c1[1], local),
        lerpChannel(c0[2], c1[2], local),
        255,
      )
    }
  }
  const last = VS_GRADIENT_STOPS[VS_GRADIENT_STOPS.length - 1][1]
  return Jimp.rgbaToInt(last[0], last[1], last[2], 255)
}

function blendPixelColor(baseColor, overlayColor, alpha) {
  const br = (baseColor >> 24) & 0xff
  const bg = (baseColor >> 16) & 0xff
  const bb = (baseColor >> 8) & 0xff
  const or = (overlayColor >> 24) & 0xff
  const og = (overlayColor >> 16) & 0xff
  const ob = (overlayColor >> 8) & 0xff
  return Jimp.rgbaToInt(
    Math.round(br * (1 - alpha) + or * alpha),
    Math.round(bg * (1 - alpha) + og * alpha),
    Math.round(bb * (1 - alpha) + ob * alpha),
    255,
  )
}

async function getFonts() {
  if (!fontWhite16) {
    fontWhite16 = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE)
    fontWhite32 = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE)
  }
  return { small: fontWhite16, large: fontWhite32 }
}

function absoluteMediaUrl(raw, baseUrl) {
  if (!raw || typeof raw !== 'string') return null
  if (/^https:\/\//i.test(raw)) return raw
  if (raw.startsWith('//')) return `https:${raw}`
  if (raw.startsWith('/') && baseUrl) return `${String(baseUrl).replace(/\/+$/, '')}${raw}`
  return null
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function wrapTextLines(text, maxCharsPerLine = 16, maxLines = 4) {
  const raw = String(text || '').trim()
  if (!raw) return []
  const lines = []
  let line = ''
  for (const ch of raw) {
    const next = line + ch
    if (next.length > maxCharsPerLine && line) {
      lines.push(line)
      line = ch
      if (lines.length >= maxLines) break
    } else {
      line = next
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  return lines.slice(0, maxLines)
}

async function renderSvgPanelToJimp(svg) {
  return renderKoreanSvgToJimp(svg)
}

async function renderTextSidePanel(side) {
  const bgColor = side.bgHex || '#7c2d12'
  const labelBg = side.labelBgHex || '#f59e0b'
  const lines = wrapTextLines(side.text, 16, 4)
  const lineHeight = 36
  const textStartY = Math.floor(OUT_H / 2 - ((Math.max(lines.length, 1) - 1) * lineHeight) / 2)
  const textNodes = (lines.length ? lines : ['']).map((line, index) => (
    `<text x="${HALF_W / 2}" y="${textStartY + index * lineHeight}" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-size="28" font-weight="600" font-family="sans-serif">${escapeXml(line)}</text>`
  )).join('\n')

  const label = escapeXml(side.label)
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${HALF_W}" height="${OUT_H}" viewBox="0 0 ${HALF_W} ${OUT_H}">
  <rect width="${HALF_W}" height="${OUT_H}" fill="${bgColor}"/>
  <rect x="14" y="14" rx="6" ry="6" width="88" height="26" fill="${labelBg}"/>
  <text x="58" y="27" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-size="14" font-weight="700" font-family="sans-serif">${label}</text>
  ${textNodes}
</svg>`

  try {
    return await renderSvgPanelToJimp(svg)
  } catch (e) {
    console.warn('[matchupShareComposite] text panel svg render failed', e?.message || e)
    const panel = new Jimp(HALF_W, OUT_H, side.bg)
    const fonts = await getFonts()
    panel.print(fonts.large, 16, Math.floor(OUT_H / 2) - 24, {
      text: String(side.text || '').slice(0, 40),
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    }, HALF_W - 32, 120)
    return panel
  }
}

async function renderLabelBadge(side) {
  const label = escapeXml(side.label)
  const labelBg = side.labelBgHex || '#f59e0b'
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="26" viewBox="0 0 120 26">
  <rect x="0" y="0" rx="6" ry="6" width="120" height="26" fill="${labelBg}"/>
  <text x="60" y="13" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-size="14" font-weight="700" font-family="sans-serif">${label}</text>
</svg>`
  try {
    return await renderSvgPanelToJimp(svg)
  } catch {
    const badge = new Jimp(120, 26, side.labelBg)
    const fonts = await getFonts()
    badge.print(fonts.small, 0, 4, {
      text: String(side.label || '').slice(0, 12),
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    }, 120, 26)
    return badge
  }
}

function resolveSide(matchup, side, baseUrl) {
  const isLeft = side === 'left'
  const type = isLeft ? matchup.left_type : matchup.right_type
  const label = String(isLeft ? (matchup.left_label || 'A') : (matchup.right_label || 'B')).slice(0, 12)
  const thumb = isLeft ? matchup.left_thumbnail_url : matchup.right_thumbnail_url
  const url = isLeft ? matchup.left_url : matchup.right_url
  const textRaw = isLeft ? matchup.left_text : matchup.right_text

  let imageUrl = null
  if (type === 'image') {
    imageUrl = absoluteMediaUrl(thumb || url, baseUrl)
  } else if (type === 'video') {
    imageUrl = absoluteMediaUrl(thumb || url, baseUrl)
  }

  return {
    imageUrl,
    text: type === 'text' ? String(textRaw || '').trim().slice(0, 120) : '',
    label,
    bg: isLeft ? COLORS.leftBg : COLORS.rightBg,
    labelBg: isLeft ? COLORS.leftLabel : COLORS.rightLabel,
    bgHex: isLeft ? '#7c2d12' : '#064e3b',
    labelBgHex: isLeft ? '#f59e0b' : '#10b981',
    type: type || 'text',
  }
}

async function renderChallengeRecruitPanel() {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${HALF_W}" height="${OUT_H}" viewBox="0 0 ${HALF_W} ${OUT_H}">
  <rect width="${HALF_W}" height="${OUT_H}" fill="#022c22"/>
  <circle cx="${HALF_W / 2}" cy="${OUT_H / 2 - 8}" r="78" fill="none" stroke="rgba(52,211,153,0.35)" stroke-width="2"/>
  <text x="${HALF_W / 2}" y="${OUT_H / 2 - 6}" text-anchor="middle" dominant-baseline="middle" fill="#6ee7b7" font-size="28" font-weight="700" font-family="sans-serif">도전자 모집 중</text>
  <text x="${HALF_W / 2}" y="${OUT_H / 2 + 72}" text-anchor="middle" font-size="34">⚔️</text>
</svg>`

  try {
    return await renderKoreanSvgToJimp(svg)
  } catch (e) {
    console.warn('[matchupShareComposite] challenge panel svg render failed', e?.message || e)
    return new Jimp(HALF_W, OUT_H, COLORS.challengeBg)
  }
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
    panel = await renderChallengeRecruitPanel()
    return panel
  } else if (side.type === 'text' && side.text) {
    return renderTextSidePanel(side)
  }

  const labelBadge = await renderLabelBadge(side)
  panel.composite(labelBadge, 14, 14)
  return panel
}

function drawVsBadge(canvas) {
  const cx = HALF_W
  const cy = Math.floor(OUT_H / 2)
  const r = VS_BADGE_R
  const ring = VS_BADGE_RING
  const white = COLORS.badgeRing
  const glowBlue = Jimp.rgbaToInt(14, 165, 233, 48)
  const glowRose = Jimp.rgbaToInt(244, 63, 94, 42)

  for (let y = cy - r - ring - 8; y <= cy + r + ring + 8; y += 1) {
    if (y < 0 || y >= OUT_H) continue
    for (let x = cx - r - ring - 8; x <= cx + r + ring + 8; x += 1) {
      if (x < 0 || x >= OUT_W) continue
      const d2 = (x - cx) ** 2 + (y - cy) ** 2
      const glowR = (r + ring + 8) ** 2
      if (d2 <= glowR && d2 > (r + ring + 2) ** 2) {
        const glowColor = x < cx ? glowBlue : glowRose
        const existing = canvas.getPixelColor(x, y)
        canvas.setPixelColor(blendPixelColor(existing, glowColor, 0.55), x, y)
      }
    }
  }

  for (let y = cy - r - ring; y <= cy + r + ring; y += 1) {
    if (y < 0 || y >= OUT_H) continue
    for (let x = cx - r - ring; x <= cx + r + ring; x += 1) {
      if (x < 0 || x >= OUT_W) continue
      const d2 = (x - cx) ** 2 + (y - cy) ** 2
      if (d2 <= (r + ring) ** 2 && d2 >= (r + 1) ** 2) {
        canvas.setPixelColor(white, x, y)
      } else if (d2 <= r * r) {
        const t = (x - (cx - r)) / (2 * r)
        let color = colorAtVsGradient(t)
        const highlightT = Math.max(0, (cy - y) / r)
        if (highlightT > 0) {
          color = blendPixelColor(color, white, Math.min(0.18, highlightT * 0.22))
        }
        canvas.setPixelColor(color, x, y)
      }
    }
  }
}

async function compositeVsLogo(canvas, baseUrl) {
  const logoUrl = baseUrl ? `${String(baseUrl).replace(/\/+$/, '')}/logo.png` : null
  if (!logoUrl) return

  try {
    const logo = await Jimp.read(logoUrl)
    const target = Math.round(VS_BADGE_R * 1.55)
    logo.scaleToFit(target, target)
    const cx = HALF_W
    const cy = Math.floor(OUT_H / 2)
    canvas.composite(
      logo,
      cx - Math.floor(logo.bitmap.width / 2),
      cy - Math.floor(logo.bitmap.height / 2),
    )
  } catch (e) {
    console.warn('[matchupShareComposite] logo load failed', e?.message || e)
  }
}

async function composeMatchupShareImage(matchup, baseUrl) {
  const fonts = await getFonts()
  const canvas = new Jimp(OUT_W, OUT_H, 0x111827ff)

  const left = resolveSide(matchup, 'left', baseUrl)
  let right = resolveSide(matchup, 'right', baseUrl)
  const isRecruiting = getMatchupSharePhase(matchup) === 'recruiting'
  if (isRecruiting) {
    right = {
      imageUrl: null,
      label: String(matchup.right_label || 'B').slice(0, 12),
      bg: COLORS.challengeBg,
      labelBg: COLORS.rightLabel,
      bgHex: '#022c22',
      labelBgHex: '#10b981',
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
  await compositeVsLogo(canvas, baseUrl)

  return canvas.quality(88).getBufferAsync(Jimp.MIME_JPEG)
}

module.exports = {
  composeMatchupShareImage,
  absoluteMediaUrl,
}
