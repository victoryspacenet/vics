/**
 * 메인 스포트라이트 폴백용 고정 데모 매치업 (`supabase_spotlight_demo_matchups.sql`과 id 동일)
 * @see supabase_spotlight_demo_matchups.sql
 */
export const SPOTLIGHT_DEMO_MATCHUP_FASHION_ID = '00000001-0001-4000-8000-000000000101'
export const SPOTLIGHT_DEMO_MATCHUP_SOUND_ID = '00000002-0002-4000-8000-000000000102'

export const SPOTLIGHT_DEMO_MATCHUP_IDS = [SPOTLIGHT_DEMO_MATCHUP_FASHION_ID, SPOTLIGHT_DEMO_MATCHUP_SOUND_ID]

/** DB `is_demo` 또는 고정 id로 스포트라이트 데모 행 판별 */
export function isSpotlightDemoMatchup(row) {
  if (!row || row.id == null) return false
  if (row.is_demo === true) return true
  const id = String(row.id)
  return SPOTLIGHT_DEMO_MATCHUP_IDS.includes(id)
}
