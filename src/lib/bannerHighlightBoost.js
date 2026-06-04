import { supabase } from './supabase'
import { isMainSeedMatchup } from './seedMatchupTitles'
import { isSpotlightDemoMatchup } from './spotlightDemo'

export const BANNER_HIGHLIGHT_COST = 1000
/** 서버 상한: 구매 시각 + 48시간(실제 종료는 투표 expires_at과 비교해 더 이른 시각) */
export const BANNER_HIGHLIGHT_DURATION_MS = 48 * 60 * 60 * 1000

export function isFeedBannerHighlightActive(matchup) {
  const until = matchup?.feed_banner_highlight_until
  if (!until) return false
  return new Date(until).getTime() > Date.now()
}

/** 부스트 재구매 가능(현재 네온 강조가 끝난 매치업만) */
export function canPurchaseBannerHighlightForMatchup(matchup) {
  return !isFeedBannerHighlightActive(matchup)
}

/** 내가 만든·활성·양쪽 완성·투표 진행 중 매치업 — 배너 강조 후보 */
export async function fetchBannerHighlightEligibleMatchups(userId) {
  if (!userId) return []
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('matchups')
    .select(
      'id, title, left_label, right_label, left_thumbnail_url, right_thumbnail_url, left_type, right_type, total_votes, created_at, feed_banner_highlight_until, expires_at'
    )
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('is_demo', false)
    .not('right_type', 'is', null)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    if (import.meta.env.DEV) console.warn('[fetchBannerHighlightEligibleMatchups]', error.message)
    return []
  }
  return (data || []).filter(
    (m) => !isSpotlightDemoMatchup(m) && !isMainSeedMatchup(m) && m.category !== 'spotlight_demo'
  )
}

/**
 * 배너 강조 구매 (RPC `purchase_matchup_banner_highlight`)
 * 서버: feed_banner_highlight_until = least(구매+48h, matchups.expires_at) — 투표 종료 후 불가
 * @returns {Promise<{ ok: true, endsAt: string, pointsSpent: number } | { ok: false, error: string }>}
 */
export async function purchaseMatchupBannerHighlightRpc(matchupId) {
  const { data: raw, error } = await supabase.rpc('purchase_matchup_banner_highlight', {
    p_matchup_id: matchupId,
  })

  if (error) {
    return { ok: false, error: error.message || '구매 요청에 실패했어요' }
  }

  let data = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch {
      return { ok: false, error: '응답이 올바르지 않아요' }
    }
  }

  if (data == null || typeof data !== 'object') {
    return { ok: false, error: '응답이 올바르지 않아요' }
  }

  if (data.ok === false) {
    return { ok: false, error: typeof data.error === 'string' ? data.error : '구매에 실패했어요' }
  }

  return {
    ok: true,
    endsAt: data.ends_at,
    pointsSpent: data.points_spent ?? BANNER_HIGHLIGHT_COST,
  }
}
