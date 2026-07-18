/**
 * Netlify — /report/tendency/s/:shareId OG (카카오·SNS 링크 미리보기)
 */
const { createClient } = require('@supabase/supabase-js')
const { withIpRateLimit } = require('../lib/rateLimitMiddleware.cjs')
const {
  parseShareIdFromPath,
  getTendencyOgMeta,
  buildMiddleLineFromSnapshot,
} = require('../lib/tendencyShareOgMeta.cjs')

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || ''

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
  const path = event.path || event.rawUrl || ''
  const shareId = parseShareIdFromPath(path)
  const requestUrl = `${baseUrl}/report/tendency/s/${encodeURIComponent(shareId)}`

  const snapshot = shareId ? await fetchShareSnapshot(shareId) : null
  const middleLine = buildMiddleLineFromSnapshot(snapshot)

  const meta = getTendencyOgMeta({
    snapshot,
    middleLine,
    shareId,
    baseUrl,
    requestUrl,
  })

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

exports.handler = withIpRateLimit(ogHandler, { scope: 'tendency-og', maxRequests: 60 })
