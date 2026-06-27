import { supabase } from './supabase'
import {
  computeTendencyReport,
  TENDENCY_REPORT_VOTE_THRESHOLD,
} from './tendencyReportAnalysis'

export { TENDENCY_REPORT_VOTE_THRESHOLD, TENDENCY_TYPES, computeTendencyReport } from './tendencyReportAnalysis'

export const TENDENCY_VOTE_CAST = 'vics:tendency-vote-cast'
export const TENDENCY_REPORT_ACKED = 'vics:tendency-report:acked'

const VOTES_FOR_REPORT_SELECT = `
  side,
  created_at,
  matchups (
    id,
    title,
    category,
    tags,
    left_votes,
    right_votes,
    total_votes,
    winner,
    left_label,
    right_label
  )
`

function parseRpcJson(raw) {
  if (raw == null) return null
  if (typeof raw === 'object') return raw
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  return null
}

/**
 * @returns {Promise<{ voteCount: number, eligible: boolean, acknowledged: boolean, snapshot?: object, tendencyType?: string }>}
 */
export async function fetchTendencyReportStatus() {
  const { data: raw, error } = await supabase.rpc('get_user_tendency_report_status')
  if (error) {
    if (import.meta.env.DEV) console.warn('[tendencyReport] status rpc:', error.message)
    return fetchTendencyReportStatusFallback()
  }
  const data = parseRpcJson(raw)
  if (!data?.ok) return fetchTendencyReportStatusFallback()
  return {
    voteCount: Number(data.vote_count || 0),
    eligible: Boolean(data.eligible),
    acknowledged: Boolean(data.acknowledged),
    tendencyType: data.tendency_type || null,
    snapshot: data.report_snapshot || null,
  }
}

async function fetchTendencyReportStatusFallback() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) {
    return { voteCount: 0, eligible: false, acknowledged: false }
  }

  const [countRes, ackRes] = await Promise.all([
    supabase.from('votes').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase
      .from('user_tendency_report_ack')
      .select('tendency_type, report_snapshot')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  const voteCount = countRes.count ?? 0
  const ack = ackRes.data

  return {
    voteCount,
    eligible: voteCount >= TENDENCY_REPORT_VOTE_THRESHOLD,
    acknowledged: Boolean(ack),
    tendencyType: ack?.tendency_type || null,
    snapshot: ack?.report_snapshot || null,
  }
}

/**
 * @param {string} userId
 * @param {string} [nickname]
 */
export async function buildTendencyReportForUser(userId, nickname) {
  if (!userId) return { report: null, error: '로그인이 필요해요' }

  const { data, error } = await supabase
    .from('votes')
    .select(VOTES_FOR_REPORT_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(TENDENCY_REPORT_VOTE_THRESHOLD)

  if (error) {
    return { report: null, error: error.message || '투표 기록을 불러오지 못했어요' }
  }

  const report = computeTendencyReport(data || [], { nickname })
  return { report, error: null }
}

/**
 * @param {object} report — computeTendencyReport 결과
 */
export async function ackTendencyReport(report) {
  if (!report?.tendencyType) {
    return { ok: false, error: '리포트 데이터가 없어요' }
  }

  const { data: raw, error } = await supabase.rpc('ack_user_tendency_report', {
    p_tendency_type: report.tendencyType,
    p_snapshot: report,
  })

  if (error) {
    if (import.meta.env.DEV) console.warn('[tendencyReport] ack rpc:', error.message)
    return ackTendencyReportFallback(report)
  }

  const data = parseRpcJson(raw)
  if (data?.ok === false) {
    return { ok: false, error: typeof data.error === 'string' ? data.error : '저장에 실패했어요' }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TENDENCY_REPORT_ACKED, { detail: { report } }))
  }
  return { ok: true }
}

async function ackTendencyReportFallback(report) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return { ok: false, error: '로그인이 필요해요' }

  const { count } = await supabase
    .from('votes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count ?? 0) < TENDENCY_REPORT_VOTE_THRESHOLD) {
    return { ok: false, error: '아직 10회 투표에 도달하지 않았어요' }
  }

  const { error } = await supabase.from('user_tendency_report_ack').insert({
    user_id: user.id,
    vote_count_at_unlock: count,
    tendency_type: report.tendencyType,
    report_snapshot: report,
  })

  if (error) {
    if (error.code === '23505') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(TENDENCY_REPORT_ACKED, { detail: { report } }))
      }
      return { ok: true, already: true }
    }
    return { ok: false, error: error.message || '저장에 실패했어요' }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TENDENCY_REPORT_ACKED, { detail: { report } }))
  }
  return { ok: true }
}

export function notifyTendencyVoteCast() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(TENDENCY_VOTE_CAST))
}
