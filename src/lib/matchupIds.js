/** 메인 피드 빈 목록용 데모 카드 — DB UUID가 아님 */
export const FEED_DEMO_MATCHUP_IDS = new Set(['feed-demo-best', 'feed-demo-hot'])

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isFeedDemoMatchupId(id) {
  return FEED_DEMO_MATCHUP_IDS.has(String(id || ''))
}

export function isValidMatchupUuid(id) {
  return UUID_RE.test(String(id || ''))
}

/** Supabase `matchups.id`로 조회 가능한 ID인지 */
export function canLoadMatchupFromDb(id) {
  return isValidMatchupUuid(id) && !isFeedDemoMatchupId(id)
}
