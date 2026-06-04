/**
 * 유저 공지 목록·상세 노출 제한 (배포 DB 더미 정리 전까지)
 * — `빅스 정식 버전 개봉` 만 공개 피드에 표시합니다.
 * — 관리자 목록(`/admin/notice/list`)은 필터 없이 전체 조회합니다.
 */
export const PUBLIC_NOTICE_LAUNCH_TITLE = '빅스 정식 버전 개봉'

export function isPublicNoticeTitle(title) {
  return String(title ?? '').trim() === PUBLIC_NOTICE_LAUNCH_TITLE
}

/** 유저 `/notice` 목록·상세용 — 서버 필터와 동일 조건으로 한 번 더 거릅니다. */
export function filterPublicNoticeRows(rows) {
  return (rows || []).filter((row) => isPublicNoticeTitle(row?.title))
}

/** @param {import('@supabase/supabase-js').PostgrestFilterBuilder} query */
export function applyPublicNoticeTitleFilter(query, enabled = true) {
  if (!enabled) return query
  return query.eq('title', PUBLIC_NOTICE_LAUNCH_TITLE)
}
