/**
 * 유저 공지 목록·상세 노출 필터
 * — 모든 공지를 공개 피드에 표시합니다. (관리자 등록 공지 전체 연동)
 */

/** @deprecated 더 이상 사용하지 않음. 하위 호환 유지용 */
export const PUBLIC_NOTICE_LAUNCH_TITLE = ''

/** @deprecated 모든 공지를 공개로 처리. 하위 호환 유지용 */
export function isPublicNoticeTitle(_title) {
  return true
}

/** 유저 `/notice` 목록·상세용 — 현재는 모든 행 통과 */
export function filterPublicNoticeRows(rows) {
  return rows || []
}

/** @param {import('@supabase/supabase-js').PostgrestFilterBuilder} query */
export function applyPublicNoticeTitleFilter(query, _enabled = true) {
  // 타이틀 필터 제거 — 관리자가 등록한 모든 공지 표시
  return query
}
