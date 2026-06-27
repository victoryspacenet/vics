import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  if (hours < 24) return `${hours}시간 전`
  if (days < 7) return `${days}일 전`

  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatNumber(num) {
  if (num >= 10000) return `${(num / 10000).toFixed(1)}만`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`
  return num?.toString() || '0'
}

export function calcPercent(a, b) {
  const total = (a || 0) + (b || 0)
  if (total === 0) return { left: 50, right: 50 }
  return {
    left: Math.round(((a || 0) / total) * 100),
    right: Math.round(((b || 0) / total) * 100),
  }
}

// ── 포인트/레벨 시스템 ───────────────────────────────────────────────
export const LEVELS = [
  { level: 1, name: '', min: 0,    emoji: '🌱', color: 'text-gray-500',   bg: 'bg-gray-100'   },
  { level: 2, name: '', min: 100,  emoji: '⚡', color: 'text-blue-500',   bg: 'bg-blue-50'    },
  { level: 3, name: '', min: 300,  emoji: '🔥', color: 'text-green-600',  bg: 'bg-green-50'   },
  { level: 4, name: '', min: 700,  emoji: '⚔️', color: 'text-orange-500', bg: 'bg-orange-50'  },
  { level: 5, name: '', min: 1500, emoji: '🏆', color: 'text-purple-500', bg: 'bg-purple-50'  },
  { level: 6, name: '', min: 3000, emoji: '💎', color: 'text-red-500',    bg: 'bg-red-50'     },
  { level: 7, name: '', min: 6000, emoji: '👑', color: 'text-yellow-600', bg: 'bg-yellow-50'  },
]

export function getLevel(points = 0) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].min) return LEVELS[i]
  }
  return LEVELS[0]
}

export function getLevelProgress(points = 0) {
  const current = getLevel(points)
  const nextIdx = current.level // 0-based index + 1
  if (nextIdx >= LEVELS.length) return { current, next: null, progress: 100 }
  const next = LEVELS[nextIdx]
  const progress = Math.round(((points - current.min) / (next.min - current.min)) * 100)
  return { current, next, progress: Math.min(progress, 100) }
}

export function copyToClipboard(text) {
  const value = String(text ?? '')
  if (!value) return Promise.reject(new Error('empty clipboard text'))

  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(value).catch(() => copyToClipboardFallback(value))
  }
  return copyToClipboardFallback(value)
}

function copyToClipboardFallback(text) {
  const el = document.createElement('textarea')
  el.value = text
  el.setAttribute('readonly', '')
  el.style.position = 'fixed'
  el.style.left = '-9999px'
  document.body.appendChild(el)
  el.select()
  el.setSelectionRange(0, text.length)
  const ok = document.execCommand('copy')
  document.body.removeChild(el)
  return ok ? Promise.resolve() : Promise.reject(new Error('clipboard fallback failed'))
}
