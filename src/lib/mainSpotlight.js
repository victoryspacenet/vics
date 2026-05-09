import { supabase } from './supabase'
import { SPOTLIGHT_DEMO_MATCHUP_IDS } from './spotlightDemo'

export const MAIN_SPOTLIGHT_1H_COST = 5000
/** 서버 RPC 노출 구간과 동일 (6시간) */
export const MAIN_SPOTLIGHT_DURATION_MS = 6 * 60 * 60 * 1000
/** 전역 동시 스포트라이트 슬롯 수 (1계정 1슬롯이므로 최대 6계정까지) */
export const MAIN_SPOTLIGHT_MAX_SLOTS = 6
/** 동일 계정이 동시에 쓸 수 있는 슬롯 수 */
export const MAIN_SPOTLIGHT_MAX_PER_ACCOUNT = 1

/** `matchups` 단일 행 조회용 (스포트라이트 카드·메인 피드와 동일 계열) */
const MATCHUP_ROW_SELECT = `id, user_id, right_user_id, title, description, left_type, right_type, left_url, right_url, left_text, right_text,
  left_thumbnail_url, right_thumbnail_url, left_label, right_label,
  left_votes, right_votes, total_votes, tags, status, created_at, is_demo,
  profiles:user_id(id, nickname, avatar_url, points, featured_badge),
  right_profiles:right_user_id(id, nickname, avatar_url, points, featured_badge)`

/**
 * 현재 시각 기준 활성인 "메인 스포트라이트" 예약 1건의 매치업 행.
 * 여러 슬롯 중 가장 최근 시작한 예약을 메인 캐러셀에 표시.
 * (bookings→matchups 한 번에 embed 하면 PostgREST/RLS·시계 때문에 빈 값이 나오는 경우가 있어 2단계 조회)
 *
 * @param {string|null|undefined} viewerUserId — 로그인 시 해당 유저의 이 매치업 투표 여부(`viewer_vote_side`)를 같은 요청 주기에 붙임(새로고침 후 투표 잠금 UI용)
 */
export async function fetchActiveMainSpotlightMatchup(viewerUserId) {
  const now = new Date().toISOString()
  const { data: bookingRows, error: bErr } = await supabase
    .from('main_spotlight_bookings')
    .select('matchup_id')
    .gt('ends_at', now)
    .order('starts_at', { ascending: false })
    .limit(1)

  if (bErr) {
    if (import.meta.env.DEV) console.warn('[mainSpotlight] bookings:', bErr.message)
    return null
  }

  const matchupId = bookingRows?.[0]?.matchup_id
  if (!matchupId) return null

  let { data: m, error: mErr } = await supabase
    .from('matchups')
    .select(MATCHUP_ROW_SELECT)
    .eq('id', matchupId)
    .maybeSingle()

  if (mErr && import.meta.env.DEV) console.warn('[mainSpotlight] matchup:', mErr.message)

  // right_user_id 미적용 DB 등으로 embed 실패 시 프로필 없이 재시도
  if (mErr || !m) {
    const fallback = await supabase
      .from('matchups')
      .select(
        `id, user_id, right_user_id, title, description, left_type, right_type, left_url, right_url, left_text, right_text,
        left_thumbnail_url, right_thumbnail_url, left_label, right_label,
        left_votes, right_votes, total_votes, tags, status, created_at, is_demo,
        profiles:user_id(id, nickname, avatar_url, points, featured_badge)`
      )
      .eq('id', matchupId)
      .maybeSingle()
    m = fallback.data
    mErr = fallback.error
    if (mErr && import.meta.env.DEV) console.warn('[mainSpotlight] matchup fallback:', mErr.message)
  }

  if (!m || typeof m !== 'object') return null

  const uid = viewerUserId ? String(viewerUserId) : ''
  if (!uid) {
    return { ...m, viewer_vote_side: null }
  }

  const { data: voteRows, error: vErr } = await supabase
    .from('votes')
    .select('side')
    .eq('matchup_id', m.id)
    .eq('user_id', uid)
    .limit(1)

  if (vErr && import.meta.env.DEV) console.warn('[mainSpotlight] viewer vote:', vErr.message)
  const rawSide = voteRows?.[0]?.side
  const viewer_vote_side = rawSide === 'left' || rawSide === 'right' ? rawSide : null
  return { ...m, viewer_vote_side }
}

const DEMO_MATCHUP_ORDER = new Map(SPOTLIGHT_DEMO_MATCHUP_IDS.map((id, i) => [id, i]))

/**
 * 메인 스포트라이트 폴백용 고정 UUID 데모 매치업 2건 (`supabase_spotlight_demo_matchups.sql` 시드)
 * @param {string|null|undefined} viewerUserId
 */
export async function fetchSpotlightDemoMatchups(viewerUserId) {
  const ids = SPOTLIGHT_DEMO_MATCHUP_IDS
  let { data: rows, error } = await supabase
    .from('matchups')
    .select(MATCHUP_ROW_SELECT)
    .in('id', ids)

  if (error || !rows?.length) {
    const fb = await supabase
      .from('matchups')
      .select(
        `id, user_id, right_user_id, title, description, left_type, right_type, left_url, right_url, left_text, right_text,
        left_thumbnail_url, right_thumbnail_url, left_label, right_label,
        left_votes, right_votes, total_votes, tags, status, created_at, is_demo,
        profiles:user_id(id, nickname, avatar_url, points, featured_badge)`
      )
      .in('id', ids)
    rows = fb.data
    error = fb.error
    if (error || !rows?.length) {
      if (import.meta.env.DEV) console.warn('[mainSpotlight] demo matchups:', error?.message)
      return []
    }
  }

  rows = [...rows].sort(
    (a, b) => (DEMO_MATCHUP_ORDER.get(String(a.id)) ?? 99) - (DEMO_MATCHUP_ORDER.get(String(b.id)) ?? 99)
  )

  const uid = viewerUserId ? String(viewerUserId) : ''
  if (!uid) {
    return rows.map((m) => ({ ...m, viewer_vote_side: null }))
  }

  const { data: voteRows, error: vErr } = await supabase
    .from('votes')
    .select('matchup_id, side')
    .in('matchup_id', ids)
    .eq('user_id', uid)

  if (vErr && import.meta.env.DEV) console.warn('[mainSpotlight] demo viewer votes:', vErr.message)
  const sideByMatchup = new Map()
  for (const v of voteRows || []) {
    const mid = String(v.matchup_id)
    const sd = v.side === 'left' || v.side === 'right' ? v.side : null
    if (sd && !sideByMatchup.has(mid)) sideByMatchup.set(mid, sd)
  }

  return rows.map((m) => ({
    ...m,
    viewer_vote_side: sideByMatchup.get(String(m.id)) ?? null,
  }))
}

/** 내가 만든·완료된 활성 매치업 — 스포트라이트 후보 */
export async function fetchSpotlightEligibleMatchups(userId) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('matchups')
    .select(
      'id, title, left_label, right_label, left_thumbnail_url, right_thumbnail_url, left_type, right_type, total_votes, created_at'
    )
    .eq('user_id', userId)
    .eq('status', 'active')
    .not('right_type', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    if (import.meta.env.DEV) console.warn('[fetchSpotlightEligibleMatchups]', error.message)
    return []
  }
  return data || []
}

const emptySlotStatus = () => ({
  usedSlots: 0,
  maxSlots: MAIN_SPOTLIGHT_MAX_SLOTS,
  slotsFull: false,
  earliestEnd: null,
  activeMatchupIds: [],
  myActiveCount: 0,
})

/**
 * 전역 스포트라이트 슬롯 사용량 (최대 MAIN_SPOTLIGHT_MAX_SLOTS, 6시간 노출 구간이 겹치는 예약만 집계)
 * @param {string|null} viewerId — 내가 쓰는 슬롯 개수 안내용
 */
export async function fetchGlobalSpotlightSlotStatus(viewerId = null) {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('main_spotlight_bookings')
    .select('ends_at, user_id, matchup_id')
    .gt('ends_at', now)
    .order('ends_at', { ascending: true })

  if (error) {
    if (import.meta.env.DEV) console.warn('[fetchGlobalSpotlightSlotStatus]', error.message)
    return emptySlotStatus()
  }

  const rows = data || []
  const usedSlots = rows.length
  const slotsFull = usedSlots >= MAIN_SPOTLIGHT_MAX_SLOTS
  const earliestEnd = rows[0]?.ends_at ?? null
  const activeMatchupIds = rows.map((r) => r.matchup_id).filter(Boolean)
  const myActiveCount =
    viewerId && rows.length ? rows.filter((r) => r.user_id === viewerId).length : 0

  return {
    usedSlots,
    maxSlots: MAIN_SPOTLIGHT_MAX_SLOTS,
    slotsFull,
    earliestEnd,
    activeMatchupIds,
    myActiveCount,
  }
}

/**
 * 메인 스포트라이트 6h 구매 (RPC `purchase_main_spotlight_1h`: 포인트 차감 + 예약)
 * @returns {Promise<{ ok: true, bookingId: string, endsAt: string, pointsSpent: number } | { ok: false, error: string }>}
 */
export async function purchaseMainSpotlight1hRpc(matchupId) {
  const { data: raw, error } = await supabase.rpc('purchase_main_spotlight_1h', {
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
    bookingId: data.booking_id,
    endsAt: data.ends_at,
    pointsSpent: data.points_spent ?? MAIN_SPOTLIGHT_1H_COST,
  }
}
