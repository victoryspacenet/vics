import { supabase } from './supabase'

/** 매치업 embed 시 작성자 티어 판정에 필요한 profiles 컬럼 */
export const MATCHUP_CREATOR_PROFILE_FIELDS =
  'id, nickname, avatar_url, points, featured_badge, fandom_tier, founding_member_number, total_matchups, creator_wins, vote_total, vote_hits, hit_rate'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const TIER_SNAPSHOT_TTL_MS = 5 * 60 * 1000
/** @type {Map<string, { info: object; fetchedAt: number }>} */
const tierSnapshotCache = new Map()

export function invalidateCreatorRankSnapshotCache() {
  tierSnapshotCache.clear()
}

/** getTier(rankInfo) 기본값 — RPC 미배포 시 */
export const EMPTY_TIER_RANK_INFO = {
  overallRank: null,
  totalUsers: 0,
  overallRankChampion: null,
  overallRankOracle: null,
  weeklyRankChampion: null,
  weeklyRankOracle: null,
  monthlyRankChampion: null,
  monthlyRankOracle: null,
  /** point_transactions 테이블이 없거나 RPC에 필드 없으면 false → Vip 트랙 조건 완화 */
  hasPointTransactions: false,
  championLifetimePts: 0,
  oracleLifetimePts: 0,
}

/**
 * RPC `profiles_tier_rank_snapshot_for_ids` 한 행 → getTier용 rankInfo
 */
export function mapTierSnapshotRow(row) {
  if (!row) return { ...EMPTY_TIER_RANK_INFO }
  return {
    overallRank: row.overall_rank != null ? Number(row.overall_rank) : null,
    totalUsers: row.total_users != null ? Number(row.total_users) : 0,
    overallRankChampion:
      row.champion_overall_rank != null ? Number(row.champion_overall_rank) : null,
    overallRankOracle: row.oracle_overall_rank != null ? Number(row.oracle_overall_rank) : null,
    weeklyRankChampion: row.week_rank_champion != null ? Number(row.week_rank_champion) : null,
    weeklyRankOracle: row.week_rank_oracle != null ? Number(row.week_rank_oracle) : null,
    monthlyRankChampion: row.month_rank_champion != null ? Number(row.month_rank_champion) : null,
    monthlyRankOracle: row.month_rank_oracle != null ? Number(row.month_rank_oracle) : null,
    hasPointTransactions: row.has_point_transactions === true,
    championLifetimePts:
      row.champion_lifetime_pts != null ? Number(row.champion_lifetime_pts) : 0,
    oracleLifetimePts: row.oracle_lifetime_pts != null ? Number(row.oracle_lifetime_pts) : 0,
  }
}

/**
 * 포인트 전체 순위 + The Champion / The Oracle 트랙별 전체·이번 주·이번 달 획득 P 순위
 * RPC `profiles_tier_rank_snapshot_for_ids` 미배포 시 빈 객체를 반환합니다.
 */
export async function fetchCreatorRankMapForIds(userIds) {
  const ids = [...new Set((userIds || []).filter((id) => id && UUID_RE.test(String(id))))]
  if (ids.length === 0) return {}

  const now = Date.now()
  const out = {}
  const missing = []

  for (const id of ids) {
    const key = String(id)
    const cached = tierSnapshotCache.get(key)
    if (cached && now - cached.fetchedAt < TIER_SNAPSHOT_TTL_MS) {
      out[key] = cached.info
    } else {
      missing.push(key)
    }
  }

  if (missing.length === 0) return out

  const { data, error } = await supabase.rpc('profiles_tier_rank_snapshot_for_ids', {
    p_ids: missing,
  })
  if (error) {
    console.warn('[fetchCreatorRankMapForIds]', error.message)
    return out
  }
  for (const row of data || []) {
    const pid = row.profile_id
    if (!pid) continue
    const info = mapTierSnapshotRow(row)
    tierSnapshotCache.set(String(pid), { info, fetchedAt: now })
    out[String(pid)] = info
  }
  return out
}

/** `getTier`용 활동 필드 보강 (스냅샷 행처럼 일부 필드만 올 때) */
const TIER_PROFILE_STATS_SELECT =
  'id, total_matchups, creator_wins, vote_total, vote_hits, hit_rate, points'

/**
 * 프로필 행 목록에 `profiles_tier_rank_snapshot_for_ids` 기반 `_tierRankInfo`를 붙입니다.
 * Star/Master 판정에 필요한 필드가 빠져 있으면 `profiles`에서 한 번 더 조회합니다.
 * @param {Array<Object>} rows
 */
export async function enrichProfileRowsWithTierSnapshot(rows) {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : []
  if (list.length === 0) return list

  const ids = [
    ...new Set(
      list
        .map((r) => r?.id)
        .filter(Boolean)
        .map((id) => String(id))
        .filter((id) => UUID_RE.test(id))
    ),
  ]

  const emptyTier = () => ({ ...EMPTY_TIER_RANK_INFO })
  if (ids.length === 0) {
    return list.map((r) => ({ ...r, _tierRankInfo: emptyTier() }))
  }

  const rawTier = await fetchCreatorRankMapForIds(ids)
  const tierByLower = {}
  for (const [k, v] of Object.entries(rawTier)) {
    tierByLower[String(k).toLowerCase()] = v
  }

  const needsStats = list.some(
    (r) => r.creator_wins == null || r.vote_total == null || r.vote_hits == null
  )
  const extraByLower = {}
  if (needsStats) {
    const { data } = await supabase.from('profiles').select(TIER_PROFILE_STATS_SELECT).in('id', ids)
    for (const p of data || []) {
      extraByLower[String(p.id).toLowerCase()] = p
    }
  }

  return list.map((r) => {
    const idKey = String(r.id).toLowerCase()
    const ex = extraByLower[idKey]
    const merged = ex ? { ...r, ...ex } : r
    const tierInfo = tierByLower[idKey] ? { ...tierByLower[idKey] } : emptyTier()
    return { ...merged, _tierRankInfo: tierInfo }
  })
}

/** 각 매치업에 `_creatorRankInfo`·`_rightCreatorRankInfo` 부착 */
export async function enrichMatchupsWithCreatorRankInfo(matchups) {
  if (!matchups?.length) return matchups
  const ids = [
    ...new Set(
      matchups.flatMap((m) => [
        m.user_id || m.profiles?.id,
        m.right_user_id || m.right_profiles?.id,
      ].filter(Boolean)),
    ),
  ]
  const map = await fetchCreatorRankMapForIds(ids)
  return matchups.map((m) => {
    const pid = m.user_id || m.profiles?.id
    const rid = m.right_user_id || m.right_profiles?.id
    const rankInfo = pid && map[pid] ? map[pid] : { ...EMPTY_TIER_RANK_INFO }
    const rightRankInfo = rid && map[rid] ? map[rid] : { ...EMPTY_TIER_RANK_INFO }
    return { ...m, _creatorRankInfo: rankInfo, _rightCreatorRankInfo: rightRankInfo }
  })
}
