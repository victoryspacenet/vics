import { supabase } from './supabase'
import { sanitizeText } from './sanitize'

/** 내 팬덤 등에서 응원 목록 갱신용 */
export const FANDOM_CHEER_POSTED = 'vics:fandom-cheer:posted'

/**
 * 동일 V-Card 리포트(owner)에 로그인 팬이 이미 응원했는지
 * @param {string | null | undefined} ownerUserId
 * @returns {Promise<boolean>}
 */
export async function fetchFanCheerAlreadySent(ownerUserId) {
  const owner = typeof ownerUserId === 'string' ? ownerUserId.trim() : ''
  if (!owner) return false

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id || user.id === owner) return false

  const { data, error } = await supabase
    .from('fandom_cheer_messages')
    .select('id')
    .eq('owner_user_id', owner)
    .eq('author_user_id', user.id)
    .maybeSingle()

  if (error) {
    if (import.meta.env.DEV) console.warn('[fandomCheer] fetchFanCheerAlreadySent', error.message)
    return false
  }
  return Boolean(data?.id)
}

/**
 * @param {string | null | undefined} ownerUserId 크리에이터(응원 받는 사람) 프로필 id
 * @param {string} bodyRaw
 * @returns {Promise<{ ok: true } | { ok: false, error: string, duplicate?: true }>}
 */
export async function submitFandomCheer(ownerUserId, bodyRaw) {
  const owner = typeof ownerUserId === 'string' ? ownerUserId.trim() : ''
  if (!owner) return { ok: false, error: '응원 대상을 찾을 수 없어요.' }

  const body = sanitizeText(String(bodyRaw ?? '').trim())
  if (!body) return { ok: false, error: '응원 메시지를 입력해 주세요.' }
  if (body.length > 50) return { ok: false, error: '최대 50자까지 입력할 수 있어요.' }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return { ok: false, error: '로그인이 필요해요.' }
  if (user.id === owner) return { ok: false, error: '본인에게는 응원 한마디를 남길 수 없어요.' }

  const { error } = await supabase.from('fandom_cheer_messages').insert({
    owner_user_id: owner,
    author_user_id: user.id,
    body,
  })
  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        duplicate: true,
        error: '이 V-Card에는 계정당 한 번만 응원을 보낼 수 있어요.',
      }
    }
    // FK: owner → profiles(구 스키마) 또는 owner/auth 불일치 시
    if (error.code === '23503' || /violates foreign key constraint/i.test(String(error.message))) {
      const detail = `${error.message ?? ''} ${error.details ?? ''}`
      if (/owner_user_id|owner_user_id_fkey/i.test(detail)) {
        return {
          ok: false,
          error:
            '응원 받는 분의 계정 정보가 아직 맞지 않아요. V-Card 링크(?owner=)를 확인해 주세요. 문제가 계속되면 운영팀에 문의해 주세요.',
        }
      }
      if (/author_user_id|author_user_id_fkey/i.test(detail)) {
        return {
          ok: false,
          error: '내 계정 프로필을 찾을 수 없어요. 로그아웃 후 다시 로그인하거나 고객센터로 문의해 주세요.',
        }
      }
    }
    const msg = error.message || '전송에 실패했어요.'
    if (import.meta.env.DEV) console.warn('[fandomCheer]', msg)
    return { ok: false, error: msg }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FANDOM_CHEER_POSTED, { detail: { ownerUserId: owner } }))
  }
  return { ok: true }
}
