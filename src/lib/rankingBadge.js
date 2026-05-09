/**
 * 랭킹 TOP10 기념 배지 헬퍼
 * DB 컬럼: profiles.ranking_badge_rank, profiles.ranking_badge_expires_at
 */

/**
 * 배지 유효 기간 (순위별 일 수)
 * 1위 30일 / 2위 14일 / 3~10위 7일
 */
export function getRankingBadgeDays(rank) {
  if (rank === 1) return 30
  if (rank === 2) return 14
  return 7
}

/**
 * 프로필 객체를 받아 현재 배지가 활성 상태인지 반환
 */
export function isRankingBadgeActive(profile) {
  if (!profile) return false
  const { ranking_badge_rank, ranking_badge_expires_at } = profile
  if (!ranking_badge_rank || !ranking_badge_expires_at) return false
  return new Date(ranking_badge_expires_at) > new Date()
}

/**
 * 배지 라벨 텍스트 (e.g. "TOP 10 기념 배지 (30일)")
 */
export function getRankingBadgeLabel(profile) {
  if (!isRankingBadgeActive(profile)) return null
  const days = getRankingBadgeDays(profile.ranking_badge_rank)
  return `TOP 10 기념 배지 (${days}일)`
}

/**
 * 배지 만료까지 남은 일 수 (소수 버림)
 */
export function getRankingBadgeRemainingDays(profile) {
  if (!isRankingBadgeActive(profile)) return 0
  const ms = new Date(profile.ranking_badge_expires_at) - new Date()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

/**
 * RPC 응답(badge_rank, badge_expires_at)으로 profile 캐시를 낙관적 업데이트할 때 쓰는 유틸
 */
export function applyBadgeToProfile(profile, badgeRank, badgeExpiresAt) {
  if (!profile) return profile
  return {
    ...profile,
    ranking_badge_rank: badgeRank,
    ranking_badge_expires_at: badgeExpiresAt,
  }
}
