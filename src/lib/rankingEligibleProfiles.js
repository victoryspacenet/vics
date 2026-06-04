/**
 * 공개 랭킹: auth 회원 계정(+ 시드 메일 패턴 제외)만 노출하기 위한 후보 프로필 id.
 * 배포 후 Supabase 에 `profiles_public_rank_candidate_ids()` RPC 필요 (supabase_ranking_eligible_profiles.sql).
 *
 * 반환값
 * - `string[]` : .in('id', …) 에 사용할 UUID 목록
 * - `null`     : RPC 미배포/오류 — 필터 없이 조회 (로컬 하위 호환). 운영 배포에서는 SQL 실행 후 사용하세요.
 */
import { supabase } from './supabase'

/** 랭킹 쿼리/캐시 키 버전 배지 — 필터 규칙 변경 시 증가 */
export const RANKING_ELIGIBLE_CACHE_TAG = 'e4'

const TTL_MS = 2 * 60 * 1000
let cacheIds = null
let cachedAt = 0

/** PostgREST: SETOF uuid 는 JSON 배열 문자열 원소로, TABLE(id) 는 { id } 로 올 수 있음 */
function normalizeRpcProfileIds(data) {
  if (!Array.isArray(data)) return []
  const out = []
  for (const row of data) {
    if (row == null) continue
    if (typeof row === 'string' || typeof row === 'number') {
      const s = String(row).trim()
      if (s) out.push(s)
      continue
    }
    if (typeof row === 'object') {
      const raw =
        row.id ??
        row.Id ??
        row.ID ??
        // 일부 버전 단일 칼럼 테이블
        row.profiles_public_rank_candidate_ids
      if (raw != null) {
        const s = String(raw).trim()
        if (s) out.push(s)
      }
    }
  }
  return out
}

/** @returns {Promise<string[]|null>} */
export async function getRankingEligibleProfileIds() {
  const now = Date.now()
  if (cacheIds && now - cachedAt < TTL_MS) return cacheIds

  const { data, error } = await supabase.rpc('profiles_public_rank_candidate_ids')

  if (error) {
    if (import.meta.env.DEV) console.warn('[rankingEligibleProfiles] RPC 미배포 또는 오류 — 필터 생략', error.message || error)
    return null
  }

  cacheIds = [...new Set(normalizeRpcProfileIds(data))]
  cachedAt = now
  return cacheIds
}

export function invalidateRankingEligibleIdsCache() {
  cacheIds = null
  cachedAt = 0
}
