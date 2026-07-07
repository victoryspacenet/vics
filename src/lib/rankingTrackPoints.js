/**
 * The Champion / The Oracle 트랙별 포인트 컬럼·표시값
 * @see supabase_champion_oracle_track_points.sql
 */

export function getTrackPointsCol(isCreator, useSeason = false) {
  if (useSeason) return isCreator ? 'season_champion_points' : 'season_oracle_points'
  return isCreator ? 'champion_points' : 'oracle_points'
}

/** 정렬·표시용 트랙 포인트 (마이그레이션 전 폴백 포함) */
export function getProfileTrackPoints(profile, isCreator, useSeason = false) {
  if (!profile) return 0
  const col = getTrackPointsCol(isCreator, useSeason)
  if (profile[col] != null && profile[col] !== '') {
    return Math.max(0, Number(profile[col]) || 0)
  }
  if (isCreator) {
    const fromTier = profile._tierRankInfo?.championLifetimePts
    if (fromTier != null && Number(fromTier) > 0) return Number(fromTier)
    const total = Number(profile.points) || 0
    const oracle = Number(profile.oracle_points) || 0
    return Math.max(0, total - oracle)
  }
  return Math.max(0, Number(profile.oracle_points) || 0)
}

/** 랭킹 목록 정렬 컬럼 (sortBy === 'points'일 때 트랙별 분리) */
export function getRankingOrderCol({ isCreator, sortBy, useSeason = false }) {
  if (sortBy === 'votes') return 'total_votes_received'
  if (sortBy === 'hitrate') return 'hit_rate'
  return getTrackPointsCol(isCreator, useSeason)
}
