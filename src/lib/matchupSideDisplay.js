/** 매치업 A/B 측 — 피드·관리자 미리보기용 타입·미디어 해석 (프로필 아바타 폴백 없음) */

export function resolveMatchupSideType(type, { text, url, thumbnail } = {}) {
  const normalized = String(type ?? '').trim().toLowerCase()
  if (normalized === 'text' || normalized === 'image' || normalized === 'video') return normalized
  if (String(text ?? '').trim()) return 'text'
  if (thumbnail || url) return 'image'
  return null
}

export function resolveMatchupSideMediaUrl(type, { url, thumbnail } = {}) {
  const resolved = resolveMatchupSideType(type, { url, thumbnail })
  if (resolved !== 'image' && resolved !== 'video') return null
  return thumbnail || url || null
}

export function readMatchupSideText(type, text) {
  if (resolveMatchupSideType(type, { text }) !== 'text') return ''
  return String(text ?? '').trim()
}
