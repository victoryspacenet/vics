/**
 * 긴급 모니터링 큐 적재 — Netlify 함수 공용
 */
async function enqueueMatchupModerationAlert(svc, {
  matchupId,
  alertKind,
  similarityScore = null,
  aiConfidence = null,
  aiReasonKo = null,
  rightReportCount = 0,
  autoActioned = false,
}) {
  if (!matchupId || !alertKind) return null
  const { data, error } = await svc.rpc('enqueue_matchup_moderation_alert', {
    p_matchup_id: matchupId,
    p_alert_kind: alertKind,
    p_similarity_score: similarityScore,
    p_ai_confidence: aiConfidence,
    p_ai_reason_ko: aiReasonKo,
    p_right_report_count: rightReportCount,
    p_auto_actioned: autoActioned,
  })
  if (error) {
    console.warn('[moderationAlerts] enqueue', error.message)
    return null
  }
  return data
}

module.exports = { enqueueMatchupModerationAlert }
