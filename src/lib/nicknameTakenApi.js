import { supabase } from './supabase'
import { resolveSiteUrl } from './siteApiBase'

/**
 * PostgREST RPC 가 boolean 을 JSON 그대로 주지 않는 환경 대비
 * @param {unknown} v
 * @returns {boolean | null} 확정 가능할 때만 boolean, 아니면 null
 */
function coerceRpcBoolean(v) {
  if (v === true || v === false) return v
  if (v === 1 || v === 0) return v === 1
  if (v === 't' || v === 'true') return true
  if (v === 'f' || v === 'false') return false
  return null
}

/**
 * Netlify Functions(서비스 롤)로 중복 확인 — `npm run dev:netlify`·배포 URL에서 동작
 * @param {string} nick - trim 된 닉네임
 * @returns {Promise<{ taken: boolean, error: null } | null>} 성공 시 결과, 호출 불가·실패 시 null
 */
async function checkNicknameTakenViaSiteApi(nick) {
  try {
    const url = resolveSiteUrl('/api/nickname-check')
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: nick }),
    })
    if (!res.ok) return null
    const j = await res.json().catch(() => ({}))
    if (typeof j.taken === 'boolean') return { taken: j.taken, error: null }
  } catch {
    /* Vite 단독(5173) 등에서 /api 미구현 → 무시 */
  }
  return null
}

/**
 * 닉네임이 이미 사용 중인지 확인합니다.
 *
 * 우선순위:
 * 1) `/api/nickname-check` (서비스 롤) — Netlify dev / 프로덕션
 * 2) `nickname_is_taken` RPC (RLS 우회, Supabase SQL 적용 시)
 * 3) `profiles` 직접 조회 (RLS 허용 시에만 정확)
 *
 * @param {string} nickname - trim 전/후 모두 허용 (내부에서 trim)
 * @returns {Promise<{ taken: boolean, error: import('@supabase/supabase-js').PostgrestError | null }>}
 */
export async function checkNicknameTaken(nickname) {
  const nick = String(nickname ?? '').trim()
  if (!nick) return { taken: false, error: null }

  const viaApi = await checkNicknameTakenViaSiteApi(nick)
  if (viaApi) return viaApi

  const rpcRes = await supabase.rpc('nickname_is_taken', { p_nickname: nick })
  const rpcBool = coerceRpcBoolean(rpcRes.data)
  if (!rpcRes.error && rpcBool !== null) {
    return { taken: rpcBool, error: null }
  }

  const { data, error } = await supabase.from('profiles').select('id').eq('nickname', nick).maybeSingle()
  if (error) return { taken: false, error }
  return { taken: !!data, error: null }
}
