/**
 * 매치업 등급(Tier) 시스템
 * Player → Star → Master → Vip → Goat
 *
 * 판정: **누적 체인** — Master는 Star 조건을, Vip는 Star+Master를, Goat는 Star+Master+Vip를
 * 모두 만족한 뒤 해당 티어 전용 조건·최소 보유 P를 충족해야 함 (`getTier` · DB `grant_matchup_tier_milestone_bonuses` 동기).
 *
 * 티어 최초 달성 보너스 P — DB `grant_matchup_tier_milestone_bonuses` 와 금액 동기 유지
 * 최소 보유 P — 동일 RPC·`TIER_MIN_HOLD_POINTS` 와 동기
 */
export const TIER_MILESTONE_BONUS_POINTS = {
  player: 0,
  star: 1000,
  master: 2000,
  vip: 3000,
  goat: 5000,
}

/** 티어별 최소 보유 P — DB `grant_matchup_tier_milestone_bonuses` 와 동기 */
export const TIER_MIN_HOLD_POINTS = {
  player: 0,
  star: 500,
  master: 2500,
  vip: 5500,
  goat: 10500,
}

export const TIERS = [
  {
    id: 'player',
    name: 'Player',
    emoji: '🎮',
    color: 'text-gray-500',
    bg: 'bg-gray-100',
    border: 'border-gray-200',
    benefit: '기본 기능 이용 가능',
  },
  {
    id: 'star',
    name: 'Star',
    emoji: '⭐',
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    benefit: '활동 대표 배지 설정 · 등급 최초 달성 시 보너스 1,000P',
  },
  {
    id: 'master',
    name: 'Master',
    emoji: '🔥',
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    benefit: '전용 투표 이펙트 (클릭 시 불꽃 발사) · 등급 최초 달성 시 보너스 2,000P',
  },
  {
    id: 'vip',
    name: 'Vip',
    emoji: '💎',
    color: 'text-violet-500',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    benefit: '내 매치업 카드 보라 프레임 (Vip 이상, 피드·상세) · 등급 최초 달성 시 보너스 3,000P',
  },
  {
    id: 'goat',
    name: 'Goat',
    emoji: '👑',
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    benefit: '메인 화면 랭킹 박제 · 등급 최초 달성 시 보너스 5,000P',
  },
]

/**
 * Goat: The Champion / The Oracle 트랙별 순위 조건 중 **하나라도** 만족하면 true.
 * (전체 1~10위 / 주간 1~3위 / 월간 1~7위 — `profiles_tier_rank_snapshot_for_ids`, DB `grant_matchup_tier_milestone_bonuses` 와 동일)
 * @param {Object} rankInfo - profiles_tier_rank_snapshot_for_ids 와 동일 스케일
 */
export function meetsGoatRankCriteria(rankInfo = {}) {
  const {
    overallRankChampion,
    overallRankOracle,
    weeklyRankChampion,
    weeklyRankOracle,
    monthlyRankChampion,
    monthlyRankOracle,
  } = rankInfo
  return (
    (overallRankChampion != null && overallRankChampion >= 1 && overallRankChampion <= 10) ||
    (overallRankOracle != null && overallRankOracle >= 1 && overallRankOracle <= 10) ||
    (weeklyRankChampion != null && weeklyRankChampion >= 1 && weeklyRankChampion <= 3) ||
    (weeklyRankOracle != null && weeklyRankOracle >= 1 && weeklyRankOracle <= 3) ||
    (monthlyRankChampion != null && monthlyRankChampion >= 1 && monthlyRankChampion <= 7) ||
    (monthlyRankOracle != null && monthlyRankOracle >= 1 && monthlyRankOracle <= 7)
  )
}

/**
 * Vip: 프로필 전체(포인트) 상위 10% (`meetsVipRankCriteria`) + point_transactions 가 있을 때는
 * The Champion / The Oracle 중 최소 한 트랙에서 누적 획득 P가 0보다 큼 (`meetsVipDualTrackParticipation`).
 * DB `grant_matchup_tier_milestone_bonuses` 와 동일.
 */
export function meetsVipDualTrackParticipation(rankInfo = {}) {
  if (rankInfo.hasPointTransactions !== true) return true
  const c = Number(rankInfo.championLifetimePts ?? 0)
  const o = Number(rankInfo.oracleLifetimePts ?? 0)
  return c > 0 || o > 0
}

export function meetsVipRankCriteria(rankInfo = {}) {
  const { overallRank, totalUsers } = rankInfo
  return totalUsers > 0 && overallRank != null && overallRank <= Math.ceil(totalUsers * 0.1)
}

export function meetsVipCriteria(rankInfo = {}) {
  return meetsVipRankCriteria(rankInfo) && meetsVipDualTrackParticipation(rankInfo)
}

/**
 * Star: 매치업 생성 10회 이상 **및** 투표 20회 이상 (`grant_matchup_tier_milestone_bonuses` 와 동일).
 */
export function meetsStarCriteria(profile = {}) {
  const totalMatchups = profile.total_matchups || 0
  const voteTotal = profile.vote_total || 0
  return totalMatchups >= 10 && voteTotal >= 20
}

/**
 * Master: Star 활동 축을 넘어, 생성 승 20회 이상 + Oracle 적중률 65% 이상
 * (`grant_matchup_tier_milestone_bonuses` 와 동기 — Star 충족은 `getTier`에서 누적으로 묶음)
 */
export function meetsMasterCriteria(profile = {}) {
  const creatorWins = Number(profile.creator_wins ?? profile.wins ?? 0) || 0
  const voteTotal = profile.vote_total || 0
  const voteHits = profile.vote_hits || 0
  const hitRateFromProfile =
    profile.hit_rate != null && profile.hit_rate !== '' && Number.isFinite(Number(profile.hit_rate))
      ? Number(profile.hit_rate)
      : null
  const hitRate = hitRateFromProfile ?? (voteTotal > 0 ? (voteHits / voteTotal) * 100 : 0)
  return creatorWins >= 20 && hitRate >= 65
}

/** `profiles.points` 기준 보유 P (미전달·NaN 시 0) */
export function profileHoldPoints(profile = {}) {
  const n = Number(profile.points)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/** 해당 티어 등급에 필요한 최소 보유 P 충족 여부 */
export function meetsTierMinHoldPoints(profile = {}, tierId) {
  const min = TIER_MIN_HOLD_POINTS[tierId]
  if (min == null || min <= 0) return true
  return profileHoldPoints(profile) >= min
}

/**
 * @param {Object} profile - { points, total_matchups, creator_wins, vote_total, vote_hits, hit_rate? }
 * @param {Object} rankInfo - profiles_tier_rank_snapshot_for_ids 와 동일 스케일
 *   { overallRank, totalUsers, hasPointTransactions, championLifetimePts, oracleLifetimePts,
 *     overallRankChampion, overallRankOracle, weeklyRankChampion, weeklyRankOracle,
 *     monthlyRankChampion, monthlyRankOracle }
 * @returns {Object} tier
 */
export function getTier(profile = {}, rankInfo = {}) {
  const starOk = meetsStarCriteria(profile)
  const masterOk = starOk && meetsMasterCriteria(profile)
  const vipOk = masterOk && meetsVipCriteria(rankInfo)
  const goatOk = vipOk && meetsGoatRankCriteria(rankInfo)

  if (goatOk && meetsTierMinHoldPoints(profile, 'goat')) return TIERS[4]
  if (vipOk && meetsTierMinHoldPoints(profile, 'vip')) return TIERS[3]
  if (masterOk && meetsTierMinHoldPoints(profile, 'master')) return TIERS[2]
  if (starOk && meetsTierMinHoldPoints(profile, 'star')) return TIERS[1]

  return TIERS[0]
}

export function getTierById(id) {
  return TIERS.find((t) => t.id === id) || TIERS[0]
}

/** Player=0 … Goat=4 */
export function getTierIndex(id) {
  const i = TIERS.findIndex((t) => t.id === id)
  return i >= 0 ? i : 0
}

/**
 * 상위 티어는 하위 티어 혜택을 모두 포함 (같거나 더 높은 단계인지)
 * @param {string|{ id?: string }} userTierOrId - getTier() 결과 또는 tier id
 * @param {string} requiredTierId - 필요한 최소 티어 id
 */
export function tierAtLeast(userTierOrId, requiredTierId) {
  const uid = typeof userTierOrId === 'string' ? userTierOrId : userTierOrId?.id
  return getTierIndex(uid) >= getTierIndex(requiredTierId)
}

/**
 * 특정 티어 공지를 볼 수 있는지 확인
 * - targetAll: true → 누구나
 * - targetAll: false → 로그인 후
 *   - targetTierExact: true → 대상 티어와 정확히 일치할 때만
 *   - targetTierExact: false/undefined → 대상 티어 이상 (상위 티어 포함)
 * @param {Object} notice - { targetAll, targetTierId, targetTierExact? }
 * @param {Object|null} userProfile - authStore의 profile (미로그인 시 null)
 * @returns {boolean}
 */
export function canViewNotice(notice, userProfile) {
  if (notice.targetAll !== false) return true
  if (!userProfile) return false
  const userTier = getTier(userProfile)
  if (notice.targetTierExact === true) {
    return userTier.id === notice.targetTierId
  }
  return tierAtLeast(userTier, notice.targetTierId)
}
