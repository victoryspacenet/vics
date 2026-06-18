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
  'is_demo',
  'feed_banner_highlight_until',
  'expires_at',
  'comments_count',
  'likes_count',
  'category',
].join(', ')

const MATCHUP_EMBED = `${MAIN_FEED_MATCHUP_COLUMNS}, profiles:user_id(${MATCHUP_CREATOR_PROFILE_FIELDS})`

/** `/matchups` 피드 카드용 (작성자 embed만 — right_profiles 조인 생략) */
export const HOME_FEED_MATCHUP_SELECT = MATCHUP_EMBED

const HOT_POOL_SELECT = 'id, left_votes, right_votes, total_votes, created_at'

function orderMatchupsByIds(rows, ids) {
  if (!ids?.length || !rows?.length) return []
  const byId = new Map(rows.map((r) => [r.id, r]))
  return ids.map((id) => byId.get(id)).filter(Boolean)
}

function attachEmptyCreatorRank(matchups) {
  return (matchups || []).map((m) => ({
    ...m,
    _creatorRankInfo: { ...EMPTY_TIER_RANK_INFO },
  }))
}

/** 백빙(투표 격차 비율) 순 — DB에서 후보 풀만 제한적으로 가져온 뒤 상위만 계산 */
function pickHotFromVotePool(pool, limit = 20) {
  if (!pool?.length) return []
  const sorted = [...pool]
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
    .slice(0, limit)
    .map(({ m }) => m)
  return sorted
}

/**
 * 메인 피드용 매치업만 로드 (티어 RPC 없음). 카드·썸네일을 먼저 그릴 때 사용.
 * 완료/신규 풀 조회는 병렬로 수행합니다.
 */
export async function fetchMainMatchupsQuick() {
  const [{ data: bestRows }, { data: hotPool }, { data: newPool }] = await Promise.all([
    supabase
      .from('matchups')
      .select(MATCHUP_EMBED)
      .eq('status', 'active')
      .not('right_type', 'is', null)
      .order('total_votes', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(MAIN_FEED_BEST_LIMIT),
    supabase
      .from('matchups')
      .select(HOT_POOL_SELECT)
      .eq('status', 'active')
      .not('right_type', 'is', null)
      .gt('total_votes', 0)
      .order('total_votes', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(MAIN_FEED_HOT_POOL_LIMIT),
    supabase
      .from('matchups')
      .select(MATCHUP_EMBED)
      .eq('status', 'active')
      .is('right_type', null)
      .order('created_at', { ascending: false })
      .limit(MAIN_FEED_NEW_LIMIT + 1),
  ])

  const hotPickedLean = pickHotFromVotePool(hotPool || [], MAIN_FEED_HOT_LIMIT)
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

  const bestPicked = (bestRows || []).slice(0, MAIN_FEED_BEST_LIMIT)
  const newRows = newPool || []
  const newPicked = newRows.slice(0, MAIN_FEED_NEW_LIMIT)

  return {
    best: attachEmptyCreatorRank(bestPicked),
    hot: attachEmptyCreatorRank(hotPicked).slice(0, MAIN_FEED_HOT_LIMIT),
    new: attachEmptyCreatorRank(newPicked),
  }
}

const UUID_HEX_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
 * `/matchups` 활성 목록 필터용: 허용 id + 각 id의 피드 뱃지 역할.
 * 메인 퀵 피드 전체(fetchMainMatchupsQuick) 없이 베스트·추천 id만 조회합니다.
 */
const FEATURED_RESTRICTION_CACHE_MS = 60_000
let featuredRestrictionCache = null
let featuredRestrictionCacheAt = 0

export function invalidateMainFeaturedFeedCache() {
  featuredRestrictionCache = null
  featuredRestrictionCacheAt = 0
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
    supabase
      .from('matchups')
      .select('id')
      .eq('status', 'active')
      .not('right_type', 'is', null)
      .order('total_votes', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(MAIN_FEED_BEST_LIMIT),
    supabase
      .from('matchups')
      .select(HOT_POOL_SELECT)
      .eq('status', 'active')
      .not('right_type', 'is', null)
      .gt('total_votes', 0)
      .order('total_votes', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(MAIN_FEED_HOT_POOL_LIMIT),
  ])

  const roleById = {}
  for (const m of bestRows || []) {
    const id = normalizeFeaturedMatchupId(m?.id)
    if (id) roleById[id] = 'best'
  }
  for (const m of pickHotFromVotePool(hotPool || [], MAIN_FEED_HOT_LIMIT)) {
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

/**
 * `fetchMainMatchupsQuick` 결과에 작성자 티어 스냅샷을 한 번의 RPC로 병합합니다.
 */
export async function enrichMainFeedCreatorRanks(feed) {
  if (!feed) return { best: [], hot: [], new: [] }
  const all = [...(feed.best || []), ...(feed.hot || []), ...(feed.new || [])]
  const ids = [...new Set(all.map((m) => m.user_id || m.profiles?.id).filter(Boolean))]
  const rankMap = await fetchCreatorRankMapForIds(ids)

  const apply = (list) =>
    (list || []).map((m) => {
      const pid = m.user_id || m.profiles?.id
      const rankInfo = pid && rankMap[pid] ? rankMap[pid] : { ...EMPTY_TIER_RANK_INFO }
      return { ...m, _creatorRankInfo: rankInfo }
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
