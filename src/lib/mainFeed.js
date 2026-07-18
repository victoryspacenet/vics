import { supabase } from './supabase'
import {
  MATCHUP_CREATOR_PROFILE_FIELDS,
  EMPTY_TIER_RANK_INFO,
  fetchCreatorRankMapForIds,
} from './creatorRankSnapshot'

/** 메인 홈 캐러셀(베스트·추천·NEW) 섹션당 최대 노출 개수 */
export const MAIN_FEED_BEST_LIMIT = 7
export const MAIN_FEED_HOT_LIMIT = 7
export const MAIN_FEED_NEW_LIMIT = 7
/** HOT 백빙 선별용 후보 풀 (전체 행 embed 대신 id·표만 먼저 조회) */
export const MAIN_FEED_HOT_POOL_LIMIT = 36

/**
 * 베스트·추천 중복 노출 규칙
 * - 동일 매치업이 「표 1위」와 「박빙」 조건을 모두 만족하면 **베스트만** 노출
 * - 추천(박빙) 슬롯·목록 뱃지에서는 제외하고, 다음 박빙 후보로 채움
 */

const MAIN_FEED_MATCHUP_COLUMNS = [
  'id',
  'user_id',
  'right_user_id',
  'title',
  'left_type',
  'right_type',
  'left_url',
  'right_url',
  'left_text',
  'right_text',
  'left_thumbnail_url',
  'right_thumbnail_url',
  'left_label',
  'right_label',
  'left_votes',
  'right_votes',
  'total_votes',
  'tags',
  'status',
  'created_at',
  'updated_at',
  'challenger_joined_at',
  'is_complete',
  'is_demo',
  'feed_banner_highlight_until',
  'expires_at',
  'comments_count',
  'likes_count',
  'category',
].join(', ')

const MATCHUP_EMBED = `${MAIN_FEED_MATCHUP_COLUMNS}, profiles:user_id(${MATCHUP_CREATOR_PROFILE_FIELDS}), right_profiles:right_user_id(${MATCHUP_CREATOR_PROFILE_FIELDS})`

/** `/matchups` 피드 카드용 */
export const HOME_FEED_MATCHUP_SELECT = MATCHUP_EMBED

const HOT_POOL_SELECT = 'id, left_votes, right_votes, total_votes, created_at'

/** 투표 진행 중 — `expires_at` 없음 또는 미래 (목록·배너 부스트와 동일) */
function withVotingInProgressFilter(query) {
  const now = new Date().toISOString()
  return query.or(`expires_at.is.null,expires_at.gt.${now}`)
}

/**
 * 도전자 모집 중 NEW — active + B측 미완성.
 * `expires_at`는 생성 시 투표 기간 예약값이라, 도전 전에는 지나도 목록에서 빼지 않습니다.
 * (도전 시 ChallengeDrawer가 기한을 재설정합니다.)
 */
function withNewWaitingMatchupFilter(query) {
  return query.eq('status', 'active').is('right_type', null)
}

function orderMatchupsByIds(rows, ids) {
  if (!ids?.length || !rows?.length) return []
  const byId = new Map(rows.map((r) => [r.id, r]))
  return ids.map((id) => byId.get(id)).filter(Boolean)
}

function attachEmptyCreatorRank(matchups) {
  return (matchups || []).map((m) => ({
    ...m,
    _creatorRankInfo: { ...EMPTY_TIER_RANK_INFO },
    _rightCreatorRankInfo: { ...EMPTY_TIER_RANK_INFO },
  }))
}

/** 백빙(투표 격차 비율) 순 정렬 — 투표 1표 이상만 */
function sortHotVotePool(pool) {
  if (!pool?.length) return []
  return [...pool]
    .filter((m) => (m.total_votes || 0) > 0)
    .map((m) => {
      const tv = Math.max(1, Number(m.total_votes) || 1)
      const gap = Math.abs((m.left_votes || 0) - (m.right_votes || 0)) / tv
      return { m, gap }
    })
    .sort((a, b) => {
      if (a.gap !== b.gap) return a.gap - b.gap
      return new Date(b.m.created_at || 0) - new Date(a.m.created_at || 0)
    })
    .map(({ m }) => m)
}

/** 백빙(투표 격차 비율) 순 — `excludeIds`에 있는 id(베스트 선정분)는 건너뜀 */
function pickHotFromVotePool(pool, limit = 20, excludeIds = null) {
  const excluded = excludeIds instanceof Set ? excludeIds : new Set()
  return sortHotVotePool(pool)
    .filter((m) => {
      const id = String(m?.id ?? '').trim().toLowerCase()
      return id && !excluded.has(id)
    })
    .slice(0, limit)
}

const UUID_HEX_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function bestMatchupIdSet(rows) {
  return new Set(
    (rows || [])
      .map((m) => String(m?.id ?? '').trim().toLowerCase())
      .filter((id) => UUID_HEX_RE.test(id)),
  )
}

/**
 * 메인 피드용 매치업만 로드 (티어 RPC 없음). 카드·썸네일을 먼저 그릴 때 사용.
 * 완료/신규 풀 조회는 병렬로 수행합니다.
 */
export async function fetchMainMatchupsQuick() {
  const [{ data: bestRows }, { data: hotPool }, { data: newPool }] = await Promise.all([
    withVotingInProgressFilter(
      supabase
        .from('matchups')
        .select(MATCHUP_EMBED)
        .eq('status', 'active')
        .not('right_type', 'is', null)
        .gt('total_votes', 0)
        .order('total_votes', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(MAIN_FEED_BEST_LIMIT + 1),
    ),
    withVotingInProgressFilter(
      supabase
        .from('matchups')
        .select(HOT_POOL_SELECT)
        .eq('status', 'active')
        .not('right_type', 'is', null)
        .gt('total_votes', 0)
        .order('total_votes', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(MAIN_FEED_HOT_POOL_LIMIT),
    ),
    withNewWaitingMatchupFilter(
      supabase
        .from('matchups')
        .select(MATCHUP_EMBED)
        .order('created_at', { ascending: false })
        .limit(MAIN_FEED_NEW_LIMIT + 1),
    ),
  ])

  const bestPicked = (bestRows || []).slice(0, MAIN_FEED_BEST_LIMIT)
  const bestIds = bestMatchupIdSet(bestPicked)

  const hotPickedLean = pickHotFromVotePool(hotPool || [], MAIN_FEED_HOT_LIMIT + 1, bestIds)
  const hotIds = hotPickedLean.map((m) => m.id).filter(Boolean)
  let hotPicked = []
  if (hotIds.length > 0) {
    const { data: hotFullRows, error: hotFullErr } = await supabase
      .from('matchups')
      .select(MATCHUP_EMBED)
      .in('id', hotIds)
    if (hotFullErr) {
      console.warn('[mainFeed] hot full rows:', hotFullErr.message)
    } else {
      hotPicked = orderMatchupsByIds(hotFullRows || [], hotIds)
    }
  }

  const newRows = newPool || []
  const newPicked = newRows.slice(0, MAIN_FEED_NEW_LIMIT)

  return {
    best: attachEmptyCreatorRank(bestPicked),
    hot: attachEmptyCreatorRank(hotPicked).slice(0, MAIN_FEED_HOT_LIMIT),
    new: attachEmptyCreatorRank(newPicked),
  }
}

/** 메인 퀵 피드 기준 각 매치업 id → 피드 뱃지 역할 (`best` 우선 — 동일 매치업이 두 슬롯일 때). */
export function featuredListBadgeRoleByIdFromQuick(quick) {
  const roleById = {}
  for (const m of quick.best || []) {
    const id = String(m?.id ?? '').trim().toLowerCase()
    if (!UUID_HEX_RE.test(id)) continue
    roleById[id] = 'best'
  }
  for (const m of quick.hot || []) {
    const id = String(m?.id ?? '').trim().toLowerCase()
    if (!UUID_HEX_RE.test(id)) continue
    if (!roleById[id]) roleById[id] = 'hot'
  }
  return roleById
}

/**
 * `/matchups` 활성 목록 필터용: 베스트·추천 **뱃지** 역할 (상위 7+7, 베스트 우선).
 * 목록 피드 본문은 투표 진행 중 매치업 전체를 노출하고, 여기 id에만 뱃지를 붙입니다.
 */
const FEATURED_RESTRICTION_CACHE_MS = 60_000
let featuredRestrictionCache = null
let featuredRestrictionCacheAt = 0
/** `/feed/hot` 박빙 정렬 id 캐시 (페이지마다 전체 재조회 방지) */
let hotSortedIdCache = null
let hotSortedIdCacheAt = 0

export function invalidateMainFeaturedFeedCache() {
  featuredRestrictionCache = null
  featuredRestrictionCacheAt = 0
  hotSortedIdCache = null
  hotSortedIdCacheAt = 0
}

function normalizeFeaturedMatchupId(id) {
  const key = String(id ?? '').trim().toLowerCase()
  return UUID_HEX_RE.test(key) ? key : null
}

export async function fetchMainFeaturedFeedRestriction() {
  const now = Date.now()
  if (featuredRestrictionCache && now - featuredRestrictionCacheAt < FEATURED_RESTRICTION_CACHE_MS) {
    return featuredRestrictionCache
  }

  const [{ data: bestRows }, { data: hotPool }] = await Promise.all([
    withVotingInProgressFilter(
      supabase
        .from('matchups')
        .select('id')
        .eq('status', 'active')
        .not('right_type', 'is', null)
        .gt('total_votes', 0)
        .order('total_votes', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(MAIN_FEED_BEST_LIMIT),
    ),
    withVotingInProgressFilter(
      supabase
        .from('matchups')
        .select(HOT_POOL_SELECT)
        .eq('status', 'active')
        .not('right_type', 'is', null)
        .gt('total_votes', 0)
        .order('total_votes', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(MAIN_FEED_HOT_POOL_LIMIT),
    ),
  ])

  const roleById = {}
  for (const m of bestRows || []) {
    const id = normalizeFeaturedMatchupId(m?.id)
    if (id) roleById[id] = 'best'
  }
  const bestIds = new Set(Object.keys(roleById))
  for (const m of pickHotFromVotePool(hotPool || [], MAIN_FEED_HOT_LIMIT, bestIds)) {
    const id = normalizeFeaturedMatchupId(m?.id)
    if (id && !roleById[id]) roleById[id] = 'hot'
  }

  const result = { ids: Object.keys(roleById), roleById }
  featuredRestrictionCache = result
  featuredRestrictionCacheAt = now
  return result
}

/**
 * `/matchups` 등에서 메인 홈과 동일한 “베스트+추천” 매치업만 보이게 할 때 사용하는 id 목록.
 */
export async function fetchMainFeaturedMatchupIds() {
  const { ids } = await fetchMainFeaturedFeedRestriction()
  return ids
}

async function fetchHotSortedMatchupIds() {
  const now = Date.now()
  if (hotSortedIdCache && now - hotSortedIdCacheAt < FEATURED_RESTRICTION_CACHE_MS) {
    return hotSortedIdCache
  }

  const { data, error } = await withVotingInProgressFilter(
    supabase
      .from('matchups')
      .select(HOT_POOL_SELECT)
      .eq('status', 'active')
      .not('right_type', 'is', null)
      .gt('total_votes', 0),
  )
  if (error) throw error

  const ids = sortHotVotePool(data || []).map((m) => m.id).filter(Boolean)
  hotSortedIdCache = ids
  hotSortedIdCacheAt = now
  return ids
}

/** `/feed/best` — 투표 진행 중 매치업 전체, 투표수 내림차순 */
export async function fetchMainBestFeedPage({ page = 1, pageSize = 12 } = {}) {
  const from = Math.max(0, (page - 1) * pageSize)
  const to = from + pageSize - 1

  const { data, error, count } = await withVotingInProgressFilter(
    supabase
      .from('matchups')
      .select(MATCHUP_EMBED, { count: 'exact' })
      .eq('status', 'active')
      .not('right_type', 'is', null)
      .order('total_votes', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(from, to),
  )
  if (error) throw error

  return {
    rows: attachEmptyCreatorRank(data || []),
    totalCount: typeof count === 'number' ? count : (data || []).length,
  }
}

/** `/feed/hot` — 투표 진행 중·1표 이상 매치업 전체, 박빙(격차 비율) 순 */
export async function fetchMainHotFeedPage({ page = 1, pageSize = 12 } = {}) {
  const sortedIds = await fetchHotSortedMatchupIds()
  const totalCount = sortedIds.length
  const from = Math.max(0, (page - 1) * pageSize)
  const pageIds = sortedIds.slice(from, from + pageSize)

  if (!pageIds.length) {
    return { rows: [], totalCount }
  }

  const { data: fullRows, error } = await supabase
    .from('matchups')
    .select(MATCHUP_EMBED)
    .in('id', pageIds)
  if (error) throw error

  return {
    rows: attachEmptyCreatorRank(orderMatchupsByIds(fullRows || [], pageIds)),
    totalCount,
  }
}

/** `/feed/new` — 도전자 모집 중 매치업 전체, 최신순 */
export async function fetchMainNewFeedPage({ page = 1, pageSize = 12 } = {}) {
  const from = Math.max(0, (page - 1) * pageSize)
  const to = from + pageSize - 1

  const { data, error, count } = await withNewWaitingMatchupFilter(
    supabase
      .from('matchups')
      .select(MATCHUP_EMBED, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to),
  )
  if (error) throw error

  return {
    rows: attachEmptyCreatorRank(data || []),
    totalCount: typeof count === 'number' ? count : (data || []).length,
  }
}

/**
 * `fetchMainMatchupsQuick` 결과에 작성자 티어 스냅샷을 한 번의 RPC로 병합합니다.
 */
export async function enrichMainFeedCreatorRanks(feed) {
  if (!feed) return { best: [], hot: [], new: [] }
  const all = [...(feed.best || []), ...(feed.hot || []), ...(feed.new || [])]
  const ids = [
    ...new Set(
      all.flatMap((m) => [
        m.user_id || m.profiles?.id,
        m.right_user_id || m.right_profiles?.id,
      ].filter(Boolean)),
    ),
  ]
  const rankMap = await fetchCreatorRankMapForIds(ids)

  const apply = (list) =>
    (list || []).map((m) => {
      const pid = m.user_id || m.profiles?.id
      const rid = m.right_user_id || m.right_profiles?.id
      const rankInfo = pid && rankMap[pid] ? rankMap[pid] : { ...EMPTY_TIER_RANK_INFO }
      const rightRankInfo = rid && rankMap[rid] ? rankMap[rid] : { ...EMPTY_TIER_RANK_INFO }
      return { ...m, _creatorRankInfo: rankInfo, _rightCreatorRankInfo: rightRankInfo }
    })

  return {
    best: apply(feed.best),
    hot: apply(feed.hot),
    new: apply(feed.new),
  }
}

/** 티어 RPC까지 포함한 전체 로드 (한 번에 await 할 때) */
export async function fetchMainMatchups() {
  const quick = await fetchMainMatchupsQuick()
  return enrichMainFeedCreatorRanks(quick)
}
