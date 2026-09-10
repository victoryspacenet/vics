/**
 * 투표 API - 동일 IP/기기 무한 투표 방지
 * 서버에서 IP를 추출하므로 클라이언트 스푸핑 불가
 * 로컬 개발·네이티브 WebView에서 API가 JSON이 아니거나 실패하면 직접 Supabase insert로 폴백
 */
import { supabase } from './supabase'
import { resolveSiteUrl } from './siteApiBase'
import { notifyTendencyVoteCast } from './tendencyReport'

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

  const userId = session.user.id

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20_000)
    const res = await fetch(resolveSiteUrl('/api/vote'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ matchup_id: matchupId, side }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    const json = await res.json().catch(() => null)

    if (res.status === 401) {
      return { error: json?.error || '로그인이 필요해요', code: json?.code }
    }
    if (res.status === 409) {
      return { error: json?.error || '이미 투표했어요', code: json?.code }
    }
    if (res.status === 429) {
      return {
        error: json?.error || '이 기기/네트워크에서 해당 매치업에 대한 투표 한도를 초과했어요 (최대 3표)',
        code: json?.code || 'VOTE_IP_LIMIT',
      }
    }

    // SPA HTML 200 등은 res.ok 여도 json.ok 가 없음 — 성공으로 치면 DB에 안 남음
    if (res.ok && json?.ok === true) {
      notifyTendencyVoteCast()
      return { ok: true }
    }
  } catch {
    // 네트워크·CORS·타임아웃 → 직접 insert
  }

  return voteDirect(matchupId, side, userId, { duplicateIsOk: true })
}

async function voteDirect(matchupId, side, userId, { duplicateIsOk = false } = {}) {
  const { error } = await supabase
    .from('votes')
    .insert({ user_id: userId, matchup_id: matchupId, side })
  if (error) {
    if (error.code === '23505') {
      if (duplicateIsOk) {
        notifyTendencyVoteCast()
        return { ok: true }
      }
      return { error: '이미 투표했어요' }
    }
    if (error.message?.includes('VOTE_IP_LIMIT')) {
      return { error: '이 기기/네트워크에서 해당 매치업에 대한 투표 한도를 초과했어요 (최대 3표)' }
    }
    return { error: error.message || '투표 중 오류가 발생했어요' }
  }
  notifyTendencyVoteCast()
  return { ok: true }
}
