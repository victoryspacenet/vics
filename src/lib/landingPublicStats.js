import { supabase } from './supabase'
import { displayVoteTotal } from './displayVoteCount'
import { isCloseRecommendedMatchup, MAIN_FEED_BEST_LIMIT } from './mainFeed'

const LANDING_HOT_SELECT = [
  'id',
  'title',
  'category',
  'tags',
  'left_thumbnail_url',
  'left_label',
  'right_thumbnail_url',
  'right_label',
  'left_votes',
  'right_votes',
  'total_votes',
  'right_type',
  'expires_at',
  'is_complete',
  'is_demo',
].join(', ')

function matchupRawVoteTotal(m) {
  return Math.max(
    Number(m?.total_votes) || 0,
    (Number(m?.left_votes) || 0) + (Number(m?.right_votes) || 0),
  )
}

function matchupShownVoteTotal(m) {
  return displayVoteTotal(matchupRawVoteTotal(m), m?.id)
}

function pickRandomRow(rows) {
  if (!rows?.length) return null
  return rows[Math.floor(Math.random() * rows.length)]
}

/**
 * 빅스사용법 HOT 카드 — 실시간 진행 중만.
 * 고득표(화면 표 상위) ∩ 박빙이면 그중 랜덤, 아니면 박빙 → 고득표 순.
 */
export function pickLandingLiveHotMatchup(rows) {
  const live = (rows || []).filter((m) => m?.id && m.right_type != null)
  if (!live.length) return null

  const ranked = [...live].sort((a, b) => {
    const diff = matchupShownVoteTotal(b) - matchupShownVoteTotal(a)
    return diff !== 0 ? diff : Math.random() - 0.5
  })
  const highVote = ranked.filter((m) => matchupRawVoteTotal(m) > 0).slice(0, MAIN_FEED_BEST_LIMIT)
  const close = live.filter((m) => isCloseRecommendedMatchup(m))
  const highIds = new Set(highVote.map((m) => m.id))
  const overlap = close.filter((m) => highIds.has(m.id))

  if (overlap.length) return pickRandomRow(overlap)
  if (close.length) {
    return [...close].sort((a, b) => matchupShownVoteTotal(b) - matchupShownVoteTotal(a))[0]
  }
  if (highVote.length) return highVote[0]
  return ranked[0]
}

/** 투표 기한이 남은(또는 무기한) 실시간 듀얼 중 HOT 1건 */
export async function fetchLandingLiveHotMatchup() {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('matchups')
    .select(LANDING_HOT_SELECT)
    .eq('status', 'active')
    .not('right_type', 'is', null)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
  if (error) throw error

  const live = (data || []).filter((m) => m.is_demo !== true)
  return pickLandingLiveHotMatchup(live)
}

/**
 * 랜딩 히어로 통계 (Supabase 실데이터).
 * `get_landing_public_stats` RPC가 있으면 투표 참여자 수(distinct)까지 정확히 반환하고,
 * 없으면 matchups / votes / profiles head count로 대체합니다.
 */
export async function fetchLandingPublicStats() {
  const { data: rpcRows, error: rpcError } = await supabase.rpc('get_landing_public_stats')
  const rpcRow = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows
  if (!rpcError && rpcRow && rpcRow.matchup_count != null) {
    return {
      matchupCount: Number(rpcRow.matchup_count) || 0,
      voteCount: Number(rpcRow.vote_count) || 0,
      activeUserCount: Number(rpcRow.voter_count) || 0,
    }
  }

  const [m, v, p] = await Promise.all([
    supabase
      .from('matchups')
      .select('id', { count: 'exact', head: true })
      .in('status', ['active', 'closed']),
    supabase.from('votes').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
  ])

  return {
    matchupCount: m.count ?? 0,
    voteCount: v.count ?? 0,
    activeUserCount: p.count ?? 0,
  }
}
