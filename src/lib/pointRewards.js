/**
 * 포인트 규정 — 실제 지급은 Supabase 트리거(`update_dual_ranking_on_matchup_complete` 등)와 동기
 *
 * - 투표 직후·매치업 생성 직후 즉시 포인트는 없음 (운영 정책).
 * - 매치업이 결과를 반영한 뒤: Creator 승/패/무, Voter 적중/패/무에 따라 지급.
 *
 * @see supabase_points_system_v2.sql, supabase_points_no_immediate_vote_or_create.sql
 */

/** Voter — 매치업 결과 반영 시 (적중 / 패 / 무) */
export const POINTS_VOTER_HIT = 25
export const POINTS_VOTER_MISS = 5
export const POINTS_VOTER_DRAW = 15

/** Creator — 매치업 결과 반영 시 (승 / 패 / 무) */
export const POINTS_CREATOR_WIN = 50
export const POINTS_CREATOR_LOSE = 10
export const POINTS_CREATOR_DRAW = 30
