/**
 * 이용 제한(제재) — Supabase `user_moderation_restrictions` + 경고 payload
 */
import { getActiveRestrictionSummary } from './warnSanctionStorage'

/**
 * 접속 제한 화면용 데이터. 활성 제한이 없으면 null.
 */
export async function fetchRestrictionDisplay(userId, profile) {
  if (!userId) return null
  const summary = await getActiveRestrictionSummary(userId)
  if (!summary) return null
  return {
    nickname: profile?.nickname || '회원',
    reason: summary.reasonText,
    target: summary.targetText,
    startDate: summary.startDateFmt,
    endDate: summary.endDateFmt,
    endsAt: summary.endsAtMs,
    sanctionWarningId: summary.sanctionWarningId ?? null,
  }
}

export async function hasActiveModerationRestriction(userId) {
  if (!userId) return false
  return (await getActiveRestrictionSummary(userId)) != null
}
