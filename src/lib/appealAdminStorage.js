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
    decision:         row.decision ?? null,
    replyToUser:      row.reply_to_user ?? '',
    reducedDays:      row.reduced_days ?? null,
    sanctionEndAt:    row.sanction_end_at ?? null,
    notifiedAt:       row.notified_at ?? null,
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
  }
}

/** 이의 신청 목록 조회 */
export async function getAdminAppeals() {
  try {
    const { data, error } = await supabase
      .from('appeals')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(normalizeAppeal)
  } catch (e) {
    console.warn('[appealAdminStorage] 목록 조회 실패:', e)
    return []
  }
}

/** 단건 조회 */
export async function getAdminAppealById(id) {
  try {
    const { data, error } = await supabase
      .from('appeals')
      .select('*')
      .or(`id.eq.${id},receipt_id.eq.${id}`)
      .single()
    if (error) throw error
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
    return normalizeAppeal(data)
  } catch (e) {
    console.warn('[appealAdminStorage] 수정 실패:', e)
    return null
  }
}

/** 통계 (목록에서 계산) */
export async function getAppealStats() {
  try {
    const list = await getAdminAppeals()
    return {
      pending:   list.filter((a) => a.status === APPEAL_STATUS.pending).length,
      completed: list.filter((a) => a.status === APPEAL_STATUS.completed).length,
    }
  } catch {
    return { pending: 0, completed: 0 }
  }
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
