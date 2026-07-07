/**
 * The Oracle 랭킹 후보 — votes 테이블 기준 (투표 직후에도 노출)
 * vote_total / oracle_points 는 매치업 결과 정산 후에만 갱신됨.
 */
import { supabase } from './supabase'

const TTL_MS = 2 * 60 * 1000
let cache = { all: null, hitrate: null, at: 0 }

function normalizeRpcIds(data) {
  if (!Array.isArray(data)) return []
  const out = []
  for (const row of data) {
    if (row == null) continue
    const raw = typeof row === 'object' ? (row.id ?? row.user_id) : row
    const s = String(raw || '').trim()
    if (s) out.push(s)
  }
  return [...new Set(out)]
}

function intersectIds(primary, eligibleIds) {
  if (!primary?.length) return []
  if (!eligibleIds?.length) return primary
  const allow = new Set(eligibleIds.map(String))
  return primary.filter((id) => allow.has(String(id)))
}

async function fetchDistinctVoterIdsFromVotes() {
  const { data, error } = await supabase.from('votes').select('user_id')
  if (error) {
    if (import.meta.env.DEV) console.warn('[rankingOracleCandidates] votes select', error.message)
    return []
  }
  return [...new Set((data || []).map((r) => String(r.user_id)).filter(Boolean))]
}

/** 완료된 매치업(right_type 설정)에 투표한 유저 — 적중률순 후보 */
async function fetchHitrateCandidateIdsFromVotes() {
  const { data: voteRows, error: voteErr } = await supabase
    .from('votes')
    .select('user_id, matchup_id')
  if (voteErr || !voteRows?.length) return []

  const matchupIds = [...new Set(voteRows.map((r) => r.matchup_id).filter(Boolean))]
  if (!matchupIds.length) return []

  const { data: completed, error: muErr } = await supabase
    .from('matchups')
    .select('id')
    .in('id', matchupIds)
    .not('right_type', 'is', null)
  if (muErr) {
    if (import.meta.env.DEV) console.warn('[rankingOracleCandidates] matchups select', muErr.message)
    return []
  }

  const completedSet = new Set((completed || []).map((m) => String(m.id)))
  return [
    ...new Set(
      voteRows
        .filter((r) => completedSet.has(String(r.matchup_id)))
        .map((r) => String(r.user_id))
        .filter(Boolean)
    ),
  ]
}

/**
 * @param {{ hitrateOnly?: boolean, eligibleIds?: string[]|null }} opts
 * @returns {Promise<string[]>}
 */
export async function getOracleRankingCandidateIds({ hitrateOnly = false, eligibleIds = null } = {}) {
  const now = Date.now()
  if (cache.at && now - cache.at < TTL_MS) {
    const base = hitrateOnly ? cache.hitrate : cache.all
    return intersectIds(base || [], eligibleIds)
  }

  const rpcName = hitrateOnly
    ? 'profiles_oracle_hitrate_candidate_ids'
    : 'profiles_oracle_ranking_candidate_ids'

  let ids = null
  const { data, error } = await supabase.rpc(rpcName)
  if (!error && Array.isArray(data)) {
    ids = normalizeRpcIds(data)
  } else if (import.meta.env.DEV && error) {
    console.warn(`[rankingOracleCandidates] RPC ${rpcName} — votes fallback`, error.message)
  }

  if (ids == null) {
    ids = hitrateOnly ? await fetchHitrateCandidateIdsFromVotes() : await fetchDistinctVoterIdsFromVotes()
  }

  cache.all = hitrateOnly ? cache.all : ids
  if (!hitrateOnly) cache.hitrate = cache.hitrate ?? null
  if (hitrateOnly) cache.hitrate = ids
  else if (!cache.hitrate) {
    cache.hitrate = await fetchHitrateCandidateIdsFromVotes()
  }
  cache.at = now

  const result = hitrateOnly ? (cache.hitrate || ids) : ids
  return intersectIds(result, eligibleIds)
}

export function invalidateOracleRankingCandidatesCache() {
  cache = { all: null, hitrate: null, at: 0 }
}
