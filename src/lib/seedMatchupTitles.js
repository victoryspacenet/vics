/**
 * 메인 페이지 시드 매치업 (`supabase_seed_matchups.sql`) — 결제·스포트라이트 후보 등에서 제외
 */
export const SEED_MATCHUP_TITLES = new Set([
  '여름 vs 겨울',
  '커피 vs 차',
  '고양이 vs 강아지',
  '민트초코 vs 반민초',
  '부먹 vs 찍먹',
  '와이드팬츠 vs 스키니진',
  '산 vs 바다',
  '짜장면 vs 짬뽕',
  '피자 vs 치킨',
])

export function isSeedMatchupTitle(title) {
  return SEED_MATCHUP_TITLES.has(String(title ?? '').trim())
}

/** DB 행이 메인 시드 매치업인지 (레거시: is_demo 미설정 행 포함) */
export function isMainSeedMatchup(row) {
  if (!row) return false
  return isSeedMatchupTitle(row.title)
}
