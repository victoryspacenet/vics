/**
 * Netlify — /report/tendency/s/:shareId OG (카카오·SNS 링크 미리보기)
 */
const { createClient } = require('@supabase/supabase-js')
const { withIpRateLimit } = require('../lib/rateLimitMiddleware.cjs')
const { isOgScraperUserAgent } = require('../lib/ogUserAgent.cjs')
const {
  injectOgIntoHtml,
  buildOgScraperHtml,
  fetchSpaIndexHtml,
} = require('../lib/ogHtmlInject.cjs')
const {
  parseShareIdFromPath,
  getTendencyOgMeta,
  buildMiddleLineFromSnapshot,
  sanitizeLine,
} = require('../lib/tendencyShareOgMeta.cjs')

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || ''

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function resolveShareId(event) {
  const fromQuery = sanitizeLine(event.queryStringParameters?.shareId, 64)
  if (UUID_RE.test(fromQuery)) return fromQuery

  const candidates = [
    event.path,
    event.rawUrl,
    event.headers?.['x-forwarded-uri'],
    event.headers?.['x-url'],
  ].filter(Boolean)

  for (const candidate of candidates) {
    const id = parseShareIdFromPath(candidate)
    if (UUID_RE.test(id)) return id
  }

  return ''
}

async function fetchShareSnapshot(shareId) {
  if (!shareId || !supabaseUrl || !supabaseAnonKey) return null
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data, error } = await supabase.rpc('get_tendency_report_share', {
      p_share_id: shareId,
    })
    if (error) return null
    const row = typeof data === 'string' ? JSON.parse(data) : data
    if (!row?.ok || !row.report_snapshot) return null
    return row.report_snapshot
  } catch {
    return null
  }
}

const ogHandler = async (event) => {
  const host = event.headers['x-forwarded-host'] || event.headers.host || ''
  const proto = event.headers['x-forwarded-proto'] || 'https'
  const baseUrl = `${proto}://${host}`.replace(/\/+$/, '')
  const shareId = resolveShareId(event)
  const requestUrl = shareId
    ? `${baseUrl}/report/tendency/s/${encodeURIComponent(shareId)}`
    : `${baseUrl}/report/tendency`

  const snapshot = shareId ? await fetchShareSnapshot(shareId) : null
  const middleLine = buildMiddleLineFromSnapshot(snapshot)

  const meta = getTendencyOgMeta({
    snapshot,
    middleLine,
    shareId,
    baseUrl,
    requestUrl,
  })

  const ua = event.headers['user-agent'] || event.headers['User-Agent'] || ''
  const isScraper = isOgScraperUserAgent(ua)

  let html
  if (isScraper) {
    html = buildOgScraperHtml(meta)
  } else {
    const indexHtml = await fetchSpaIndexHtml(baseUrl)
    html = indexHtml
      ? injectOgIntoHtml(indexHtml, meta)
      : buildOgScraperHtml(meta)
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
    body: html,
  }
}

exports.handler = withIpRateLimit(ogHandler, { scope: 'tendency-og', maxRequests: 60 })
