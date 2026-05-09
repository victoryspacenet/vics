/**
 * 투표 API - 동일 IP/기기 무한 투표 방지
 * 서버에서 IP를 추출하므로 클라이언트 스푸핑 불가
 * 로컬 개발 시 API 미사용 시 직접 Supabase insert로 폴백
 */
import { supabase } from './supabase'

/**
 * @param {string} matchupId
 * @param {'left'|'right'} side
 * @returns {Promise<{ok: boolean, error?: string, code?: string}>}
 */
export async function voteViaApi(matchupId, side) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    return { error: '로그인이 필요해요' }
  }

  try {
    const res = await fetch('/api/vote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ matchup_id: matchupId, side }),
    })

    const json = await res.json().catch(() => ({}))
    if (res.ok) return { ok: true }
    // API 미사용(404 등) 시 로컬 개발 폴백
    if (res.status === 404 || res.status === 0) {
      return voteDirect(matchupId, side, session.user.id)
    }
    return { error: json.error || '투표 중 오류가 발생했어요', code: json.code }
  } catch {
    return voteDirect(matchupId, side, session.user.id)
  }
}

async function voteDirect(matchupId, side, userId) {
  const { error } = await supabase
    .from('votes')
    .insert({ user_id: userId, matchup_id: matchupId, side })
  if (error) {
    if (error.code === '23505') return { error: '이미 투표했어요' }
    if (error.message?.includes('VOTE_IP_LIMIT')) return { error: '이 기기/네트워크에서 해당 매치업에 대한 투표 한도를 초과했어요 (최대 3표)' }
    return { error: error.message || '투표 중 오류가 발생했어요' }
  }
  return { ok: true }
}
