import { supabase } from './supabase'
import { resolvePublicShareUrl } from './socialShare'
import { buildShareClipText, SHARE_CLIP_KAKAO_TOAST } from './shareClipText'
import { copyToClipboard } from './utils'
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
  return buildShareClipText({
    headline: '나의 Vics 성향 리포트 📊',
    description: buildTendencyShareMiddleLine(report),
    url: shareUrl,
  })
}

/** 성향 리포트 — 링크 복사 (매치업 상세와 동일 클립 형식) */
export async function copyTendencyShareLink({ report, shareUrl, showToast }) {
  if (!shareUrl || !shareUrl.includes('/report/tendency/s/')) {
    showToast?.('공유 링크를 아직 만들지 못했어요. 잠시 후 다시 시도해 주세요', 'error')
    return false
  }
  try {
    await warmTendencySharePreview({ shareUrl, report })
    await copyToClipboard(buildTendencyShareText(report, shareUrl))
    showToast?.(SHARE_CLIP_KAKAO_TOAST, 'success')
    return true
  } catch {
    showToast?.('복사에 실패했어요. 아래 링크를 길게 눌러 복사해 주세요', 'error')
    return false
  }
}

/** 공유 URL에서 shareId 추출 */
export function extractTendencyShareId(shareUrl) {
  const m = String(shareUrl || '').match(/\/report\/tendency\/s\/([^/?#]+)/i)
  if (!m?.[1]) return ''
  try {
    return decodeURIComponent(m[1]).trim()
  } catch {
    return m[1].trim()
  }
}

/** 성향 리포트 전용 OG 이미지 (로고 + 성향 문구 + URL) */
export function getTendencyReportOgImageUrl({ shareId, middleLine, shareUrl } = {}) {
  const qs = new URLSearchParams()
  const sid = shareId || extractTendencyShareId(shareUrl)
  if (sid) qs.set('sid', sid)
  if (middleLine) qs.set('line', middleLine)
  if (shareUrl) qs.set('url', shareUrl)
  const q = qs.toString()
  const path = `/api/tendency-og-image${q ? `?${q}` : ''}`
  if (typeof window === 'undefined') return path
  return resolvePublicShareUrl(`${window.location.origin}${path}`)
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

/** 카카오·SNS 미리보기 캐시 워밍 — 링크 복사 직전 호출 */
export async function warmTendencySharePreview({ shareUrl, report } = {}) {
  const url = shareUrl || getTendencyReportLandingUrl()
  const sid = extractTendencyShareId(url)
  const middleLine = report ? buildTendencyShareMiddleLine(report) : ''
  const imageUrl = getTendencyReportOgImageUrl({ shareId: sid, middleLine, shareUrl: url })

  const tasks = []
  if (/^https:\/\//i.test(url)) {
    tasks.push(fetch(url, { mode: 'no-cors', cache: 'no-store' }).catch(() => {}))
  }
  if (imageUrl && /^https:\/\//i.test(imageUrl)) {
    tasks.push(fetch(imageUrl, { mode: 'no-cors', cache: 'no-store' }).catch(() => {}))
  }
  await Promise.allSettled(tasks)
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
