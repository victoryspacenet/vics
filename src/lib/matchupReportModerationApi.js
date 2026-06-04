/**
 * 챌린저(B) 신고 누적 + AI 몰수패 검사 — Netlify 함수
 */
import { supabase } from './supabase'
import { resolveSiteUrl } from './siteApiBase'

function apiUrl() {
  const base = import.meta.env.VITE_MATCHUP_REPORT_MODERATION_URL
  if (base && String(base).trim()) return String(base).trim().replace(/\/$/, '')
  return resolveSiteUrl('/api/matchup-report-moderation')
}

/**
 * @param {string} matchupId
 * @returns {Promise<{ penalized?: boolean, rightReportCount?: number, ok?: boolean }|null>}
 */
export async function runMatchupReportModerationCheck(matchupId) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return null

  const failOpen = import.meta.env.VITE_MATCHUP_MODERATION_FAIL_OPEN === '1'
  const url = apiUrl()

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ matchupId }),
    })
  } catch (e) {
    if (failOpen) return { ok: true, penalized: false }
    throw new Error(e?.message || '자동 검사에 연결할 수 없어요')
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    if ((res.status === 404 || res.status === 503) && failOpen) return { ok: true, penalized: false }
    throw new Error(data.error || '자동 검사에 실패했어요')
  }

  return data
}
