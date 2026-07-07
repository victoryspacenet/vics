/**
 * 랭킹 갤러리 공유 OG 이미지
 * GET /api/ranking-share-image?rank=3&tier=Player&nickname=...&thumb=https://...
 */
const { withIpRateLimit } = require('../lib/rateLimitMiddleware.cjs')
const { composeRankingShareOgImage } = require('../lib/rankingShareComposite.cjs')

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

  let thumbUrl = String(params.thumb || '').trim()
  if (thumbUrl && !/^https:\/\//i.test(thumbUrl)) {
    thumbUrl = ''
  }

  try {
    const buffer = await composeRankingShareOgImage({
      logoUrl: `${baseUrl}/logo.png`,
      thumbUrl: thumbUrl || undefined,
      rank: params.rank,
      tier: params.tier,
      nickname: params.nickname,
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
    console.error('[ranking-share-image]', err)
    return { statusCode: 500, body: 'Image generation failed' }
  }
}

exports.handler = withIpRateLimit(handler, { scope: 'ranking-share-image', maxRequests: 120 })
