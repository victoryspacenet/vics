import { supabase } from './supabase'
import { SEED_OPERATOR_IDS, getPermissionPreset } from './operatorAdminStorage'

const OP_SELECT = 'id, name, email, granular, status, is_seed, permission'

/** GNB·/admin 접근 판별용 — 목록에서 숨기는 데모(@vsmatch.com 등)와 분리 */
export function isSeedOperatorForAccess(row) {
  if (!row) return false
  if (row.is_seed === true) return true
  return SEED_OPERATOR_IDS.includes(String(row.id || '').trim())
}

async function queryOperatorByEmail(email) {
  const key = String(email || '').trim().toLowerCase()
  if (!key) return { row: null, error: null }
  const { data, error } = await supabase
    .from('admin_operators')
    .select(OP_SELECT)
    .eq('email', key)
    .maybeSingle()
  if (error) return { row: null, error }
  return { row: data, error: null }
}

async function queryOperatorByName(name) {
  const nick = String(name || '').trim()
  if (!nick) return { row: null, error: null }
  const { data, error } = await supabase
    .from('admin_operators')
    .select(OP_SELECT)
    .eq('name', nick)
    .maybeSingle()
  if (error) return { row: null, error }
  if (data) return { row: data, error: null }
  const ilike = await supabase
    .from('admin_operators')
    .select(OP_SELECT)
    .ilike('name', nick)
    .maybeSingle()
  if (ilike.error) return { row: null, error: ilike.error }
  return { row: ilike.data, error: null }
}

/**
 * 로그인 세션 → admin_operators 행 (auth 이메일 · profiles.email · 운영자 name=닉네임 순)
 * @param {import('@supabase/supabase-js').User | null} user
 */
export async function fetchAdminOperatorForUser(user) {
  if (!user?.id) return { row: null, error: null }

  const authEmail = user.email?.trim().toLowerCase() || ''

  const attempts = []
  if (authEmail) attempts.push(() => queryOperatorByEmail(authEmail))

  const { data: prof, error: profErr } = await supabase
    .from('profiles')
    .select('email, nickname')
    .eq('id', user.id)
    .maybeSingle()

  if (profErr) return { row: null, error: profErr }

  const profileEmail = prof?.email?.trim().toLowerCase() || ''
  if (profileEmail && profileEmail !== authEmail) {
    attempts.push(() => queryOperatorByEmail(profileEmail))
  }
  if (prof?.nickname?.trim()) {
    const nick = prof.nickname.trim()
    attempts.push(() => queryOperatorByName(nick))
  }

  let lastError = null
  for (const run of attempts) {
    const { row, error } = await run()
    if (error) {
      lastError = error
      continue
    }
    if (row && !isSeedOperatorForAccess(row)) {
      return { row, error: null }
    }
  }

  return { row: null, error: lastError }
}

/** Master 등 프리셋 — granular JSON이 비어 있을 때 메뉴 권한 복구 */
export function resolveOperatorGranular(row) {
  const raw = row?.granular
  const parsed =
    typeof raw === 'string'
      ? (() => {
          try {
            return JSON.parse(raw)
          } catch {
            return {}
          }
        })()
      : raw
  const hasAny =
    parsed &&
    typeof parsed === 'object' &&
    Object.values(parsed).some((m) => m && typeof m === 'object' && Object.values(m).some(Boolean))
  if (hasAny) return parsed
  const preset = getPermissionPreset(row?.permission)
  if (preset) return preset
  return {}
}
