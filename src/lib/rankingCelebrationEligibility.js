import { supabase } from './supabase'

/** 당일 1회만 자동 축하 모달 */
export function rankingCelebrationStorageKey(user) {
  if (!user?.id) return null
  const day = new Date().toISOString().slice(0, 10)
  return `vics_celebration_${user.id}_${day}`
}

export function hasSeenRankingCelebrationThisLogin(user) {
  const key = rankingCelebrationStorageKey(user)
  if (!key) return false
  try {
    return sessionStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

export function markRankingCelebrationSeenThisLogin(user) {
  const key = rankingCelebrationStorageKey(user)
  if (!key) return
  try {
    sessionStorage.setItem(key, '1')
  } catch {
    /* ignore */
  }
}

export function clearRankingCelebrationSeenThisLogin(user) {
  const key = rankingCelebrationStorageKey(user)
  if (!key) return
  try {
    sessionStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

/** 가입 보너스만으로 TOP10이 되는 경우 제외 — 실제 투표·피드백 참여가 있어야 함 */
export function profileHasRankingEngagement(profile) {
  if (!profile) return false
  return (
    (Number(profile.total_votes_received) || 0) > 0 ||
    (Number(profile.vote_total) || 0) > 0
  )
}

/** 플랫폼에 투표가 1건이라도 발생한 매치업이 있을 때만 축하 카드 의미 있음 */
export async function platformHasRankingCelebrationContext() {
  const { count, error } = await supabase
    .from('matchups')
    .select('id', { count: 'exact', head: true })
    .gt('total_votes', 0)

  if (error) {
    if (import.meta.env.DEV) console.warn('[rankingCelebration] platform activity check failed', error.message)
    return false
  }
  return (count ?? 0) > 0
}

export function shouldOfferRankingCelebration({ user, profile, myRank, platformActive = true }) {
  if (!user?.id || !profile || !myRank) return false
  if (myRank.rank > 10) return false
  if (String(myRank.data?.id ?? '') !== String(user.id)) return false
  if (!profileHasRankingEngagement(profile)) return false
  if (!platformActive) return false
  if (hasSeenRankingCelebrationThisLogin(user)) return false
  return true
}
