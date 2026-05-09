/** 공지 목록 URL — 필터·페이지 쿼리 (목록 ↔ 상세 동기화) */

export function parseNoticePageParam(raw) {
  const n = parseInt(String(raw ?? ''), 10)
  return Number.isFinite(n) && n >= 1 ? n : 1
}

export function buildNoticeListSearchParams(filter, page) {
  const p = new URLSearchParams()
  if (filter && filter !== 'all') p.set('filter', filter)
  if (page > 1) p.set('page', String(page))
  return p
}

export function buildNoticeListSearchString(filter, page) {
  const qs = buildNoticeListSearchParams(filter, page).toString()
  return qs ? `?${qs}` : ''
}
