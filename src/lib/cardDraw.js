import { TIERS, getTier } from './tiers'

// ── 카드 원본 해상도 ──────────────────────────────────────────────────
export const CARD_W = 1080
export const CARD_H = 1920

// ── 테마 정의 (tierId = 매치업 등급 Player·Star·Master·Vip·Goat, id는 갤러리 호환 유지) ──
export const THEMES = [
  {
    id: 'slate',
    tierId: 'player',
    label: 'Player',
    emoji: '🎮',
    swatch: ['#111827', '#374151', '#9ca3af'],
    accent: '#9CA3AF', accentRGB: '156,163,175',
    bgFn: (ctx, W, H) => {
      const g = ctx.createLinearGradient(0, 0, W, H)
      g.addColorStop(0, '#0b0f14'); g.addColorStop(1, '#1f2937')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    },
    textQuote: 'rgba(255,255,255,0.45)',
  },
  {
    id: 'ember',
    tierId: 'star',
    label: 'Star',
    emoji: '⭐',
    swatch: ['#451a03', '#b45309', '#fde68a'],
    accent: '#FBBF24', accentRGB: '251,191,36',
    bgFn: (ctx, W, H) => {
      const g = ctx.createRadialGradient(W * 0.35, H * 0.12, 0, W * 0.5, H * 0.45, H * 0.75)
      g.addColorStop(0, '#78350f'); g.addColorStop(0.45, '#451a03'); g.addColorStop(1, '#0c0a09')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    },
    textQuote: 'rgba(255,255,255,0.55)',
  },
  {
    id: 'platinum',
    tierId: 'master',
    label: 'Master',
    emoji: '🔥',
    swatch: ['#1f2040', '#2a2a55', '#9ca3af'],
    accent: '#CBD5E1', accentRGB: '203,213,225',
    bgFn: (ctx, W, H) => {
      const g = ctx.createRadialGradient(W * 0.25, H * 0.2, 0, W * 0.5, H * 0.5, H * 0.8)
      g.addColorStop(0, '#1f2040'); g.addColorStop(0.45, '#141428'); g.addColorStop(1, '#080810')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    },
    textQuote: 'rgba(255,255,255,0.5)',
  },
  {
    id: 'diamond',
    tierId: 'vip',
    label: 'Vip',
    emoji: '💎',
    swatch: ['#020818', '#0d1b3e', '#60a5fa'],
    accent: '#60A5FA', accentRGB: '96,165,250',
    bgFn: (ctx, W, H) => {
      const g = ctx.createLinearGradient(0, 0, W, H)
      g.addColorStop(0, '#020818'); g.addColorStop(0.4, '#0d1b3e')
      g.addColorStop(0.7, '#0a2040'); g.addColorStop(1, '#020810')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      const shimmer = ctx.createLinearGradient(W, 0, 0, H)
      shimmer.addColorStop(0, 'transparent')
      shimmer.addColorStop(0.4, 'rgba(96,165,250,0.06)')
      shimmer.addColorStop(1, 'transparent')
      ctx.fillStyle = shimmer; ctx.fillRect(0, 0, W, H)
    },
    textQuote: 'rgba(255,255,255,0.5)',
  },
  {
    id: 'gradient',
    tierId: 'goat',
    label: 'Goat',
    emoji: '👑',
    swatch: ['#7c3aed', '#db2777', '#f97316'],
    accent: '#FDE68A', accentRGB: '253,230,138',
    bgFn: (ctx, W, H) => {
      const g = ctx.createLinearGradient(0, 0, W * 0.8, H)
      g.addColorStop(0, '#4c1d95'); g.addColorStop(0.25, '#7c3aed')
      g.addColorStop(0.5, '#db2777'); g.addColorStop(0.75, '#ea580c')
      g.addColorStop(1, '#ca8a04')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, 0, W, H)
    },
    textQuote: 'rgba(255,255,255,0.65)',
  },
]

/** 현재 프로필·랭크 정보에 맞는 카드 테마 id (편집기 초기값·동기화용) */
export function resolveRankingCardThemeId(profile, rankInfo = {}) {
  const tier = getTier(profile || {}, rankInfo || {})
  const th = THEMES.find((x) => x.tierId === tier.id)
  return th?.id ?? THEMES[0].id
}

// ── 헬퍼 ──────────────────────────────────────────────────────────────
export function getPercentile(rank) {
  if (rank === 1) return '상위 0.01%'
  if (rank <= 3)  return '상위 0.05%'
  if (rank <= 5)  return '상위 0.1%'
  return '상위 0.5%'
}

export function getMedal(rank) {
  return { 1: '🥇', 2: '🥈', 3: '🥉' }[rank] || '🎖️'
}

/** 순위 구간별 표시 — 랜딩 «매치업 등급 배지»(Player·Star·Master·Vip·Goat)와 동일 명칭 */
export function getTierInfo(rank) {
  const [player, star, master, vip, goat] = TIERS
  if (rank === 1) return { name: goat.name, emoji: goat.emoji, color: '#CA8A04', bg: 'linear-gradient(135deg,#78350f,#fbbf24)' }
  if (rank <= 3) return { name: vip.name, emoji: vip.emoji, color: '#7C3AED', bg: 'linear-gradient(135deg,#1e1b4b,#a78bfa)' }
  if (rank <= 5) return { name: master.name, emoji: master.emoji, color: '#EA580C', bg: 'linear-gradient(135deg,#7c2d12,#fb923c)' }
  if (rank <= 7) return { name: star.name, emoji: star.emoji, color: '#F59E0B', bg: 'linear-gradient(135deg,#451a03,#fcd34d)' }
  return { name: player.name, emoji: player.emoji, color: '#6B7280', bg: 'linear-gradient(135deg,#1f2937,#9ca3af)' }
}

export function getPeriodLines(period) {
  const now = new Date(), m = now.getMonth() + 1, w = Math.ceil(now.getDate() / 7)
  const suf = ['st', 'nd', 'rd'][w - 1] || 'th'
  if (period === 'weekly')  return [`WEEKLY BEST`, `2026.${String(m).padStart(2, '0')}. ${w}${suf} Week`]
  if (period === 'monthly') return [`MONTHLY BEST`, `2026.${String(m).padStart(2, '0')}.`]
  return [`ALL TIME BEST`, `2026`]
}

export function formatSavedDate(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// ── 내부 드로잉 헬퍼 ─────────────────────────────────────────────────
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath()
}

function drawQR(ctx, ox, oy, size) {
  const cell = size / 9
  const pattern = [
    [1,1,1,1,1,1,1,0,0],[1,0,0,0,0,0,1,0,1],[1,0,1,1,1,0,1,0,0],
    [1,0,1,1,1,0,1,0,1],[1,0,1,1,1,0,1,0,0],[1,0,0,0,0,0,1,0,1],
    [1,1,1,1,1,1,1,0,0],[0,0,0,1,0,0,0,0,1],[1,0,1,0,1,1,0,1,0],
  ]
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (pattern[r][c]) ctx.fillRect(ox + c * cell, oy + r * cell, cell - 0.5, cell - 0.5)
}

// ── 핵심 드로잉 함수 (내보내기) ──────────────────────────────────────
export function drawCard(canvas, opts) {
  const { rank, nickname, points, period, themeId, showNickname, showPoints, showRank, avatarImg } = opts
  const W = canvas.width, H = canvas.height, s = W / CARD_W
  const ctx = canvas.getContext('2d')
  const t = THEMES.find(x => x.id === themeId) || THEMES[0]
  const [line1, line2] = getPeriodLines(period)

  ctx.clearRect(0, 0, W, H)
  t.bgFn(ctx, W, H)

  // 글로우 원
  const glow = (cx, cy, r) => {
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    rg.addColorStop(0, `rgba(${t.accentRGB},0.22)`)
    rg.addColorStop(1, 'transparent')
    ctx.fillStyle = rg; ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  }
  glow(W * 0.15, H * 0.1, 280 * s); glow(W * 0.85, H * 0.88, 320 * s); glow(W * 0.5, H * 0.5, 400 * s)

  // 별 반짝임
  ctx.fillStyle = `rgba(${t.accentRGB},0.55)`
  for (let i = 0; i < 30; i++) {
    const px = ((i * 113 + 40) % 980) * s, py = ((i * 193 + 60) % 1860) * s
    const r = (0.8 + (i % 3) * 0.6) * s
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill()
  }

  // 가로선
  const hline = (y) => {
    const lg = ctx.createLinearGradient(80 * s, 0, W - 80 * s, 0)
    lg.addColorStop(0, 'transparent'); lg.addColorStop(0.5, `rgba(${t.accentRGB},0.35)`); lg.addColorStop(1, 'transparent')
    ctx.strokeStyle = lg; ctx.lineWidth = 1.5 * s
    ctx.beginPath(); ctx.moveTo(90 * s, y); ctx.lineTo(W - 90 * s, y); ctx.stroke()
  }
  hline(110 * s)

  // VICS 로고
  ctx.textAlign = 'center'
  ctx.font = `bold ${32 * s}px -apple-system,sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.fillText('✦  VICS  ✦', W / 2, 78 * s)

  // 기간
  ctx.font = `bold ${24 * s}px -apple-system,sans-serif`; ctx.fillStyle = t.accent
  ctx.fillText(line1, W / 2, 158 * s)
  ctx.font = `${20 * s}px -apple-system,sans-serif`; ctx.fillStyle = 'rgba(255,255,255,0.38)'
  ctx.fillText(line2, W / 2, 194 * s); hline(230 * s)

  // 아바타
  const AX = W / 2, AY = 480 * s, AR = 145 * s
  const ringG = ctx.createRadialGradient(AX, AY, AR * 0.85, AX, AY, AR + 28 * s)
  ringG.addColorStop(0, `rgba(${t.accentRGB},0.5)`); ringG.addColorStop(1, 'transparent')
  ctx.fillStyle = ringG; ctx.beginPath(); ctx.arc(AX, AY, AR + 28 * s, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(AX, AY, AR + 5 * s, 0, Math.PI * 2)
  ctx.strokeStyle = t.accent; ctx.lineWidth = 4 * s; ctx.stroke()
  ctx.save(); ctx.beginPath(); ctx.arc(AX, AY, AR, 0, Math.PI * 2); ctx.clip()
  if (avatarImg) {
    ctx.drawImage(avatarImg, AX - AR, AY - AR, AR * 2, AR * 2)
  } else {
    const avG = ctx.createRadialGradient(AX, AY * 0.9, 0, AX, AY, AR)
    avG.addColorStop(0, `rgba(${t.accentRGB},0.25)`); avG.addColorStop(1, `rgba(${t.accentRGB},0.05)`)
    ctx.fillStyle = avG; ctx.fillRect(AX - AR, AY - AR, AR * 2, AR * 2)
    ctx.font = `bold ${AR * 0.72}px -apple-system,sans-serif`; ctx.fillStyle = t.accent
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText((nickname?.[0] || '?').toUpperCase(), AX, AY); ctx.textBaseline = 'alphabetic'
  }
  ctx.restore()
  ctx.font = `${72 * s}px sans-serif`; ctx.textAlign = 'center'
  ctx.fillText(getMedal(rank), AX + AR * 0.72, AY + AR * 0.72 + 24 * s)

  // 순위 배지
  if (showRank) {
    ctx.font = `bold ${86 * s}px -apple-system,sans-serif`
    const rankStr = `# ${rank}`, rw = ctx.measureText(rankStr).width
    rrect(ctx, AX - rw / 2 - 32 * s, 730 * s, rw + 64 * s, 104 * s, 22 * s)
    ctx.fillStyle = `rgba(${t.accentRGB},0.12)`; ctx.fill()
    rrect(ctx, AX - rw / 2 - 32 * s, 730 * s, rw + 64 * s, 104 * s, 22 * s)
    ctx.strokeStyle = `rgba(${t.accentRGB},0.3)`; ctx.lineWidth = 1.5 * s; ctx.stroke()
    ctx.fillStyle = t.accent; ctx.textAlign = 'center'; ctx.fillText(rankStr, AX, 828 * s)
  }

  // 닉네임 / 정보
  const infoY = showRank ? 940 * s : 800 * s
  if (showNickname) {
    ctx.font = `bold ${58 * s}px -apple-system,sans-serif`; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'
    ctx.fillText(nickname || '익명', AX, infoY)
  }
  ctx.font = `bold ${28 * s}px -apple-system,sans-serif`; ctx.fillStyle = t.accent; ctx.textAlign = 'center'
  ctx.fillText(getPercentile(rank) + ' 안목가', AX, infoY + 54 * s)
  if (showPoints) {
    ctx.font = `${26 * s}px -apple-system,sans-serif`; ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.fillText(`${points?.toLocaleString() || '0'} P`, AX, infoY + 102 * s)
  }

  // 인용구
  const qY = infoY + 170 * s
  hline(qY - 30 * s)
  ctx.font = `italic ${30 * s}px Georgia,serif`; ctx.fillStyle = t.textQuote; ctx.textAlign = 'center'
  ctx.fillText('"내가 선택하면 답이다"', AX, qY + 10 * s); hline(qY + 50 * s)

  // QR + 브랜딩
  const qrSize = 88 * s, qrX = W - 145 * s, qrY = H - 200 * s
  drawQR(ctx, qrX, qrY, qrSize)
  ctx.font = `${13 * s}px -apple-system,sans-serif`; ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.textAlign = 'left'; ctx.fillText('vics.app', qrX, qrY + qrSize + 18 * s)
  ctx.font = `${16 * s}px -apple-system,sans-serif`; ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.textAlign = 'center'
  ctx.fillText('© 2026 VICTORYSPACE · All rights reserved', W / 2, H - 46 * s)
}

// ── 썸네일 생성 (갤러리용 저화질 JPEG) ──────────────────────────────
export async function generateThumbnail(opts) {
  const canvas = document.createElement('canvas')
  canvas.width = 180; canvas.height = 320
  drawCard(canvas, opts)
  return canvas.toDataURL('image/jpeg', 0.6)
}
