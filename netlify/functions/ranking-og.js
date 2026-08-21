/**
 * Netlify — /ranking/share OG (카카오·SNS 링크 미리보기)
 */
const { withIpRateLimit } = require('../lib/rateLimitMiddleware.cjs')
const { isOgScraperUserAgent } = require('../lib/ogUserAgent.cjs')
const {
  injectOgIntoHtml,
  buildOgScraperHtml,
  fetchSpaIndexHtml,
} = require('../lib/ogHtmlInject.cjs')

function buildRankingShareQuery(params) {
  const qs = new URLSearchParams()
  if (params.rank) qs.set('rank', String(params.rank))
  if (params.tier) qs.set('tier', String(params.tier))
  if (params.nickname) qs.set('nickname', String(params.nickname))
  if (params.sid) qs.set('sid', String(params.sid))
  const s = qs.toString()
  return s ? `?${s}` : ''
}

function getRankingOgMeta(params, baseUrl, requestUrl) {
  const nickname = String(params.nickname || '').trim()
  const rank = String(params.rank || '').trim()
  const tier = String(params.tier || 'Player').trim()
  const ogTitle = nickname ? `${nickname}님의 VICS 랭킹 카드 🏆` : 'VICS 랭킹 카드 🏆'
  const rankLine = rank ? `#${rank} · ${tier}` : tier
  const ogDescription = rankLine
    ? `${rankLine} · VictorySpace에서 나도 도전해 보세요 👇`
    : 'VictorySpace에서 나도 도전해 보세요 👇'
  const imageQs = buildRankingShareQuery({
    rank: params.rank,
    tier: params.tier,
    nickname: params.nickname,
    sid: params.sid,
  })
  const ogImage = `${baseUrl.replace(/\/+$/, '')}/api/ranking-share-image${imageQs}`

  return {
    title: `${ogTitle} - VICS`,
    ogTitle,
    ogDescription,
    ogImage,
    requestUrl,
  }
}

const ogHandler = async (event) => {
  const host = event.headers['x-forwarded-host'] || event.headers.host || ''
  const proto = event.headers['x-forwarded-proto'] || 'https'
  const baseUrl = `${proto}://${host}`.replace(/\/+$/, '')
  const params = event.queryStringParameters || {}
  const requestUrl = `${baseUrl}/ranking/share${buildRankingShareQuery(params)}`

  const meta = getRankingOgMeta(params, baseUrl, requestUrl)

  const ua = event.headers['user-agent'] || event.headers['User-Agent'] || ''
  let html
  if (isOgScraperUserAgent(ua)) {
    html = buildOgScraperHtml(meta)
  } else {
    const indexHtml = await fetchSpaIndexHtml(baseUrl)
    html = indexHtml ? injectOgIntoHtml(indexHtml, meta) : buildOgScraperHtml(meta)
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

exports.handler = withIpRateLimit(ogHandler, { scope: 'ranking-og', maxRequests: 60 })
