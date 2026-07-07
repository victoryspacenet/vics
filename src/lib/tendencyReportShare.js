import { supabase } from './supabase'
import { resolvePublicShareUrl } from './socialShare'
import { TENDENCY_TYPES } from './tendencyReportAnalysis'

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

/** 공유 카드·클립보드 중단 문구 */
export function buildTendencyShareMiddleLine(report) {
  if (!report?.tendencyType) return ''
  const meta = TENDENCY_TYPES[report.tendencyType]
  return `${meta?.emoji || ''} ${meta?.title || ''} — ${report.headline || ''}`.trim()
}

export function buildTendencyShareText(report, shareUrl) {
  return [
    '나의 Vics 성향 리포트 📊',
    buildTendencyShareMiddleLine(report),
    '',
    shareUrl,
  ].join('\n')
}

/** ?share= 쿼리·경로 파라미터·window.location 에서 공유 ID 추출 */
export function readTendencyShareToken({ shareIdParam, searchParams } = {}) {
  const fromPath = typeof shareIdParam === 'string' ? shareIdParam.trim() : ''
  const fromQuery =
    typeof searchParams?.get === 'function'
      ? searchParams.get('share')?.trim() || ''
      : ''

  if (fromPath || fromQuery) return fromPath || fromQuery

  if (typeof window === 'undefined') return ''

  const pathMatch = window.location.pathname.match(/\/report\/tendency\/s\/([^/?#]+)/i)
  if (pathMatch?.[1]) {
    try {
      return decodeURIComponent(pathMatch[1]).trim()
    } catch {
      return pathMatch[1].trim()
    }
  }

  try {
    return new URLSearchParams(window.location.search).get('share')?.trim() || ''
  } catch {
    return ''
  }
}

export function getTendencyReportSharePageUrl(shareId) {
  if (!shareId) return getTendencyReportLandingUrl()
  const path = `/report/tendency/s/${encodeURIComponent(shareId)}`
  if (typeof window === 'undefined') return path
  return resolvePublicShareUrl(`${window.location.origin}${path}`)
}

export function getTendencyReportLandingUrl() {
  if (typeof window === 'undefined') return '/report/tendency'
  return resolvePublicShareUrl(`${window.location.origin}/report/tendency`)
}

/**
 * @param {object} report
 * @returns {Promise<{ ok: boolean, shareId?: string, shareUrl?: string, error?: string }>}
 */
export async function publishTendencyReportShare(report) {
  if (!report?.tendencyType) {
    return { ok: false, error: '리포트 데이터가 없어요' }
  }

  const { data: raw, error } = await supabase.rpc('publish_tendency_report_share', {
    p_snapshot: report,
  })

  if (error) {
    if (import.meta.env.DEV) console.warn('[tendencyReportShare] publish rpc:', error.message)
    return publishTendencyReportShareFallback(report)
  }

  const data = parseRpcJson(raw)
  if (!data?.ok || !data.share_id) {
    return {
      ok: false,
      error: typeof data?.error === 'string' ? data.error : '공유 링크를 만들지 못했어요',
    }
  }

  const shareId = String(data.share_id)
  return { ok: true, shareId, shareUrl: getTendencyReportSharePageUrl(shareId) }
}

async function publishTendencyReportShareFallback(report) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return { ok: false, error: '로그인이 필요해요' }

  const { data, error } = await supabase
    .from('tendency_report_shares')
    .insert({
      user_id: user.id,
      tendency_type: report.tendencyType,
      report_snapshot: report,
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    return { ok: false, error: error?.message || '공유 링크를 만들지 못했어요' }
  }

  const shareId = String(data.id)
  return { ok: true, shareId, shareUrl: getTendencyReportSharePageUrl(shareId) }
}

/**
 * @param {string} shareId
 * @returns {Promise<{ ok: boolean, report?: object, error?: string }>}
 */
export async function fetchSharedTendencyReport(shareId) {
  if (!shareId) return { ok: false, error: '공유 링크가 올바르지 않아요' }

  const { data: raw, error } = await supabase.rpc('get_tendency_report_share', {
    p_share_id: shareId,
  })

  if (error) {
    if (import.meta.env.DEV) console.warn('[tendencyReportShare] fetch rpc:', error.message)
    return fetchSharedTendencyReportFallback(shareId)
  }

  const data = parseRpcJson(raw)
  if (!data?.ok) {
    return {
      ok: false,
      error: typeof data?.error === 'string' ? data.error : '공유된 리포트를 찾을 수 없어요',
    }
  }

  return { ok: true, report: data.report_snapshot }
}

async function fetchSharedTendencyReportFallback(shareId) {
  const { data, error } = await supabase
    .from('tendency_report_shares')
    .select('report_snapshot')
    .eq('id', shareId)
    .maybeSingle()

  if (error || !data?.report_snapshot) {
    return { ok: false, error: '공유된 리포트를 찾을 수 없어요' }
  }

  return { ok: true, report: data.report_snapshot }
}
