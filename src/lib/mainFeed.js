import { supabase } from './supabase'
import {
  MATCHUP_CREATOR_PROFILE_FIELDS,
  EMPTY_TIER_RANK_INFO,
  fetchCreatorRankMapForIds,
} from './creatorRankSnapshot'
import { displayVotePercents, displayVoteTotal } from './displayVoteCount'

/** 메인 홈 캐러셀(베스트·추천·NEW) 섹션당 최대 노출 개수 */
export const MAIN_FEED_BEST_LIMIT = 7
export const MAIN_FEED_HOT_LIMIT = 7
export const MAIN_FEED_NEW_LIMIT = 7

/**
 * 베스트·추천 중복 노출 규칙
 * - 베스트: 화면 득표 내림차순(실제 표+봇 표+Display Offset). 화면 득표가 같을 때만 랜덤
 * - 동일 매치업이 「표 1위」와 「박빙」 조건을 모두 만족하면 **베스트만** 노출
 * - 추천은 박빙(양쪽 표 있고 표시 격차 ≤ 20%p, 40:60 이하)만. 부족하면 슬롯을 비움
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

/** 추천(박빙) — 화면에 보이는 좌/우 % 격차가 이 값 이하여야 함 (40:60) */
export const HOT_CLOSE_MAX_GAP_PCT = 20

/** 양쪽 모두 표가 있고, 표시 비율이 40:60 이하로 붙어 있는 매치업 */
export function isCloseRecommendedMatchup(m) {
  const leftRaw = Number(m?.left_votes) || 0
  const rightRaw = Number(m?.right_votes) || 0
  if (leftRaw <= 0 || rightRaw <= 0) return false
  const { left, right } = displayVotePercents(m)
  return Math.abs(left - right) <= HOT_CLOSE_MAX_GAP_PCT
}

function matchupRawVoteTotal(m) {
  return Math.max(
    Number(m?.total_votes) || 0,
    (Number(m?.left_votes) || 0) + (Number(m?.right_votes) || 0),
  )
}

function matchupShownVoteTotal(m) {
  return displayVoteTotal(matchupRawVoteTotal(m), m?.id)
}

/** 베스트 — 화면에 찍히는 득표 많은 순, 동점만 랜덤 */
function sortBestVotePool(pool) {
  if (!pool?.length) return []
  return [...pool]
    .map((m) => ({ m, shown: matchupShownVoteTotal(m), tie: Math.random() }))
    .sort((a, b) => (b.shown !== a.shown ? b.shown - a.shown : a.tie - b.tie))
    .map(({ m }) => m)
}

/** 박빙만, 격차 작은 순 */
function sortHotVotePool(pool) {
  if (!pool?.length) return []
  return [...pool]
    .filter((m) => isCloseRecommendedMatchup(m))
    .map((m) => {
      const { left, right } = displayVotePercents(m)
      return { m, gap: Math.abs(left - right) }
    })
    .sort((a, b) => {
      if (a.gap !== b.gap) return a.gap - b.gap
      return new Date(b.m.created_at || 0) - new Date(a.m.created_at || 0)
    })
    .map(({ m }) => m)
}

/** 박빙(투표 격차 비율) 순 — `excludeIds`에 있는 id(베스트 선정분)는 건너뜀 */
function pickHotIdsFromSortedPool(sortedIds, limit = MAIN_FEED_HOT_LIMIT, excludeIds = null) {
  const excluded = excludeIds instanceof Set ? excludeIds : new Set()
  const picked = []
  for (const rawId of sortedIds || []) {
    const id = String(rawId ?? '').trim().toLowerCase()
    if (!id || excluded.has(id)) continue
    picked.push(rawId)
    if (picked.length >= limit) break
  }
  return picked
}

async function fetchActiveHotVotePoolRows() {
  const { data, error } = await withVotingInProgressFilter(
    supabase
      .from('matchups')
      .select(HOT_POOL_SELECT)
      .eq('status', 'active')
      .not('right_type', 'is', null),
  )
  if (error) throw error
  return data || []
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
  const [{ data: newPool }, { bestIds: bestSortedIds, hotIds: hotSortedIds }] = await Promise.all([
    withNewWaitingMatchupFilter(
      supabase
        .from('matchups')
        .select(MATCHUP_EMBED)
        .order('created_at', { ascending: false })
        .limit(MAIN_FEED_NEW_LIMIT + 1),
    ),
    fetchBestAndHotSortedMatchupIds(),
  ])

  const bestIds = (bestSortedIds || []).slice(0, MAIN_FEED_BEST_LIMIT)
  const bestIdSet = bestMatchupIdSet(bestIds.map((id) => ({ id })))
  const hotIds = pickHotIdsFromSortedPool(hotSortedIds, MAIN_FEED_HOT_LIMIT + 1, bestIdSet)
  const fullIds = [...new Set([...bestIds, ...hotIds])]

  let fullRows = []
  if (fullIds.length > 0) {
    const { data, error } = await supabase
      .from('matchups')
      .select(MATCHUP_EMBED)
      .in('id', fullIds)
    if (error) {
      console.warn('[mainFeed] best/hot full rows:', error.message)
    } else {
      fullRows = data || []
    }
  }

  const newRows = newPool || []
  const newPicked = newRows.slice(0, MAIN_FEED_NEW_LIMIT)

  return {
    best: attachEmptyCreatorRank(orderMatchupsByIds(fullRows, bestIds)),
    hot: attachEmptyCreatorRank(orderMatchupsByIds(fullRows, hotIds)).slice(0, MAIN_FEED_HOT_LIMIT),
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
/** 투표 진행 중 풀의 베스트·추천 정렬 id 캐시 */
let voteSortedIdCache = null
let voteSortedIdCacheAt = 0

export function invalidateMainFeaturedFeedCache() {
  featuredRestrictionCache = null
  featuredRestrictionCacheAt = 0
  voteSortedIdCache = null
  voteSortedIdCacheAt = 0
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

  const { bestIds: bestSortedIds, hotIds: hotSortedIds } = await fetchBestAndHotSortedMatchupIds()

  const roleById = {}
  for (const rawId of (bestSortedIds || []).slice(0, MAIN_FEED_BEST_LIMIT)) {
    const id = normalizeFeaturedMatchupId(rawId)
    if (id) roleById[id] = 'best'
  }
  const bestIds = new Set(Object.keys(roleById))
  for (const rawId of pickHotIdsFromSortedPool(hotSortedIds, MAIN_FEED_HOT_LIMIT, bestIds)) {
    const id = normalizeFeaturedMatchupId(rawId)
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

async function fetchBestAndHotSortedMatchupIds() {
  const now = Date.now()
  if (voteSortedIdCache && now - voteSortedIdCacheAt < FEATURED_RESTRICTION_CACHE_MS) {
    return voteSortedIdCache
  }

  const data = await fetchActiveHotVotePoolRows()
  const result = {
    bestIds: sortBestVotePool(data).map((m) => m.id).filter(Boolean),
    hotIds: sortHotVotePool(data).map((m) => m.id).filter(Boolean),
  }
  voteSortedIdCache = result
  voteSortedIdCacheAt = now
  return result
}

async function fetchHotSortedMatchupIds() {
  const { hotIds } = await fetchBestAndHotSortedMatchupIds()
  return hotIds
}

/** `/feed/best` — 투표 진행 중 매치업, 화면 득표 내림차순(동점만 랜덤) */
export async function fetchMainBestFeedPage({ page = 1, pageSize = 12 } = {}) {
  const { bestIds } = await fetchBestAndHotSortedMatchupIds()
  const totalCount = bestIds.length
  const from = Math.max(0, (page - 1) * pageSize)
  const pageIds = bestIds.slice(from, from + pageSize)

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

/** `/feed/hot` — 투표 진행 중 박빙 매치업만, 격차 작은 순 */
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
