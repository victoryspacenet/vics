/**
 * 브라우저 Canvas — A|VS|B 공유 썸네일 (서버 API 미배포·실패 시 폴백)
 */
const OUT_W = 1200
const OUT_H = 630
const HALF_W = OUT_W / 2
const VS_BADGE_R = 48
const VS_BADGE_RING = 4
const VS_GRADIENT_STOPS = [
  [0, '#0284c7'],
  [0.12, '#0ea5e9'],
  [0.26, '#38bdf8'],
  [0.5, '#6366f1'],
  [0.68, '#fb7185'],
  [0.84, '#ef4444'],
  [1, '#dc2626'],
]

function absoluteMediaUrl(raw, baseUrl, safeMediaUrlFn) {
  if (!raw || typeof raw !== 'string') return null
  const safe = safeMediaUrlFn ? safeMediaUrlFn(raw) : raw
  if (!safe) return null
  if (/^https:\/\//i.test(safe)) return safe
  if (safe.startsWith('//')) return `https:${safe}`
  if (safe.startsWith('/') && baseUrl) return `${String(baseUrl).replace(/\/+$/, '')}${safe}`
  return null
}

function resolveSide(matchup, side, baseUrl, safeMediaUrlFn) {
  const isLeft = side === 'left'
  const type = isLeft ? matchup.left_type : matchup.right_type
  const label = String(isLeft ? (matchup.left_label || 'A') : (matchup.right_label || 'B')).slice(0, 12)
  const thumb = isLeft ? matchup.left_thumbnail_url : matchup.right_thumbnail_url
  const url = isLeft ? matchup.left_url : matchup.right_url

  let imageUrl = null
  if (type === 'image' || type === 'video') {
    imageUrl = absoluteMediaUrl(thumb || url, baseUrl, safeMediaUrlFn)
  }

  return {
    imageUrl,
    label,
    bg: isLeft ? '#7c2d12' : '#064e3b',
    labelBg: isLeft ? '#f59e0b' : '#10b981',
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

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = url
  })
}

/** 패널 안에 이미지 전체가 보이도록 contain (좌우·상하 잘림 없음) */
function drawContainImage(ctx, img, dx, dy, dw, dh) {
  const ir = img.width / img.height
  const dr = dw / dh
  let drawW
  let drawH
  if (ir > dr) {
    drawW = dw
    drawH = dw / ir
  } else {
    drawH = dh
    drawW = dh * ir
  }
  const x = dx + (dw - drawW) / 2
  const y = dy + (dh - drawH) / 2
  ctx.drawImage(img, x, y, drawW, drawH)
}

function drawLabel(ctx, label, labelBg, x, y) {
  ctx.font = 'bold 14px system-ui, sans-serif'
  const padX = 10
  const w = Math.min(ctx.measureText(label).width + padX * 2, 160)
  const h = 26
  ctx.fillStyle = labelBg
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 6)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x + w / 2, y + h / 2)
}

async function drawSidePanel(ctx, side, x) {
  ctx.fillStyle = side.bg
  ctx.fillRect(x, 0, HALF_W, OUT_H)

  if (side.imageUrl) {
    try {
      const img = await loadImage(side.imageUrl)
      drawContainImage(ctx, img, x, 0, HALF_W, OUT_H)
    } catch {
      ctx.fillStyle = side.bg
      ctx.fillRect(x, 0, HALF_W, OUT_H)
    }
  } else if (side.type === 'challenge') {
    ctx.fillStyle = '#022c22'
    ctx.fillRect(x, 0, HALF_W, OUT_H)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 72px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('?', x + HALF_W / 2, OUT_H / 2)
  }

  drawLabel(ctx, side.label, side.labelBg, x + 14, 14)
}

function createVsBadgeGradient(ctx, cx, cy, r) {
  const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy)
  for (const [stop, color] of VS_GRADIENT_STOPS) {
    grad.addColorStop(stop, color)
  }
  return grad
}

async function drawVsBadge(ctx, baseOrigin = '') {
  const cx = HALF_W
  const cy = OUT_H / 2
  const r = VS_BADGE_R
  const ring = VS_BADGE_RING

  ctx.save()
  ctx.shadowColor = 'rgba(14, 165, 233, 0.4)'
  ctx.shadowBlur = 16
  ctx.shadowOffsetY = 4
  ctx.beginPath()
  ctx.arc(cx, cy, r + ring, 0, Math.PI * 2)
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = ring * 2
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.closePath()
  ctx.fillStyle = createVsBadgeGradient(ctx, cx, cy, r)
  ctx.fill()

  const highlight = ctx.createLinearGradient(cx, cy - r, cx, cy)
  highlight.addColorStop(0, 'rgba(255, 255, 255, 0.18)')
  highlight.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = highlight
  ctx.fill()
  ctx.restore()

  const logoUrl = baseOrigin
    ? `${String(baseOrigin).replace(/\/+$/, '')}/logo.png`
    : '/logo.png'
  try {
    const logo = await loadImage(logoUrl)
    const target = Math.round(VS_BADGE_R * 1.55)
    const ratio = Math.min(target / logo.width, target / logo.height)
    const drawW = logo.width * ratio
    const drawH = logo.height * ratio
    ctx.drawImage(logo, cx - drawW / 2, cy - drawH / 2, drawW, drawH)
  } catch {
    /* logo optional */
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.8)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cx, 0)
  ctx.lineTo(cx, OUT_H)
  ctx.stroke()
}

/**
 * @param {object} matchup
 * @param {(url: string) => string} safeMediaUrlFn
 * @param {string} [baseOrigin]
 */
export async function composeMatchupShareBlob(matchup, safeMediaUrlFn, baseOrigin = '') {
  const canvas = document.createElement('canvas')
  canvas.width = OUT_W
  canvas.height = OUT_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unsupported')

  ctx.fillStyle = '#111827'
  ctx.fillRect(0, 0, OUT_W, OUT_H)

  const left = resolveSide(matchup, 'left', baseOrigin, safeMediaUrlFn)
  let right = resolveSide(matchup, 'right', baseOrigin, safeMediaUrlFn)
  if (!hasRightContent(matchup) && !right.imageUrl) {
    right = {
      imageUrl: null,
      label: right.label,
      bg: '#022c22',
      labelBg: '#10b981',
      type: 'challenge',
    }
  }

  await drawSidePanel(ctx, left, 0)
  await drawSidePanel(ctx, right, HALF_W)
  await drawVsBadge(ctx, baseOrigin)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('blob failed'))),
      'image/jpeg',
      0.88,
    )
  })
}

/** 서버 합성 API → 실패 시 브라우저 Canvas 폴백 */
export async function fetchMatchupShareBlob({ imageUrl, matchup, safeMediaUrlFn, baseOrigin }) {
  if (imageUrl) {
    try {
      const res = await fetch(imageUrl)
      const contentType = res.headers.get('content-type') || ''
      if (res.ok && contentType.includes('image')) {
        return await res.blob()
      }
    } catch {
      /* browser fallback */
    }
  }
  if (matchup && safeMediaUrlFn) {
    return composeMatchupShareBlob(matchup, safeMediaUrlFn, baseOrigin)
  }
  throw new Error('share image unavailable')
}
