/**
 * 매치업 측별 신고 (Supabase) + Netlify AI 몰수패 연동
 */
import { supabase } from './supabase'
import { runMatchupReportModerationCheck } from './matchupReportModerationApi'

/**
 * @param {{ matchupId: string, reportedSide: 'left'|'right', reason?: string|null }} p
 * @returns {Promise<{ penalized: boolean, moderationFailed: boolean }>}
 */
export async function submitMatchupReportAndRunModeration({ matchupId, reportedSide, reason }) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) throw new Error('로그인이 필요해요')

  const { error } = await supabase.from('matchup_reports').insert({
    matchup_id: matchupId,
    reporter_id: session.user.id,
    reported_side: reportedSide,
    reason: reason?.trim() || null,
  })

  if (error) {
    if (error.code === '23505') throw new Error('이미 해당 측을 신고했어요.')
    throw new Error(error.message || '신고 접수에 실패했어요')
  }

  try {
    const mod = await runMatchupReportModerationCheck(matchupId)
    return { penalized: !!mod?.penalized, moderationFailed: false }
  } catch (e) {
    console.warn('[matchupReports] moderation', e)
    return { penalized: false, moderationFailed: true }
  }
}
