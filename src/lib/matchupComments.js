/**
 * 매치업 상세 댓글 — Supabase `comments` (페이징·필요한 만큼만 로드)
 * 정렬: 최신순(desc)으로 range 한 뒤 클라이언트에서 시간순(asc)으로 뒤집어 트리 빌더에 맞춤.
 */
import { supabase } from './supabase'

/** 목록·작성 응답에 공통으로 쓰는 select (embed 프로필) */
export const MATCHUP_COMMENT_SELECT =
  'id, matchup_id, user_id, parent_id, content, created_at, updated_at, profiles:user_id(id, nickname, avatar_url, featured_badge, fandom_tier)'

/** 마이그레이션 미적용 DB용 폴백 (fandom_tier 등 없을 때) */
export const MATCHUP_COMMENT_SELECT_FALLBACK =
  'id, matchup_id, user_id, parent_id, content, created_at, updated_at, profiles:user_id(id, nickname, avatar_url)'

/** 첫 로드 시 최신 쪽 행 수 */
export const MATCHUP_COMMENTS_INITIAL_LIMIT = 50
/** "이전 댓글 더보기" 한 번에 가져올 행 수 */
export const MATCHUP_COMMENTS_MORE_LIMIT = 40

/**
 * @param {{ matchupId: string; offset: number; limit: number; withTotal?: boolean }} args
 * @returns {{ rowsAsc: object[]; totalCount?: number; fetched: number; error: Error | null }}
 */
function buildCommentsRowQuery(matchupId, select, offset, limit) {
  return supabase
    .from('comments')
    .select(select)
    .eq('matchup_id', matchupId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)
}

function shouldRetryCommentsWithFallback(err) {
  const msg = String(err?.message || err || '').toLowerCase()
  return (
    msg.includes('fandom_tier') ||
    msg.includes('featured_badge') ||
    msg.includes('column') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  )
}

async function fetchCommentRows(matchupId, offset, limit, withTotal) {
  const run = async (select) => {
    const rowQuery = buildCommentsRowQuery(matchupId, select, offset, limit)
    if (!withTotal) {
      const { data, error } = await rowQuery
      return { data, error, count: undefined }
    }
    const [{ count, error: countErr }, { data, error: rowErr }] = await Promise.all([
      supabase.from('comments').select('id', { count: 'exact', head: true }).eq('matchup_id', matchupId),
      rowQuery,
    ])
    return { data, error: rowErr || countErr, count }
  }

  let { data, error, count } = await run(MATCHUP_COMMENT_SELECT)
  if (error && shouldRetryCommentsWithFallback(error)) {
    const retry = await run(MATCHUP_COMMENT_SELECT_FALLBACK)
    data = retry.data
    error = retry.error
    count = retry.count
  }
  if (error) throw error

  const rowsAsc = [...(data || [])].reverse()
  return {
    rowsAsc,
    totalCount: withTotal ? (typeof count === 'number' ? count : 0) : undefined,
    fetched: rowsAsc.length,
  }
}

export async function fetchMatchupCommentsWindow({ matchupId, offset, limit, withTotal = false }) {
  if (!matchupId) {
    return { rowsAsc: [], totalCount: withTotal ? 0 : undefined, fetched: 0, error: null }
  }

  try {
    const { rowsAsc, totalCount, fetched } = await fetchCommentRows(matchupId, offset, limit, withTotal)
    return { rowsAsc, totalCount, fetched, error: null }
  } catch (e) {
    console.warn('[matchupComments] fetchMatchupCommentsWindow:', e)
    return {
      rowsAsc: [],
      totalCount: withTotal ? 0 : undefined,
      fetched: 0,
      error: e instanceof Error ? e : new Error(String(e)),
    }
  }
}
