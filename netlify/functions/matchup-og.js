/**
 * Netlify Serverless - 동적 OG 태그
 * /matchup/:id 요청 시 "누가 누구와 대결 중!" 문구와 썸네일을 OG 메타에 주입
 */
const { createClient } = require('@supabase/supabase-js')
const { withIpRateLimit } = require('../lib/rateLimitMiddleware.cjs')

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

function getOgMeta(matchup, baseUrl, requestUrl) {
  const leftLabel = matchup.left_label || 'A'
  const rightLabel = matchup.right_label || 'B'
  const ogTitle = `${leftLabel} vs ${rightLabel} 대결 중!`
  const ogDescription = `누가 누구와 대결 중! ${leftLabel}와 ${rightLabel}, VICS에서 투표해보세요`

  const ogImage = matchup.id
    ? `${baseUrl.replace(/\/+$/, '')}/api/matchup-share-image?matchupId=${encodeURIComponent(matchup.id)}`
    : `${baseUrl.replace(/\/+$/, '')}/api/site-og-image`

  return {
    title: `${ogTitle} - VICS`,
    ogTitle,
    ogDescription,
    ogImage,
    requestUrl,
  }
}

function escapeHtml(s) {
  if (!s) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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
      `<meta property="og:image" content="${img}" />\n  <meta property="og:image:secure_url" content="${img}" />\n  <meta property="og:image:width" content="1200" />\n  <meta property="og:image:height" content="630" />`,
    )
  } else {
    out = out.replace(
      '</head>',
      `  <meta property="og:image" content="${img}" />\n  <meta property="og:image:secure_url" content="${img}" />\n  <meta property="og:image:width" content="1200" />\n  <meta property="og:image:height" content="630" />\n  <meta property="og:url" content="${url}" />\n</head>`,
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
  const path = event.path || ''
  const match = path.match(/^\/matchup\/(?:share\/)?([^/?#]+)/)
  const id = match ? match[1] : event.queryStringParameters?.id

  if (!id) {
    return { statusCode: 400, body: 'Missing matchup id' }
  }

  const host = event.headers['x-forwarded-host'] || event.headers.host || ''
  const proto = event.headers['x-forwarded-proto'] || 'https'
  const baseUrl = `${proto}://${host}`
  const requestUrl = path.includes('/matchup/share/')
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
      .select('id, title, left_label, right_label, left_type, right_type, left_url, right_url, left_thumbnail_url, right_thumbnail_url')
      .eq('id', id)
      .single()

    if (error || !matchup) {
      return {
        statusCode: 302,
        headers: { Location: '/' },
      }
    }

    const meta = getOgMeta(matchup, baseUrl, requestUrl)
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
  } catch (err) {
    console.error('[OG]', err)
    return {
      statusCode: 302,
      headers: { Location: '/' },
    }
  }
}

exports.handler = withIpRateLimit(ogHandler, { scope: 'matchup-og', maxRequests: 40 })
