/**
 * 관리자 대시보드 — 긴급 모니터링 큐 (`matchup_moderation_alerts`)
 */
import { supabase } from './supabase'

export const MODERATION_ALERT_UPDATED = 'vics:adminModeration:updated'

export function dispatchModerationAlertsUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MODERATION_ALERT_UPDATED))
  }
}

/** UI 유사도 컬럼 — 낮을수록 긴급(부적절 AI는 확신도를 반전 표시) */
export function formatMonitoringScoreLabel(alert) {
  if (!alert) return '-'
  if (alert.alert_kind === 'inappropriate_ai') {
    const conf = Math.max(0, Math.min(100, Number(alert.ai_confidence) || 0))
    const display = Math.max(0, 100 - conf)
    const icon = conf >= 55 ? '🚨' : '⚠️'
    return `${String(display).padStart(2, '0')}% ${icon}`
  }
  const sim = Math.max(0, Math.min(100, Number(alert.similarity_score) || 0))
  const icon = sim < 15 ? '🚨' : '⚠️'
  return `${String(sim).padStart(2, '0')}% ${icon}`
}

export function getMonitoringStatusUi(alert) {
  if (alert?.auto_actioned || alert?.autoActioned) {
    return { label: '즉시차단', color: 'bg-red-100 text-red-700' }
  }
  return { label: '검토대기', color: 'bg-amber-100 text-amber-700' }
}

function mapRow(row) {
  const m = row.matchups || {}
  return {
    id: row.id,
    matchupId: row.matchup_id,
    alertKind: row.alert_kind,
    similarityScore: row.similarity_score,
    aiConfidence: row.ai_confidence,
    aiReasonKo: row.ai_reason_ko,
    rightReportCount: row.right_report_count ?? 0,
    autoActioned: !!row.auto_actioned,
    category: m.category_label || m.category || '-',
    title: m.title || '',
    createdAt: row.created_at,
    similarityLabel: formatMonitoringScoreLabel(row),
    statusUi: getMonitoringStatusUi(row),
  }
}

/**
 * @returns {{ rows: object[]; totalCount: number }}
 */
export async function fetchPendingModerationAlerts({ page = 1, pageSize = 10 } = {}) {
  const size = Math.min(50, Math.max(1, pageSize))
  const p = Math.max(1, page)
  const from = (p - 1) * size
  const to = from + size - 1

  const { data, error, count } = await supabase
    .from('matchup_moderation_alerts')
    .select(
      `id, matchup_id, alert_kind, similarity_score, ai_confidence, ai_reason_ko,
       right_report_count, auto_actioned, created_at,
       matchups:matchup_id ( id, title, category, category_label )`,
      { count: 'exact' },
    )
    .is('resolution', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.warn('[matchupModerationAlerts] fetch', error.message)
    return { rows: [], totalCount: 0 }
  }

  return {
    rows: (data || []).map(mapRow),
    totalCount: typeof count === 'number' ? count : 0,
  }
}

export async function countPendingModerationAlerts() {
  const { count, error } = await supabase
    .from('matchup_moderation_alerts')
    .select('id', { count: 'exact', head: true })
    .is('resolution', null)

  if (error) {
    console.warn('[matchupModerationAlerts] count', error.message)
    return 0
  }
  return count ?? 0
}

/**
 * @param {'keep'|'block'|'delete'} action
 */
export async function resolveModerationAlert(alertId, action) {
  const { data, error } = await supabase.rpc('resolve_matchup_moderation_alert', {
    p_alert_id: alertId,
    p_action: action,
  })

  if (error) {
    console.warn('[matchupModerationAlerts] resolve', error.message)
    return { ok: false, error: error.message }
  }

  const payload = data && typeof data === 'object' ? data : {}
  if (payload.ok) dispatchModerationAlertsUpdated()
  return payload
}
