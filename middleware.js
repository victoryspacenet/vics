/**
 * Vercel Edge Middleware - 동적 OG 태그
 * /matchup/:id · /matchup/share/:id — Netlify matchup-og와 동일한 상태별 문구·메타
 */
import { buildMatchupShareCopy, buildMatchupShareOgDescription } from './src/lib/matchupShareCopy.js'

const CRAWLER_REGEX =
  /bot|crawler|spider|crawling|facebookexternalhit|twitterbot|linkedinbot|slurp|whatsapp|telegram|pinterest|duckduckbot|googlebot|bingbot|yandexbot|slackbot|discordbot|kakaotalkbot|kakaostorybot|kakaotalk[-_]?scrap|kakaostory[-_]?scrap|kakaotalkscrap|kakaostoryscrap|yeti|naverbot/i

function isOgScraperUserAgent(ua) {
  const s = String(ua || '')
  if (!s) return false

  if (/kakaotalk|kakaostory/i.test(s) && /(?:iPhone|iPad|iPod|Android|Mobile)/i.test(s)) {
    if (!/(?:bot|scrap|crawler)/i.test(s)) return false
  }

  if (/\bLine\//i.test(s) && /(?:iPhone|iPad|iPod|Android|Mobile)/i.test(s)) {
    if (!/(?:bot|scrap|crawler)/i.test(s)) return false
  }

  return CRAWLER_REGEX.test(s)
}

export const config = {
  matcher: ['/matchup/:id*'],
}

export default async function middleware(request) {
  const url = new URL(request.url)
  const pathMatch = url.pathname.match(/^\/matchup\/(?:share\/)?([^/]+)$/)
  if (!pathMatch) return passThrough(request)

  const isCrawler = isOgScraperUserAgent(request.headers.get('user-agent') || '')
  if (!isCrawler) return passThrough(request)

  const id = pathMatch[1]
  if (!id) return passThrough(request)

  try {
    const matchup = await fetchMatchup(id)
    if (!matchup) return passThrough(request)

    const baseUrl = url.origin.replace(/\/+$/, '')
    const requestUrl = buildSharePageUrl(baseUrl, id, url.pathname)
    const meta = getMatchupOgMeta(matchup, baseUrl, requestUrl)
    const html = buildOgScraperHtml(meta)

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch {
    return passThrough(request)
  }
}

function passThrough(request) {
  const url = new URL(request.url)
  return fetch(url.origin + '/', {
    method: request.method,
    headers: request.headers,
  })
}

function isValidSupabaseUrl(supabaseUrl) {
  if (!supabaseUrl) return false
  try {
    const parsed = new URL(supabaseUrl)
    const isLocalhost = ['localhost', '127.0.0.1'].includes(parsed.hostname)
    return isLocalhost || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

async function fetchMatchup(id) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey || !isValidSupabaseUrl(supabaseUrl)) return null

  const select = [
    'id',
    'title',
    'status',
    'left_label',
    'right_label',
    'left_type',
    'right_type',
    'left_url',
    'right_url',
    'left_thumbnail_url',
    'right_thumbnail_url',
    'left_text',
    'right_text',
    'is_complete',
    'expires_at',
    'total_votes',
    'challenger_forfeit_at',
  ].join(',')

  const res = await fetch(
    `${supabaseUrl}/rest/v1/matchups?id=eq.${encodeURIComponent(id)}&select=${select}`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: 'application/json',
      },
    },
  )
  if (!res.ok) return null

  const data = await res.json()
  return Array.isArray(data) && data.length > 0 ? data[0] : null
}

function escapeMetaText(value, maxLen = 200) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
}

function getMatchupOgMeta(matchup, baseUrl, requestUrl) {
  const copy = buildMatchupShareCopy(matchup)
  const ogTitle = escapeMetaText(copy.ogTitle, 120)
  const ogDescription = escapeMetaText(buildMatchupShareOgDescription(matchup, copy.ogDescription), 200)
  const ogImage = matchup?.id
    ? `${String(baseUrl).replace(/\/+$/, '')}/api/matchup-share-image?matchupId=${encodeURIComponent(matchup.id)}`
    : `${String(baseUrl).replace(/\/+$/, '')}/api/site-og-image`

  return {
    title: `${ogTitle} - VICS`,
    ogTitle,
    ogDescription,
    ogImage,
    requestUrl,
  }
}

function buildOgScraperHtml(meta) {
  const pageTitle = escapeHtml(meta.title)
  const ogTitle = escapeHtml(meta.ogTitle)
  const d = escapeHtml(meta.ogDescription)
  const img = escapeHtml(meta.ogImage)
  const url = escapeHtml(meta.requestUrl)

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${d}" />
  <title>${pageTitle}</title>
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:image" content="${img}" />
  <meta property="og:image:secure_url" content="${img}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="VICS" />
  <meta property="og:locale" content="ko_KR" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${ogTitle}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${img}" />
</head>
<body>
  <p>${ogTitle}</p>
  <p><a href="${url}">VICS에서 보기</a></p>
</body>
</html>`
}

function buildSharePageUrl(origin, id, pathname) {
  if (pathname.includes('/matchup/share/')) {
    return `${origin}/matchup/share/${id}`
  }
  return `${origin}/matchup/${id}`
}

function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
