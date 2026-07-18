/**
 * 포인트 규정 — 실제 지급은 Supabase 트리거(`update_dual_ranking_on_matchup_complete` 등)와 동기
 *
 * - 투표 직후·매치업 생성 직후 즉시 포인트는 없음 (운영 정책).
 * - 매치업이 **투표 마감(expires_at) 후** 결과 정산 시: Creator 승/패/무, Voter 적중/패/무에 따라 지급.
 *   (도전 완료 직후가 아니라 마감 후 — supabase_matchup_result_settlement.sql)
 * - Creator(Champion): LEFT(user_id)와 RIGHT(right_user_id 도전자) 모두 본인 측 승/패 기준.
 * - Voter(Oracle): 모든 투표 정산 — 본인 생성·참여 매치업 투표 포함.
 *
 * @see supabase_matchup_result_settlement.sql, supabase_challenger_creator_points_fix.sql
 */

/** Voter — 매치업 결과 반영 시 (적중 / 패 / 무) */
export const POINTS_VOTER_HIT = 25
export const POINTS_VOTER_MISS = 5
export const POINTS_VOTER_DRAW = 15

/** Creator — 매치업 결과 반영 시 (승 / 패 / 무) */
export const POINTS_CREATOR_WIN = 50
export const POINTS_CREATOR_LOSE = 10
export const POINTS_CREATOR_DRAW = 30
