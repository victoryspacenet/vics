/**
 * Netlify — /ranking/share OG (카카오·SNS 링크 미리보기)
 */
const { withIpRateLimit } = require('../lib/rateLimitMiddleware.cjs')

function escapeHtml(s) {
  if (!s) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

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

function injectOgIntoHtml(html, meta) {
  const pageTitle = escapeHtml(meta.title)
  const ogTitle = escapeHtml(meta.ogTitle)
  const d = escapeHtml(meta.ogDescription)
  const img = escapeHtml(meta.ogImage)
  const url = escapeHtml(meta.requestUrl)
  let out = html
    .replace(/<title>.*?<\/title>/s, `<title>${pageTitle}</title>`)
    .replace(/<meta name="description" content="[^"]*"\/?>/, `<meta name="description" content="${d}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\/?>/, `<meta property="og:title" content="${ogTitle}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\/?>/, `<meta property="og:description" content="${d}" />`)
  if (out.includes('og:image')) {
    out = out.replace(
      /<meta property="og:image" content="[^"]*"\/?>/,
      `<meta property="og:image" content="${img}" />\n  <meta property="og:image:width" content="1200" />\n  <meta property="og:image:height" content="630" />`,
    )
  } else {
    out = out.replace(
      '</head>',
      `  <meta property="og:image" content="${img}" />\n  <meta property="og:image:width" content="1200" />\n  <meta property="og:image:height" content="630" />\n  <meta property="og:url" content="${url}" />\n</head>`,
    )
  }
  if (!out.includes('og:url')) {
    out = out.replace('</head>', `  <meta property="og:url" content="${url}" />\n</head>`)
  }
  if (!out.includes('twitter:image')) {
    out = out.replace(
      '</head>',
      `  <meta name="twitter:title" content="${ogTitle}" />\n  <meta name="twitter:description" content="${d}" />\n  <meta name="twitter:image" content="${img}" />\n</head>`,
    )
  } else {
    out = out.replace(/<meta name="twitter:title" content="[^"]*"\/?>/, `<meta name="twitter:title" content="${ogTitle}" />`)
    out = out.replace(/<meta name="twitter:description" content="[^"]*"\/?>/, `<meta name="twitter:description" content="${d}" />`)
    out = out.replace(/<meta name="twitter:image" content="[^"]*"\/?>/, `<meta name="twitter:image" content="${img}" />`)
  }
  return out
}

function buildFallbackOgHtml(meta, baseUrl) {
  const pageTitle = escapeHtml(meta.title)
  const ogTitle = escapeHtml(meta.ogTitle)
  const d = escapeHtml(meta.ogDescription)
  const img = escapeHtml(meta.ogImage)
  const url = escapeHtml(meta.requestUrl)
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/png" href="${baseUrl}/logo.png" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${d}" />
  <title>${pageTitle}</title>
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:image" content="${img}" />
  <meta property="og:site_name" content="VICS" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${ogTitle}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${img}" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${baseUrl}/src/main.jsx"></script>
</body>
</html>`
}

const ogHandler = async (event) => {
  const host = event.headers['x-forwarded-host'] || event.headers.host || ''
  const proto = event.headers['x-forwarded-proto'] || 'https'
  const baseUrl = `${proto}://${host}`.replace(/\/+$/, '')
  const params = event.queryStringParameters || {}
  const requestUrl = `${baseUrl}/ranking/share${buildRankingShareQuery(params)}`

  const meta = getRankingOgMeta(params, baseUrl, requestUrl)

  let html
  try {
    const idxRes = await fetch(`${baseUrl}/`, { headers: { 'User-Agent': 'Netlify-OG-Bot' } })
    if (idxRes.ok) {
      html = injectOgIntoHtml(await idxRes.text(), meta)
    } else {
      html = buildFallbackOgHtml(meta, baseUrl)
    }
  } catch {
    html = buildFallbackOgHtml(meta, baseUrl)
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
