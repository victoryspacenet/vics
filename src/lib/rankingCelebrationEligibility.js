import { supabase } from './supabase'

export const RANKING_CELEBRATION_POPUP_UPDATED = 'vics:ranking-celebration-popup:updated'

/** RPC/테이블 미배포 시 같은 탭·로그인 세션 폴백 */
const seenMemoryKeys = new Set()

function memoryKey(userId, loginAt) {
  return `${userId}:${loginAt ?? 'unknown'}`
}

async function getAuthLoginEpoch() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.user?.last_sign_in_at ?? null
  } catch {
    return null
  }
}

function isMissingRpcError(error) {
  const code = String(error?.code ?? '')
  const msg = String(error?.message ?? '').toLowerCase()
  return (
    code === '42883'
    || code === 'PGRST202'
    || code === '42P01'
    || msg.includes('does not exist')
    || msg.includes('could not find the function')
  )
}

/** 자동 축하 팝업을 이미 본 로그인 세션인지 */
export async function hasAutoShownRankingCelebrationPopup(user) {
  if (!user?.id) return true

  const loginAt = await getAuthLoginEpoch()
  const key = memoryKey(user.id, loginAt)
  if (seenMemoryKeys.has(key)) return true

  const { data, error } = await supabase.rpc('should_show_ranking_celebration_popup', {
    p_login_at: loginAt,
  })

  if (error) {
    if (import.meta.env.DEV && !isMissingRpcError(error)) {
      console.warn('[rankingCelebration] popup check failed', error.message)
    }
    return seenMemoryKeys.has(key)
  }

  if (data?.ok === false) return true
  if (data?.should_show === false) {
    seenMemoryKeys.add(key)
    return true
  }
  return false
}

/** 자동 축하 팝업 표시 직전 호출 — 로그인 세션당 1회 기록 */
export async function markRankingCelebrationPopupSeen(user) {
  if (!user?.id) return { ok: false }

  const loginAt = await getAuthLoginEpoch()
  const key = memoryKey(user.id, loginAt)
  seenMemoryKeys.add(key)

  const { data, error } = await supabase.rpc('mark_ranking_celebration_popup_seen', {
    p_login_at: loginAt,
  })

  if (error) {
    if (import.meta.env.DEV && !isMissingRpcError(error)) {
      console.warn('[rankingCelebration] popup mark failed', error.message)
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(RANKING_CELEBRATION_POPUP_UPDATED))
    }
    return { ok: !isMissingRpcError(error) ? false : true }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(RANKING_CELEBRATION_POPUP_UPDATED))
  }
  return { ok: data?.ok !== false }
}

/** @deprecated 수동 「🎉 카드」 버튼용 — 자동 팝업 기록과 무관 */
export function clearRankingCelebrationSeenThisLogin(_user) {
  /* no-op: Supabase 세션 기록 유지, 수동 열기는 RankingPage에서 setShowCelebration */
}

/** @deprecated */
export function markRankingCelebrationSeenThisLogin(_user) {
  /* replaced by markRankingCelebrationPopupSeen */
}

/** @deprecated */
export function hasSeenRankingCelebrationThisLogin(_user) {
  return false
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
  return true
}
