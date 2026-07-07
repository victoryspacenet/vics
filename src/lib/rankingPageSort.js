/**
 * RankingPage 4정렬 — 단일 진실 공급원
 *
 * The Champion: champion_points / total_votes_received
 * The Oracle:    oracle_points / hit_rate — 후보는 votes 테이블(투표 이력) 기준
 */

export const RANKING_PROFILE_SELECT =
  'id, nickname, avatar_url, points, champion_points, oracle_points, total_matchups, total_votes_received, creator_wins, creator_win_streak, vote_hits, vote_total, hit_rate, featured_badge, founding_member_number'

/** @typedef {'champion_points'|'oracle_points'|'votes'|'hit_rate'} RankingSortKind */

/**
 * @returns {{
 *   isCreator: boolean,
 *   sortBy: 'points'|'votes'|'hitrate',
 *   orderCol: string,
 *   kind: RankingSortKind,
 *   requireMinVoteTotal?: number,
 * }}
 */
export function getRankingPageSortConfig(typeTab, sortBy) {
  const isCreator = typeTab === 'creator'
  if (isCreator) {
    if (sortBy === 'votes') {
      return { isCreator: true, sortBy: 'votes', orderCol: 'total_votes_received', kind: 'votes' }
    }
    return { isCreator: true, sortBy: 'points', orderCol: 'champion_points', kind: 'champion_points' }
  }
  if (sortBy === 'hitrate') {
    return { isCreator: false, sortBy: 'hitrate', orderCol: 'hit_rate', kind: 'hit_rate' }
  }
  return { isCreator: false, sortBy: 'points', orderCol: 'oracle_points', kind: 'oracle_points' }
}

export function calcRankingHitRate(hits, total) {
  if (!total || total === 0) return null
  return Math.round(((hits || 0) / total) * 100)
}

/** DB 정렬·동순위·표시·내 순위 계산에 동일하게 사용 */
export function getRankingSortValue(row, config) {
  if (!row || !config) return 0
  if (config.kind === 'hit_rate') {
    const stored = row.hit_rate
    if (stored != null && stored !== '' && !Number.isNaN(Number(stored))) {
      return Number(stored)
    }
    const vt = Number(row.vote_total) || 0
    if (vt < 1) return 0
    return ((Number(row.vote_hits) || 0) / vt) * 100
  }
  return Math.max(0, Number(row[config.orderCol]) || 0)
}

export function rankingSortValuesEqual(a, b, config) {
  if (config?.kind === 'hit_rate') return Math.abs(Number(a) - Number(b)) < 1e-6
  return Number(a) === Number(b)
}

/** Supabase profiles 쿼리 필터 (Oracle 후보 id는 loadRankings에서 .in 처리) */
export function applyRankingQueryFilters(query, _config) {
  return query
}

/** 정렬 컬럼 오류 시(마이그레이션 전) 폴백 orderCol */
export function getRankingOrderColFallback(config) {
  if (config.kind === 'champion_points') return 'total_votes_received'
  if (config.kind === 'oracle_points') return 'vote_hits'
  return config.orderCol
}

export function isMissingTrackPointsColumnError(error) {
  const msg = String(error?.message || error || '')
  return /champion_points|oracle_points|does not exist|column.*not found/i.test(msg)
}

/** 포디움·행·내 랭킹 바 — 현재 정렬 기준 표시 */
export function formatRankingPrimaryMetric(row, config, formatNumber) {
  const val = getRankingSortValue(row, config)
  if (config.kind === 'hit_rate') {
    if (val <= 0 && (Number(row?.vote_total) || 0) < 1) return '-'
    return `${Math.round(val)}%`
  }
  if (config.kind === 'votes') return `${formatNumber(val)}표`
  return `${formatNumber(val)}P`
}

/** 두 유저 간 정렬 기준 격차 (양수 = 위 유저가 더 높음) */
export function rankingSortGap(higherRow, lowerRow, config) {
  return getRankingSortValue(higherRow, config) - getRankingSortValue(lowerRow, config)
}

/** 내 랭킹 바 — 바로 위 유저와의 격차 표시 */
export function formatRankingSortGap(higherRow, lowerRow, config, formatNumber) {
  const gap = rankingSortGap(higherRow, lowerRow, config)
  if (gap <= 0) return null
  if (config.kind === 'hit_rate') return `${Math.round(gap)}%p`
  if (config.kind === 'votes') return `${formatNumber(gap)}표`
  return `${formatNumber(gap)}P`
}
