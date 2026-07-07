/**
 * 랭킹 페이지 RPC — 카테고리 × 주/월/전체
 * @see supabase_ranking_category_leaderboard.sql
 */
import { supabase } from './supabase'
import { storedCategoryValuesForFilter } from './matchupCategoryAliases'

export function isMissingCategoryRankingRpcError(error) {
  const msg = String(error?.message || error || '')
  return /profiles_category_ranking_page|function.*does not exist|Could not find the function/i.test(msg)
}

/**
 * @param {{
 *   categoryId?: string|null,
 *   period?: 'all'|'weekly'|'monthly',
 *   typeTab: 'creator'|'voter',
 *   sortBy: 'points'|'votes'|'hitrate',
 *   limit: number,
 *   offset: number,
 *   userId?: string|null,
 * }} opts
 */
export async function fetchRankingLeaderboardPage({
  categoryId = null,
  period = 'all',
  typeTab,
  sortBy,
  limit,
  offset,
  userId = null,
}) {
  const categoryValues =
    categoryId && categoryId !== 'all' ? storedCategoryValuesForFilter(categoryId) : null

  const { data, error } = await supabase.rpc('profiles_category_ranking_page', {
    p_category_values: categoryValues,
    p_type_tab: typeTab,
    p_sort_by: sortBy,
    p_limit: limit,
    p_offset: offset,
    p_user_id: userId || null,
    p_period: period || 'all',
  })
  if (error) throw error
  if (!data || typeof data !== 'object') {
    return { total: 0, rows: [], my_rank: null }
  }
  return {
    total: Number(data.total) || 0,
    rows: Array.isArray(data.rows) ? data.rows : [],
    my_rank: data.my_rank ?? null,
  }
}

/** @deprecated fetchRankingLeaderboardPage 사용 */
export const fetchCategoryRankingPage = fetchRankingLeaderboardPage

/** RPC 행 → 표시용 프로필 (집계값으로 정렬 컬럼 덮어쓰기) */
export function mapCategoryRankingRows(rows, sortConfig) {
  return (rows || []).map((row) => {
    const sortValue = Number(row.sort_value) || 0
    const displayRank = Number(row.display_rank) || 0
    const { sort_value: _sv, display_rank: _dr, ...profile } = row
    const base = { ...profile, _displayRank: displayRank }

    if (sortConfig.kind === 'champion_points') return { ...base, champion_points: sortValue }
    if (sortConfig.kind === 'oracle_points') return { ...base, oracle_points: sortValue }
    if (sortConfig.kind === 'votes') return { ...base, total_votes_received: sortValue }
    if (sortConfig.kind === 'hit_rate') return { ...base, hit_rate: sortValue }
    return base
  })
}

/** my_rank RPC 응답 → RankingPage myRank 형식 */
export function mapCategoryMyRank(myRankPayload, sortConfig) {
  if (!myRankPayload?.data) return null
  const [mapped] = mapCategoryRankingRows(
    [{ ...myRankPayload.data, sort_value: myRankPayload.sort_value, display_rank: myRankPayload.rank }],
    sortConfig,
  )
  if (!mapped) return null
  return {
    rank: Number(myRankPayload.rank) || mapped._displayRank || 0,
    data: mapped,
  }
}
