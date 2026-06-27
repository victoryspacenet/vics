/**
 * 브라우저 Canvas — A|VS|B 공유 썸네일 (서버 API 미배포·실패 시 폴백)
 */
const OUT_W = 1200
const OUT_H = 630
const HALF_W = OUT_W / 2

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

function drawCoverImage(ctx, img, dx, dy, dw, dh) {
  const ir = img.width / img.height
  const dr = dw / dh
  let sw
  let sh
  let sx
  let sy
  if (ir > dr) {
    sh = img.height
    sw = sh * dr
    sx = (img.width - sw) / 2
    sy = 0
  } else {
    sw = img.width
    sh = sw / dr
    sx = 0
    sy = (img.height - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
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
      drawCoverImage(ctx, img, x, 0, HALF_W, OUT_H)
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

function drawVsBadge(ctx) {
  const cx = HALF_W
  const cy = OUT_H / 2
  const r = 44
  ctx.beginPath()
  ctx.arc(cx, cy, r + 3, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = '#4f46e5'
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 16px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('VS', cx, cy)
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'
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
  drawVsBadge(ctx)

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
