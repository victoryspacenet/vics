/**
 * 사이트 기본 OG 썸네일 — 매치업 외 페이지·카카오 fallback
 * GET /api/site-og-image
 */
const { withIpRateLimit } = require('../lib/rateLimitMiddleware.cjs')
const { composeSiteOgImage } = require('../lib/siteOgComposite.cjs')

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

  const host = event.headers['x-forwarded-host'] || event.headers.host || 'www.victoryspace.net'
  const proto = event.headers['x-forwarded-proto'] || 'https'
  const baseUrl = `${proto}://${host}`.replace(/\/+$/, '')
  const logoUrl = `${baseUrl}/logo.png`

  try {
    const buffer = await composeSiteOgImage(logoUrl)
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
    console.error('[site-og-image]', err)
    return { statusCode: 500, body: 'Image generation failed' }
  }
}

exports.handler = withIpRateLimit(handler, { scope: 'site-og-image', maxRequests: 120 })
