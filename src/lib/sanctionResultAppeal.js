/**
 * 제재(경고) 결과 이의 — 경고 발부 후 24시간, 경고당 1회 (DB 트리거·유니크와 동기 UI)
 */
import { supabase } from './supabase'

const WINDOW_MS = 24 * 60 * 60 * 1000

export function getSanctionAppealDeadlineMs(warningCreatedAtIso) {
  if (!warningCreatedAtIso) return null
  const t = new Date(warningCreatedAtIso).getTime()
  if (!Number.isFinite(t)) return null
  return t + WINDOW_MS
}

/**
 * @param {string|null} warningCreatedAtIso
 * @param {boolean} hasExistingAppeal 해당 경고로 이미 이의 접수 여부
 */
export function getSanctionAppealUiState(warningCreatedAtIso, hasExistingAppeal) {
  const deadlineMs = getSanctionAppealDeadlineMs(warningCreatedAtIso)
  if (deadlineMs == null) {
    return { canSubmit: false, reason: 'no_warning', deadlineMs: null }
  }
  const now = Date.now()
  if (now > deadlineMs) {
    return { canSubmit: false, reason: 'window_closed', deadlineMs }
  }
  if (hasExistingAppeal) {
    return { canSubmit: false, reason: 'already_submitted', deadlineMs }
  }
  return { canSubmit: true, reason: null, deadlineMs }
}

export async function userHasSanctionAppealForWarning(warningId, userId) {
  if (!warningId || !userId) return false
  const { count, error } = await supabase
    .from('appeals')
    .select('id', { count: 'exact', head: true })
    .eq('sanction_warning_id', warningId)
    .eq('user_id', userId)
    .eq('appeal_kind', 'sanction')
  if (error) {
    console.warn('[sanctionResultAppeal] count:', error.message)
    return false
  }
  return (count || 0) > 0
}

/** URL에 경고 id가 없을 때: 아직 이의 없고 24h 창 안인 가장 최근 경고 */
export async function getLatestAppealableSanctionWarning(userId) {
  if (!userId) return null
  const { data: rows, error } = await supabase
    .from('user_moderation_warnings')
    .select('id, created_at, payload')
    .eq('subject_user_id', String(userId))
    .order('created_at', { ascending: false })
    .limit(8)
  if (error || !rows?.length) return null

  const now = Date.now()
  for (const row of rows) {
    const start = new Date(row.created_at).getTime()
    if (!Number.isFinite(start)) continue
    if (now > start + WINDOW_MS) continue
    const dup = await userHasSanctionAppealForWarning(row.id, userId)
    if (dup) continue
    return {
      id: row.id,
      createdAt: row.created_at,
      payload: row.payload && typeof row.payload === 'object' ? row.payload : {},
    }
  }
  return null
}

export async function fetchSanctionWarningForAppeal(warningId, userId) {
  if (!warningId || !userId) return null
  const { data, error } = await supabase
    .from('user_moderation_warnings')
    .select('id, subject_user_id, created_at, payload')
    .eq('id', warningId)
    .maybeSingle()
  if (error || !data) return null
  if (String(data.subject_user_id) !== String(userId)) return null
  return {
    id: data.id,
    createdAt: data.created_at,
    payload: data.payload && typeof data.payload === 'object' ? data.payload : {},
  }
}

export function mapSanctionAppealInsertError(error) {
  const msg = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`
  const code = error?.code || ''
  if (code === '23505' || msg.includes('appeals_one_sanction_per_warning')) {
    return '이 제재에 대한 이의는 이미 1회 제출되었어요.'
  }
  if (msg.includes('APPEAL_WINDOW_CLOSED')) {
    return '제재 통보 후 24시간이 지나 이의 신청을 할 수 없어요.'
  }
  if (msg.includes('SANCTION_WARNING_REQUIRED')) {
    return '이의 대상 제재를 찾을 수 없어요. 이용 제한 안내에서 다시 시도해 주세요.'
  }
  if (msg.includes('SANCTION_WARNING_NOT_FOUND') || msg.includes('SANCTION_WARNING_WRONG_USER')) {
    return '이의를 제출할 수 있는 제재 내역이 아니에요.'
  }
  if (msg.includes('APPEAL_FORBIDDEN_USER')) {
    return '본인 명의로만 신청할 수 있어요.'
  }
  return error?.message || '저장에 실패했어요.'
}
