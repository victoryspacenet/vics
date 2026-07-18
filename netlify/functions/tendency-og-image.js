/**
 * 성향 리포트 공유 OG 이미지 — 로고 + 성향 문구 + URL
 * GET /api/tendency-og-image?sid=...  또는 ?line=...
 */
const { createClient } = require('@supabase/supabase-js')
const { withIpRateLimit } = require('../lib/rateLimitMiddleware.cjs')
const { composeTendencyShareOgImage } = require('../lib/tendencyShareComposite.cjs')
const {
  buildMiddleLineFromSnapshot,
  sanitizeLine,
} = require('../lib/tendencyShareOgMeta.cjs')

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || ''

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

const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: '',
    }
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const params = event.queryStringParameters || {}
  const host = event.headers['x-forwarded-host'] || event.headers.host || 'www.victoryspace.net'
  const proto = event.headers['x-forwarded-proto'] || 'https'
  const baseUrl = `${proto}://${host}`.replace(/\/+$/, '')

  const shareId = sanitizeLine(params.sid || params.shareId, 64)
  let middleLine = sanitizeLine(params.line, 120)
  let shareUrl = sanitizeLine(params.url, 256)

  if (shareId) {
    const snapshot = await fetchShareSnapshot(shareId)
    if (snapshot) {
      middleLine = middleLine || buildMiddleLineFromSnapshot(snapshot)
    }
    if (!shareUrl) {
      shareUrl = `${baseUrl}/report/tendency/s/${encodeURIComponent(shareId)}`
    }
  }

  if (!middleLine) middleLine = 'VictorySpace 성향 리포트'
  if (!shareUrl) shareUrl = `${baseUrl}/report/tendency`

  try {
    const buffer = await composeTendencyShareOgImage({
      logoUrl: `${baseUrl}/logo.png`,
      middleLine,
      shareUrl,
    })
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*',
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true,
    }
  } catch (err) {
    console.error('[tendency-og-image]', err)
    return { statusCode: 500, body: 'Image generation failed' }
  }
}

exports.handler = withIpRateLimit(handler, { scope: 'tendency-og-image', maxRequests: 120 })
