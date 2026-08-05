/**
 * Netlify Serverless - 동적 OG 태그
 * /matchup/:id · /matchup/share/:id — 카카오·SNS 링크 미리보기
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
  getMatchupOgMeta,
  resolveMatchupId,
  isSharePageRequest,
} = require('../lib/matchupShareOgMeta.cjs')

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || ''

function isValidSupabaseUrl(url) {
  if (!url) return false
  try {
    const parsed = new URL(url)
    const isLocalhost = ['localhost', '127.0.0.1'].includes(parsed.hostname)
    return isLocalhost || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const ogHandler = async (event) => {
  const id = resolveMatchupId(event)

  if (!id) {
    return { statusCode: 400, body: 'Missing matchup id' }
  }

  const host = event.headers['x-forwarded-host'] || event.headers.host || ''
  const proto = event.headers['x-forwarded-proto'] || 'https'
  const baseUrl = `${proto}://${host}`.replace(/\/+$/, '')
  const requestUrl = isSharePageRequest(event)
    ? `${baseUrl}/matchup/share/${id}`
    : `${baseUrl}/matchup/${id}`

  if (!isValidSupabaseUrl(supabaseUrl)) {
    console.error('[VICS 보안] Supabase URL은 HTTPS여야 합니다. VITE_SUPABASE_URL을 확인해주세요.')
    return { statusCode: 500, body: 'Server configuration error' }
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data: matchup, error } = await supabase
      .from('matchups')
      .select('id, title, status, left_label, right_label, left_type, right_type, left_url, right_url, left_thumbnail_url, right_thumbnail_url, left_text, right_text, is_complete, expires_at, total_votes, challenger_forfeit_at')
      .eq('id', id)
      .single()

    if (error || !matchup) {
      return {
        statusCode: 302,
        headers: { Location: '/' },
      }
    }

    const meta = getMatchupOgMeta(matchup, baseUrl, requestUrl)
    const ua = event.headers['user-agent'] || event.headers['User-Agent'] || ''
    const isScraper = isOgScraperUserAgent(ua)

    let html
    if (isScraper) {
      html = buildOgScraperHtml(meta)
    } else {
      const indexHtml = await fetchSpaIndexHtml(baseUrl)
      if (!indexHtml) {
        html = buildOgScraperHtml(meta)
      } else {
        html = injectOgIntoHtml(indexHtml, meta)
        if (
          html.includes('VICS — 1대1 경쟁 플랫폼') &&
          meta.ogTitle &&
          !meta.ogTitle.includes('1대1 경쟁')
        ) {
          html = buildOgScraperHtml(meta)
        }
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
      body: html,
    }
  } catch (err) {
    console.error('[OG]', err)
    return {
      statusCode: 302,
      headers: { Location: '/' },
    }
  }
}

exports.handler = withIpRateLimit(ogHandler, { scope: 'matchup-og', maxRequests: 40 })
