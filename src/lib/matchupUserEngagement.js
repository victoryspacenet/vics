import { supabase } from './supabase'

const IN_CHUNK = 80

function chunkIds(ids) {
  const out = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    out.push(ids.slice(i, i + IN_CHUNK))
  }
  return out
}

/**
 * 로그인 유저의 투표·좋아요를 매치업 ID 목록 기준으로 배치 조회
 * @returns {{ votesByMatchupId: Record<string, 'left'|'right'>, likedMatchupIds: Set<string> }}
 */
export async function fetchUserEngagementForMatchups(userId, matchupIds) {
  const ids = [...new Set((matchupIds || []).map(String).filter(Boolean))]
  const empty = { votesByMatchupId: {}, likedMatchupIds: new Set() }
  if (!userId || ids.length === 0) return empty

  const votesByMatchupId = {}
  const likedMatchupIds = new Set()

  const chunks = chunkIds(ids)
  await Promise.all(
    chunks.map(async (part) => {
      const [votesRes, likesRes] = await Promise.all([
        supabase
          .from('votes')
          .select('matchup_id, side')
          .eq('user_id', userId)
          .in('matchup_id', part),
        supabase.from('likes').select('matchup_id').eq('user_id', userId).in('matchup_id', part),
      ])
      for (const row of votesRes.data || []) {
        if (row?.matchup_id && (row.side === 'left' || row.side === 'right')) {
          votesByMatchupId[row.matchup_id] = row.side
        }
      }
      for (const row of likesRes.data || []) {
        if (row?.matchup_id) likedMatchupIds.add(row.matchup_id)
      }
    }),
  )

  return { votesByMatchupId, likedMatchupIds }
}
