/** CreateMatchupDrawer · draftStorage와 동일 */
export const MAX_MATCHUP_TAGS = 3

export function clampMatchupTags(arr) {
  if (!Array.isArray(arr)) return []
  return arr.slice(0, MAX_MATCHUP_TAGS)
}

export function sanitizeMatchupTagToken(s) {
  return String(s)
    .normalize('NFC')
    .replace(/[^가-힣a-zA-Z0-9]/g, '')
    .slice(0, 15)
}

/** Enter·붙여넣기 등으로 태그 문자열을 토큰 배열로 변환 */
export function parseMatchupTagTokens(rawInput) {
  const raw = String(rawInput ?? '').trim()
  if (!raw) return []

  const pieces = raw.split(/[,，;]+/).map((s) => s.trim()).filter(Boolean)
  const fromPieces = pieces.map((p) => sanitizeMatchupTagToken(p)).filter(Boolean)
  return fromPieces.length > 0
    ? fromPieces
    : [sanitizeMatchupTagToken(raw)].filter(Boolean)
}

/** 제출 시 chips + 입력 중인 태그를 합침 (Enter 없이 제출해도 저장) */
export function mergeMatchupTagsForSubmit(existingTags, rawInput) {
  const base = clampMatchupTags(Array.isArray(existingTags) ? existingTags : [])
  const pending = parseMatchupTagTokens(rawInput)
  if (pending.length === 0) return base

  const next = [...base]
  for (const cleaned of pending) {
    if (next.length >= MAX_MATCHUP_TAGS) break
    if (!next.includes(cleaned)) next.push(cleaned)
  }
  return clampMatchupTags(next)
}

/** DB·API 응답을 상세·피드 표시용 배열로 정규화 */
export function normalizeMatchupTagsForDisplay(raw) {
  if (Array.isArray(raw)) {
    return raw.map((t) => String(t).trim()).filter(Boolean).slice(0, MAX_MATCHUP_TAGS)
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) return normalizeMatchupTagsForDisplay(parsed)
      } catch {
        /* ignore */
      }
    }
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const inner = trimmed.slice(1, -1).trim()
      if (!inner) return []
      return inner
        .split(',')
        .map((s) => s.replace(/^"|"$/g, '').trim())
        .filter(Boolean)
        .slice(0, MAX_MATCHUP_TAGS)
    }
    return [trimmed]
  }
  return []
}

/** 태그 클릭 시 해당 태그가 붙은 매치업 목록으로 이동 */
export function buildMatchupTagFeedUrl(tag) {
  const token = sanitizeMatchupTagToken(tag)
  if (!token) return '/matchups?filter=active'
  return `/matchups?filter=active&tag=${encodeURIComponent(token)}`
}
