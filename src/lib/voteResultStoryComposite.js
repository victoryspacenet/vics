/**
 * 투표 결과 스토리 카드 — Canvas 합성 (html-to-image DOM 캡처 대체)
 */
import { safeMediaUrl } from './sanitize'
import { displayVoteTotal } from './displayVoteCount'

const CARD_W = 900
const HEADER_H = 52
const PANEL_H = 450
const BAR_H = 8
const FOOTER_H = 124
const CARD_H = HEADER_H + PANEL_H + BAR_H + FOOTER_H
const HALF_W = CARD_W / 2

const VS_GRADIENT_STOPS = [
  [0, '#0284c7'],
  [0.12, '#0ea5e9'],
  [0.26, '#38bdf8'],
  [0.5, '#6366f1'],
  [0.68, '#fb7185'],
  [0.84, '#ef4444'],
  [1, '#dc2626'],
]

const FONT =
  'system-ui, "Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'

function wrapLines(text, maxChars = 22, maxLines = 3) {
  const raw = String(text || '').trim()
  if (!raw) return []
  const lines = []
  let line = ''
  for (const ch of raw) {
    const next = line + ch
    if (next.length > maxChars && line) {
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

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = url
  })
}

function drawCoverImage(ctx, img, x, y, w, h) {
  const ir = img.width / img.height
  const dr = w / h
  let sw
  let sh
  let sx = 0
  let sy = 0
  if (ir > dr) {
    sh = img.height
    sw = img.height * dr
    sx = (img.width - sw) / 2
  } else {
    sw = img.width
    sh = img.width / dr
    sy = (img.height - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

function drawBackground(ctx) {
  const grad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H)
  grad.addColorStop(0, '#1e1b4b')
  grad.addColorStop(0.45, '#312e81')
  grad.addColorStop(1, '#1e293b')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, CARD_W, CARD_H)
}

async function drawHeader(ctx, hashTag) {
  const y0 = HEADER_H / 2
  try {
    const logo = await loadImage('/logo.png')
    const logoH = 28
    const ratio = logoH / logo.height
    const logoW = logo.width * ratio
    ctx.filter = 'invert(1)'
    ctx.drawImage(logo, 20, y0 - logoH / 2, logoW, logoH)
    ctx.filter = 'none'
  } catch {
    /* optional */
  }

  ctx.fillStyle = '#ffffff'
  ctx.font = `900 14px ${FONT}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('VICS', 56, y0)

  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = `600 11px ${FONT}`
  ctx.textAlign = 'right'
  ctx.fillText(String(hashTag || '#VICS_매치업').slice(0, 24), CARD_W - 20, y0)
}

function drawBadge(ctx, text, x, y, { fill, color = '#fff' }) {
  ctx.font = `900 11px ${FONT}`
  const padX = 8
  const w = ctx.measureText(text).width + padX * 2
  const h = 20
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 10)
  ctx.fill()
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + w / 2, y + h / 2)
  return w
}

function drawTextPanel(ctx, x, y, w, h, text, tint = 'rgba(255,255,255,0.1)') {
  ctx.fillStyle = tint
  ctx.fillRect(x, y, w, h)
  const lines = wrapLines(text, 14, 5)
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 13px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lineH = 18
  const startY = y + h / 2 - ((lines.length - 1) * lineH) / 2
  lines.forEach((line, i) => ctx.fillText(line, x + w / 2, startY + i * lineH))
}

async function drawStorySide(ctx, opts) {
  const {
    x,
    y,
    w,
    h,
    type,
    url,
    text,
    label,
    pct,
    isDraw,
    isWin,
    isVoted,
    dimmed,
  } = opts

  if (type === 'image' && url) {
    try {
      const img = await loadImage(url)
      if (dimmed) ctx.filter = 'brightness(0.55) saturate(0.55)'
      drawCoverImage(ctx, img, x, y, w, h)
      ctx.filter = 'none'
    } catch {
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.fillRect(x, y, w, h)
    }
  } else if (type === 'text') {
    drawTextPanel(ctx, x, y, w, h, text, isDraw ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.1)')
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.fillRect(x, y, w, h)
    ctx.font = `900 28px ${FONT}`
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🎬', x + w / 2, y + h / 2)
  }

  const overlay = ctx.createLinearGradient(x, y + h * 0.45, x, y + h)
  overlay.addColorStop(0, 'rgba(0,0,0,0)')
  overlay.addColorStop(1, 'rgba(0,0,0,0.82)')
  ctx.fillStyle = overlay
  ctx.fillRect(x, y, w, h)

  if (isDraw) {
    drawBadge(ctx, '🤝 무승부', x + 10, y + 10, { fill: 'rgba(139,92,246,0.95)' })
  } else if (isWin) {
    drawBadge(ctx, 'WIN', x + 10, y + 10, { fill: '#84cc16', color: '#0f1f0f' })
  } else {
    drawBadge(ctx, 'LOSE', x + 10, y + 10, { fill: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.65)' })
  }

  if (isVoted) {
    drawBadge(ctx, '내 선택', x + w - 62, y + 10, { fill: 'rgba(255,255,255,0.92)', color: '#22282E' })
  }

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = dimmed ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.9)'
  ctx.font = `700 11px ${FONT}`
  ctx.fillText(String(label || '').slice(0, 12), x + 14, y + h - 52)

  ctx.fillStyle = dimmed ? 'rgba(255,255,255,0.5)' : '#ffffff'
  ctx.font = `900 36px ${FONT}`
  ctx.fillText(`${pct}%`, x + 14, y + h - 18)

  const barY = y + h - 10
  const barW = w - 28
  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  ctx.beginPath()
  ctx.roundRect(x + 14, barY, barW, 6, 3)
  ctx.fill()

  const fillGrad = isDraw
    ? (x >= HALF_W
      ? ['#38bdf8', '#6366f1']
      : ['#d946ef', '#fb7185'])
    : isWin
      ? ['#a3e635', '#10b981']
      : ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.35)']
  const fg = ctx.createLinearGradient(x, barY, x + barW, barY)
  fg.addColorStop(0, fillGrad[0])
  fg.addColorStop(1, fillGrad[1])
  ctx.fillStyle = fg
  ctx.beginPath()
  ctx.roundRect(x + 14, barY, (barW * pct) / 100, 6, 3)
  ctx.fill()
}

async function drawVsBadge(ctx, cx, cy) {
  const r = 22
  const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy)
  for (const [stop, color] of VS_GRADIENT_STOPS) grad.addColorStop(stop, color)

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r + 3, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.restore()

  try {
    const logo = await loadImage('/logo.png')
    const target = 20
    const ratio = Math.min(target / logo.width, target / logo.height)
    ctx.drawImage(logo, cx - (logo.width * ratio) / 2, cy - (logo.height * ratio) / 2, logo.width * ratio, logo.height * ratio)
  } catch {
    ctx.fillStyle = '#fff'
    ctx.font = `900 10px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('VS', cx, cy)
  }
}

function drawCombinedBar(ctx, y, leftPct, rightPct) {
  const leftW = (CARD_W * leftPct) / 100
  const rightW = CARD_W - leftW
  const lg = ctx.createLinearGradient(0, y, leftW, y)
  lg.addColorStop(0, '#d946ef')
  lg.addColorStop(1, '#fb7185')
  ctx.fillStyle = lg
  ctx.fillRect(0, y, leftW, BAR_H)
  const rg = ctx.createLinearGradient(leftW, y, CARD_W, y)
  rg.addColorStop(0, '#38bdf8')
  rg.addColorStop(1, '#4f46e5')
  ctx.fillStyle = rg
  ctx.fillRect(leftW, y, rightW, BAR_H)
}

function drawFooter(ctx, y, aiComment, totalVotes) {
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.beginPath()
  ctx.moveTo(0, y)
  ctx.lineTo(CARD_W, y)
  ctx.stroke()

  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = `700 10px ${FONT}`
  ctx.textAlign = 'left'
  ctx.fillText('🤖 AI COMMENT', 20, y + 22)

  const lines = wrapLines(`"${aiComment}"`, 28, 3)
  ctx.fillStyle = '#ffffff'
  ctx.font = `600 12px ${FONT}`
  lines.forEach((line, i) => ctx.fillText(line, 20, y + 44 + i * 18))

  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = `600 10px ${FONT}`
  ctx.textAlign = 'right'
  ctx.fillText(`${Number(totalVotes || 0).toLocaleString('ko-KR')}명 참여 · vics.app`, CARD_W - 20, y + FOOTER_H - 16)
}

function canvasToJpegFile(canvas, filename, quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('jpeg encode failed'))
          return
        }
        const baseName = filename.replace(/\.jpe?g$/i, '')
        const reader = new FileReader()
        reader.onload = () => {
          resolve({
            file: new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }),
            dataUrl: reader.result,
            fileName: baseName,
          })
        }
        reader.onerror = () => reject(reader.error || new Error('read failed'))
        reader.readAsDataURL(blob)
      },
      'image/jpeg',
      quality,
    )
  })
}

/**
 * @param {{
 *   matchup: object,
 *   votedSide: 'left'|'right',
 *   leftPct: number,
 *   rightPct: number,
 *   aiComment: string,
 *   hashTag: string,
 *   winSide: 'left'|'right'|null,
 *   isDraw: boolean,
 *   filename?: string,
 * }} opts
 */
export async function composeVoteResultStoryImage({
  matchup,
  votedSide,
  leftPct,
  rightPct,
  aiComment,
  hashTag,
  winSide,
  isDraw,
  filename = 'vics-vote-story',
}) {
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unsupported')

  const leftLabel = matchup.left_label || 'A'
  const rightLabel = matchup.right_label || 'B'
  const leftUrl = safeMediaUrl(matchup.left_thumbnail_url || matchup.left_url || '')
  const rightUrl = safeMediaUrl(matchup.right_thumbnail_url || matchup.right_url || '')

  drawBackground(ctx)
  await drawHeader(ctx, hashTag)

  const panelY = HEADER_H
  await drawStorySide(ctx, {
    x: 0,
    y: panelY,
    w: HALF_W,
    h: PANEL_H,
    type: matchup.left_type,
    url: leftUrl,
    text: matchup.left_text,
    label: leftLabel,
    pct: leftPct,
    isDraw,
    isWin: !isDraw && winSide === 'left',
    isVoted: votedSide === 'left',
    dimmed: !isDraw && winSide !== 'left',
  })

  await drawStorySide(ctx, {
    x: HALF_W,
    y: panelY,
    w: HALF_W,
    h: PANEL_H,
    type: matchup.right_type,
    url: rightUrl,
    text: matchup.right_text,
    label: rightLabel,
    pct: rightPct,
    isDraw,
    isWin: !isDraw && winSide === 'right',
    isVoted: votedSide === 'right',
    dimmed: !isDraw && winSide !== 'right',
  })

  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.beginPath()
  ctx.moveTo(HALF_W, panelY)
  ctx.lineTo(HALF_W, panelY + PANEL_H)
  ctx.stroke()
  await drawVsBadge(ctx, HALF_W, panelY + PANEL_H / 2)

  drawCombinedBar(ctx, panelY + PANEL_H, leftPct, rightPct)
  drawFooter(ctx, panelY + PANEL_H + BAR_H, aiComment, displayVoteTotal(matchup.total_votes, matchup.id))

  const result = await canvasToJpegFile(canvas, filename)
  if (!result.file || result.file.size < 800) {
    throw new Error('공유 카드 이미지가 비어 있어요')
  }
  return result
}
