import { supabase } from './supabase'

/** 매치업 embed 시 작성자 티어 판정에 필요한 profiles 컬럼 */
export const MATCHUP_CREATOR_PROFILE_FIELDS =
  'id, nickname, avatar_url, points, featured_badge, fandom_tier, total_matchups, creator_wins, vote_total, vote_hits, hit_rate'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

  const { data, error } = await supabase.rpc('profiles_tier_rank_snapshot_for_ids', {
    p_ids: ids,
  })
  if (error) {
    console.warn('[fetchCreatorRankMapForIds]', error.message)
    return {}
  }
  const out = {}
  for (const row of data || []) {
    const pid = row.profile_id
    if (!pid) continue
    out[pid] = mapTierSnapshotRow(row)
  }
  return out
}

/** 각 매치업에 `_creatorRankInfo` 부착 (작성자 user_id 기준) */
export async function enrichMatchupsWithCreatorRankInfo(matchups) {
  if (!matchups?.length) return matchups
  const ids = matchups.map((m) => m.user_id || m.profiles?.id).filter(Boolean)
  const map = await fetchCreatorRankMapForIds(ids)
  return matchups.map((m) => {
    const pid = m.user_id || m.profiles?.id
    const rankInfo = pid && map[pid] ? map[pid] : { ...EMPTY_TIER_RANK_INFO }
    return { ...m, _creatorRankInfo: rankInfo }
  })
}
