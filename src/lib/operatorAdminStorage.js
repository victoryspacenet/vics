/**
 * 운영자 계정 관리 — Supabase 기반 스토리지
 */

import { supabase } from './supabase'

export const DEPARTMENTS = ['운영팀', '콘텐츠팀', 'CS팀', '개발팀', '마케팅팀']

/** supabase_admin_operators.sql 시드(목) 계정 ID — is_seed 미설정 행 대비 */
export const SEED_OPERATOR_IDS = [
  'admin_01', 'contents_2', 'cs_team_a', 'dev_test', 'admin_02', 'marketing_1',
  'ops_team_1', 'cs_team_b', 'design_1', 'data_1', 'temp_worker', 'legacy_admin',
]

/** 시드(목) 운영자 표시 이름 */
export const SEED_OPERATOR_NAMES = [
  '김운영', '이관리', '박상담', '최개발', '강수석', '정홍보', '한운영',
  '조상담', '윤디자인', '송데이터', '임계약', '구관리',
]

const SEED_EMAIL_SUFFIX = '@vsmatch.com'

/** 최근 이 시간 안에 last_access_at 이 갱신되면 「접속 중」 */
export const OPERATOR_ONLINE_WINDOW_MS = 30 * 60 * 1000

export function isDemoOperatorRow(row) {
  if (!row) return false
  if (row.is_seed === true) return true
  const id = String(row.id || '').trim()
  if (SEED_OPERATOR_IDS.includes(id)) return true
  const email = String(row.email || '').trim().toLowerCase()
  if (email.endsWith(SEED_EMAIL_SUFFIX)) return true
  const name = String(row.name || '').trim()
  if (SEED_OPERATOR_NAMES.includes(name)) return true
  return false
}

function filterRealOperators(rows) {
  return (rows || []).filter((r) => !isDemoOperatorRow(r))
}

/** supabase_admin_operators.sql 시드(목) 계정 — 목록·상세·접속 갱신에서 제외 */
function nonSeedOperatorQuery(q) {
  return q.eq('is_seed', false).not('id', 'in', `(${SEED_OPERATOR_IDS.join(',')})`)
}

export function isOperatorOnlineNow(op) {
  if (!op || op.status !== 'active' || !op.lastAccessAt) return false
  const ts = new Date(op.lastAccessAt).getTime()
  return Number.isFinite(ts) && Date.now() - ts < OPERATOR_ONLINE_WINDOW_MS
}

const PERMISSION_PRESETS = {
  Master:    { dashboard: { r: true,  w: true,  d: true,  e: true  }, matchups: { r: true,  w: true,  d: true,  e: true  }, users: { r: true,  w: true,  d: true,  e: true  }, settings: { r: true,  w: true,  d: true,  e: true  } },
  Editor:    { dashboard: { r: true,  w: false, d: false, e: false }, matchups: { r: true,  w: true,  d: true,  e: true  }, users: { r: true,  w: true,  d: false, e: false }, settings: { r: false, w: false, d: false, e: false } },
  CS_Viewer: { dashboard: { r: true,  w: false, d: false, e: false }, matchups: { r: true,  w: false, d: false, e: false }, users: { r: true,  w: false, d: false, e: false }, settings: { r: false, w: false, d: false, e: false } },
  Custom:    null,
}

/** 마지막 접속 터치 스로틀 (동일 이메일 5분) */
const touchThrottleMs = 5 * 60 * 1000
const lastTouchByEmail = new Map()

export function getPermissionPreset(role) {
  return PERMISSION_PRESETS[role] ? JSON.parse(JSON.stringify(PERMISSION_PRESETS[role])) : null
}

function normalize(row) {
  return {
    id:            row.id,
    name:          row.name,
    department:    row.department,
    email:         row.email,
    status:        row.status,
    lastAccess:    row.last_access,
    lastAccessIp:  row.last_access_ip,
    lastAccessAt:  row.last_access_at,
    otpEnabled:    row.otp_enabled,
    permission:    row.permission,
    granular:      typeof row.granular === 'string' ? JSON.parse(row.granular) : row.granular,
    createdAt:     row.created_at,
  }
}

function granularEqual(a, b) {
  try {
    return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {})
  } catch {
    return false
  }
}

async function insertSecurityLogRow({ action, targetId, targetName, actorLabel, detail }) {
  const { error } = await supabase.from('admin_operator_security_log').insert({
    action,
    target_operator_id: targetId ?? null,
    target_operator_name: targetName ?? null,
    actor_label: actorLabel || '',
    detail: detail && typeof detail === 'object' ? detail : {},
  })
  if (error) console.error('[operatorAdminStorage] security log:', error.message)
}

async function runIdle90dSuspend() {
  try {
    const { error } = await supabase.rpc('suspend_operators_idle_90d')
    if (error) console.warn('[operatorAdminStorage] suspend_operators_idle_90d:', error.message)
  } catch (e) {
    console.warn('[operatorAdminStorage] suspend_operators_idle_90d:', e)
  }
}

/** 로그인 이메일과 일치하는 운영자 행의 마지막 접속 갱신 (관리자 레이아웃에서 호출) */
export async function touchOperatorLastAccessByEmail(email, ipHint = '-') {
  if (!email || typeof email !== 'string') return
  const key = email.trim().toLowerCase()
  if (!key) return
  const t = lastTouchByEmail.get(key) || 0
  if (Date.now() - t < touchThrottleMs) return

  const { data: rows, error: selErr } = await nonSeedOperatorQuery(
    supabase.from('admin_operators').select('id').eq('email', key),
  )
  if (selErr || !rows?.length) return

  const now = new Date()
  const lastAccess = now.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })

  for (const row of rows) {
    const { error: upErr } = await supabase
      .from('admin_operators')
      .update({
        last_access: lastAccess,
        last_access_at: now.toISOString(),
        last_access_ip: ipHint,
      })
      .eq('id', row.id)
    if (upErr) {
      console.warn('[operatorAdminStorage] touch last access:', upErr.message)
      return
    }
  }
  lastTouchByEmail.set(key, Date.now())
}

/** 보안 로그 목록 */
export async function getOperatorSecurityLogs({ limit = 150 } = {}) {
  await runIdle90dSuspend()
  const { data, error } = await supabase
    .from('admin_operator_security_log')
    .select('id, created_at, action, target_operator_id, target_operator_name, actor_label, detail')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[operatorAdminStorage] getOperatorSecurityLogs:', error.message)
    return []
  }
  return (data || []).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    action: r.action,
    targetOperatorId: r.target_operator_id,
    targetOperatorName: r.target_operator_name,
    actorLabel: r.actor_label,
    detail: r.detail && typeof r.detail === 'object' ? r.detail : {},
  }))
}

/** 전체 목록 (목록 페이지용) — 호출 시 90일 미접속 정지 정책 적용 */
export async function getOperatorsList() {
  await runIdle90dSuspend()
  const { data, error } = await supabase
    .from('admin_operators')
    .select('id, name, email, permission, last_access, last_access_at, status, is_seed')
    .order('created_at', { ascending: true })
  if (error) { console.error(error); return [] }
  return filterRealOperators(data).map((row) => ({
    id:           row.id,
    name:         row.name,
    permission:   row.permission,
    lastAccess:   row.last_access,
    lastAccessAt: row.last_access_at,
    status:       row.status,
  }))
}

/** 단건 상세 조회 */
export async function getOperatorDetail(id) {
  if (!id) return null
  const { data, error } = await supabase
    .from('admin_operators')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error || !data || isDemoOperatorRow(data)) return null
  return normalize(data)
}

/** 신규 등록 — DB에 `last_access_at` 컬럼이 없는 환경과 호환되도록 해당 필드는 넣지 않습니다. */
export async function addOperator(form) {
  const id = (form.id || '').trim()
  const name = (form.name || '').trim()
  const department = form.department ?? ''
  const email = (form.email || '').trim().toLowerCase()
  const status = form.status === 'suspended' ? 'suspended' : 'active'
  const otpEnabled = Boolean(form.otpEnabled)
  const permission = form.permission || 'Editor'
  let granular = form.granular
  try {
    granular = JSON.parse(JSON.stringify(form.granular ?? {}))
  } catch {
    granular = {}
  }

  const { error } = await supabase.from('admin_operators').insert({
    id,
    name,
    department,
    email,
    status,
    otp_enabled: otpEnabled,
    permission,
    granular,
    is_seed: false,
    last_access: '미접속',
    last_access_ip: '-',
  })
  if (error) {
    console.error('[operatorAdminStorage] addOperator:', error.message, error)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/** 정보 수정 (권한·상태·세부 권한 변경 시 보안 로그) */
export async function updateOperator(id, form, meta = {}) {
  const prev = await getOperatorDetail(id)
  if (!prev) return false

  const { error } = await supabase
    .from('admin_operators')
    .update({
      name:        form.name,
      department:  form.department,
      email:       (form.email || '').trim().toLowerCase(),
      status:      form.status,
      otp_enabled: form.otpEnabled,
      permission:  form.permission,
      granular:    form.granular,
    })
    .eq('id', id)
  if (error) { console.error(error); return false }

  const actorLabel = meta.actorLabel
  const permChanged =
    prev.permission !== form.permission ||
    prev.status !== form.status ||
    !granularEqual(prev.granular, form.granular)

  if (actorLabel && permChanged) {
    await insertSecurityLogRow({
      action: 'permission_change',
      targetId: id,
      targetName: prev.name,
      actorLabel,
      detail: {
        before: { permission: prev.permission, status: prev.status },
        after: { permission: form.permission, status: form.status },
        granularChanged: !granularEqual(prev.granular, form.granular),
      },
    })
  }
  return true
}

/** 삭제 (성공 시 보안 로그) */
export async function deleteOperator(id, meta = {}) {
  if (!id) return false
  const prev = await getOperatorDetail(id)
  if (!prev) return false

  const { error } = await supabase
    .from('admin_operators')
    .delete()
    .eq('id', id)
  if (error) { console.error(error); return false }

  const actorLabel = meta.actorLabel
  if (actorLabel) {
    await insertSecurityLogRow({
      action: 'delete',
      targetId: id,
      targetName: prev.name,
      actorLabel,
      detail: { email: prev.email, permission: prev.permission },
    })
  }
  return true
}
