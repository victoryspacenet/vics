/**
 * 이의 신청 검토 - 관리자용 (Supabase)
 * supabase_appeals.sql 을 먼저 실행해 테이블을 생성하세요.
 */
import { supabase } from './supabase'

export const APPEAL_STATUS = {
  pending:   'pending',   // 미처리
  completed: 'completed', // 답변 완료
}

export const SANCTION_TYPES = [
  { id: 'bad_language', label: '욕설/비하' },
  { id: 'abuse',        label: '어뷰징/매크로' },
  { id: 'spam',         label: '스팸/광고' },
  { id: 'etc',          label: '기타' },
]

/** supabase_seed_appeals.sql 가상 데이터 — 관리자 목록·집계에서 제외 */
export const DEMO_APPEAL_RECEIPT_IDS = Object.freeze([
  'VS-2026-001',
  'VS-2026-002',
  'VS-2026-003',
  'VS-2026-004',
  'VS-2026-005',
  'VS-2025-998',
  'VS-2025-997',
  'VS-2025-996',
])

const DEMO_APPEAL_RECEIPT_IN_FILTER = `(${DEMO_APPEAL_RECEIPT_IDS.map((id) => `"${id}"`).join(',')})`

function applyDemoAppealExclusion(q) {
  return q.not('receipt_id', 'in', DEMO_APPEAL_RECEIPT_IN_FILTER)
}

export function isDemoAppealRow(row) {
  if (!row) return false
  if (DEMO_APPEAL_RECEIPT_IDS.includes(String(row.receipt_id || row.receiptId || '').trim())) {
    return true
  }
  return /^user_\d+$/i.test(String(row.user_id || row.userId || '').trim())
}

const DEFAULT_TEMPLATES = [
  {
    id: 'approve',
    name: '승인 시',
    body: '소명하신 내용을 검토한 결과, 정상 참작 가능한 사유로 확인되어 제재를 해제하였습니다. 앞으로도 건전한 커뮤니티 이용 부탁드립니다.',
  },
  {
    id: 'reject',
    name: '기각 시',
    body: '소명하신 내용을 검토하였으나, 제재 사유가 명확하여 기존 처분을 유지합니다. 커뮤니티 가이드라인 준수 부탁드립니다.',
  },
  {
    id: 'request_evidence',
    name: '추가 자료 요청 시',
    body: '소명을 검토하였습니다. 결정을 위해 아래 자료를 첨부해 주시기 바랍니다.\n· (요청할 자료 명시)\n추가 제출은 접수일로부터 7일 이내만 가능합니다.',
  },
]

/** DB row → 컴포넌트 형태로 변환 */
function normalizeAppeal(row) {
  return {
    id:               row.id,
    receiptId:        row.receipt_id,
    status:           row.status,
    nickname:         row.nickname,
    userId:           row.user_id,
    sanctionType:     row.sanction_type,
    sanctionTypeLabel: row.sanction_type_label,
    sanctionDate:     row.sanction_date,
    violationReason:  row.violation_reason,
    originalContent:  row.original_content,
    originalType:     row.original_type,
    appealTitle:      row.appeal_title,
    appealContent:    row.appeal_content,
    attachments:      row.attachments ?? [],
    sanctionWarningId: row.sanction_warning_id ?? null,
    decision:         row.decision ?? null,
    replyToUser:      row.reply_to_user ?? '',
    reducedDays:      row.reduced_days ?? null,
    sanctionEndAt:    row.sanction_end_at ?? null,
    notifiedAt:       row.notified_at ?? null,
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
  }
}

/** 목록/통계용 컬럼만 (select * 대역폭·파싱 부담 감소) */
const APPEAL_LIST_FIELDS =
  'id, receipt_id, status, nickname, user_id, sanction_type, sanction_type_label, sanction_date, violation_reason, original_content, original_type, appeal_title, appeal_content, attachments, sanction_warning_id, decision, reply_to_user, reduced_days, sanction_end_at, notified_at, created_at, updated_at'

function escapeIlikePattern(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
}

/** PostgREST `or()` 안에 넣을 ilike 패턴 (따옴표 이스케이프) */
function ilikePatternQuotedForOr(trimmed) {
  const inner = `%${escapeIlikePattern(trimmed)}%`.replace(/"/g, '""')
  return `"${inner}"`
}

/** 접수일 필터 — `created_at >=` 기준 ISO 시각 */
function createdAtLowerBound(dateRange) {
  if (!dateRange || dateRange === 'all') return null
  const days = { '1w': 7, '2w': 14, '1m': 30 }[dateRange]
  if (!days) return null
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function notifyAppealsUpdated() {
  window.dispatchEvent(new CustomEvent('vics:adminAppeals:updated'))
}

/**
 * 미처리/완료 건수 (전체 테이블 기준, 필터와 무관)
 */
export async function getAdminAppealTotals() {
  try {
    const [pendingRes, completedRes] = await Promise.all([
      applyDemoAppealExclusion(
        supabase.from('appeals').select('id', { count: 'exact', head: true }).eq('status', APPEAL_STATUS.pending),
      ),
      applyDemoAppealExclusion(
        supabase.from('appeals').select('id', { count: 'exact', head: true }).eq('status', APPEAL_STATUS.completed),
      ),
    ])
    if (pendingRes.error) throw pendingRes.error
    if (completedRes.error) throw completedRes.error
    return {
      pending: typeof pendingRes.count === 'number' ? pendingRes.count : 0,
      completed: typeof completedRes.count === 'number' ? completedRes.count : 0,
    }
  } catch (e) {
    console.warn('[appealAdminStorage] 건수 조회 실패:', e)
    return { pending: 0, completed: 0 }
  }
}

/**
 * 이의 목록 — 서버 페이징 + count (필터는 DB에서 적용)
 * @param {{ page?: number; pageSize?: number; sanctionType?: string; dateRange?: string; search?: string }} opts
 * - `dateRange`: `'all'` | `'1w'` | `'2w'` | `'1m'`
 * - `sanctionType`: 빈 문자열이면 전체
 */
export async function getAdminAppealsPaged({
  page = 1,
  pageSize = 10,
  sanctionType = '',
  dateRange = 'all',
  search = '',
} = {}) {
  const safeSize = Math.min(100, Math.max(1, pageSize))
  const safePage = Math.max(1, page)
  const from = (safePage - 1) * safeSize
  const to = from + safeSize - 1

  try {
    let q = applyDemoAppealExclusion(
      supabase
        .from('appeals')
        .select(APPEAL_LIST_FIELDS, { count: 'exact' })
        .order('created_at', { ascending: false }),
    )

    if (sanctionType) {
      q = q.eq('sanction_type', sanctionType)
    }
    const since = createdAtLowerBound(dateRange)
    if (since) {
      q = q.gte('created_at', since)
    }

    const rawSearch = String(search || '').replace(/,/g, '').trim().slice(0, 80)
    if (rawSearch) {
      const quoted = ilikePatternQuotedForOr(rawSearch)
      q = q.or(`receipt_id.ilike.${quoted},nickname.ilike.${quoted}`)
    }

    const { data, error, count } = await q.range(from, to)
    if (error) throw error
    return {
      appeals: (data ?? []).filter((row) => !isDemoAppealRow(row)).map(normalizeAppeal),
      totalCount: typeof count === 'number' ? count : 0,
    }
  } catch (e) {
    console.warn('[appealAdminStorage] 페이징 목록 조회 실패:', e)
    return { appeals: [], totalCount: 0 }
  }
}

/**
 * @deprecated 대량 로드 — `getAdminAppealsPaged` 사용
 * 호환용: 필터 없이 최대 300건
 */
export async function getAdminAppeals() {
  const { appeals } = await getAdminAppealsPaged({ page: 1, pageSize: 300, sanctionType: '', dateRange: 'all', search: '' })
  return appeals
}

/** 단건 조회 */
export async function getAdminAppealById(id) {
  try {
    const { data, error } = await supabase
      .from('appeals')
      .select(APPEAL_LIST_FIELDS)
      .or(`id.eq.${id},receipt_id.eq.${id}`)
      .single()
    if (error) throw error
    if (!data || isDemoAppealRow(data)) return null
    return normalizeAppeal(data)
  } catch (e) {
    console.warn('[appealAdminStorage] 단건 조회 실패:', e)
    return null
  }
}

/** 이의 신청 수정 (관리자 검토 처리) */
export async function updateAdminAppeal(id, updates) {
  const patch = {}
  if (updates.status         !== undefined) patch.status          = updates.status
  if (updates.decision       !== undefined) patch.decision        = updates.decision
  if (updates.replyToUser    !== undefined) patch.reply_to_user   = updates.replyToUser
  if (updates.reducedDays    !== undefined) patch.reduced_days    = updates.reducedDays
  if (updates.sanctionEndAt  !== undefined) patch.sanction_end_at = updates.sanctionEndAt
  if (updates.notifiedAt     !== undefined) patch.notified_at     = updates.notifiedAt
  patch.updated_at = new Date().toISOString()

  try {
    const { data, error } = await supabase
      .from('appeals')
      .update(patch)
      .or(`id.eq.${id},receipt_id.eq.${id}`)
      .select()
      .single()
    if (error) throw error
    notifyAppealsUpdated()
    return normalizeAppeal(data)
  } catch (e) {
    console.warn('[appealAdminStorage] 수정 실패:', e)
    return null
  }
}

/** 통계 — 이미 불러온 목록이 있으면 재쿼리하지 않음 */
export function computeAppealStats(list) {
  const arr = Array.isArray(list) ? list : []
  return {
    pending: arr.filter((a) => a.status === APPEAL_STATUS.pending).length,
    completed: arr.filter((a) => a.status === APPEAL_STATUS.completed).length,
  }
}

/** 서버 건수 기반 통계 (목록 전체 로드 없음) */
export async function getAppealStats() {
  return getAdminAppealTotals()
}

/** 답변 템플릿 목록 (변경 불필요 — JS 상수) */
export function getAppealTemplates() {
  return DEFAULT_TEMPLATES
}

/** 템플릿 본문 조회 */
export function getTemplateBody(templateId, nickname = '회원') {
  const t = DEFAULT_TEMPLATES.find((x) => x.id === templateId)
  if (!t) return ''
  return (t.body || '').replace(/\{nickname\}/g, nickname)
}
