/**
 * 동적 OG 태그 API - Vercel Serverless
 * /matchup/:id 요청 시 "누가 누구와 대결 중!" 문구와 썸네일을 OG 메타에 주입
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || ''

function getOgMeta(matchup, baseUrl, requestUrl) {
  const leftLabel = matchup.left_label || 'A'
  const rightLabel = matchup.right_label || 'B'
  const ogTitle = `${leftLabel} vs ${rightLabel} 대결 중!`
  const ogDescription = `${leftLabel}와 ${rightLabel}의 대결! VICS에서 투표해보세요`

  const ogImage = matchup.id
    ? `${baseUrl.replace(/\/+$/, '')}/api/matchup-share-image?matchupId=${encodeURIComponent(matchup.id)}`
    : `${baseUrl}/logo.png`

  return {
    title: `${ogTitle} - VICS`,
    description: ogDescription,
    ogTitle,
    ogDescription,
    ogImage,
    requestUrl,
  }
}

function injectOgIntoHtml(html, meta) {
  const ogTags = `
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${meta.requestUrl}" />
    <meta property="og:title" content="${meta.ogTitle}" />
    <meta property="og:description" content="${meta.ogDescription}" />
    <meta property="og:image" content="${meta.ogImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="VICS" />
    <meta property="og:locale" content="ko_KR" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${meta.requestUrl}" />
    <meta name="twitter:title" content="${meta.ogTitle}" />
    <meta name="twitter:description" content="${meta.ogDescription}" />
    <meta name="twitter:image" content="${meta.ogImage}" />
  `.trim()

  let out = html
    .replace(/<title>.*?<\/title>/s, `<title>${meta.title}</title>`)
    .replace(/<meta name="description" content="[^"]*"\/?>/, `<meta name="description" content="${meta.ogDescription}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\/?>/, `<meta property="og:title" content="${meta.ogTitle}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\/?>/, `<meta property="og:description" content="${meta.ogDescription}" />`)

  // og:image가 없으면 </head> 직전에 전체 OG 블록 추가
  if (!out.includes('og:image')) {
    out = out.replace('</head>', `  ${ogTags}\n  </head>`)
  } else {
    out = out.replace(/<meta property="og:image" content="[^"]*"\/?>/, `<meta property="og:image" content="${meta.ogImage}" />`)
  }
  return out
}

async function fetchIndexHtml(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/`, { headers: { 'User-Agent': 'Vercel-OG-Bot' } })
    if (res.ok) return await res.text()
  } catch {}
  return null
}

export default async function handler(req, res) {
  const { id } = req.query
  if (!id) {
    res.status(400).send('Missing matchup id')
    return
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host || ''
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const baseUrl = `${proto}://${host}`
  const requestUrl = `${baseUrl}/matchup/${id}`

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data: matchup, error } = await supabase
      .from('matchups')
      .select('id, title, left_label, right_label, left_type, right_type, left_url, right_url, left_thumbnail_url, right_thumbnail_url')
      .eq('id', id)
      .single()

    if (error || !matchup) {
      const html = await fetchIndexHtml(baseUrl)
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.status(200).send(html || '<!DOCTYPE html><html><body><div id="root"></div></body></html>')
      return
    }

    const meta = getOgMeta(matchup, baseUrl, requestUrl)
    let html = await fetchIndexHtml(baseUrl)
    if (html) {
      html = injectOgIntoHtml(html, meta)
    } else {
      // fallback: 기본 HTML 직접 생성 (dev 모드 등)
      html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/png" href="${baseUrl}/logo.png" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${meta.ogDescription}" />
  <title>${meta.title}</title>
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${meta.requestUrl}" />
  <meta property="og:title" content="${meta.ogTitle}" />
  <meta property="og:description" content="${meta.ogDescription}" />
  <meta property="og:image" content="${meta.ogImage}" />
  <meta property="og:site_name" content="VICS" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${meta.ogTitle}" />
  <meta name="twitter:description" content="${meta.ogDescription}" />
  <meta name="twitter:image" content="${meta.ogImage}" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${baseUrl}/src/main.jsx"></script>
</body>
</html>`
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    res.status(200).send(html)
  } catch (err) {
    console.error('[OG API]', err)
    const html = await fetchIndexHtml(baseUrl)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.status(200).send(html || '<!DOCTYPE html><html><body><div id="root"></div></body></html>')
  }
}
