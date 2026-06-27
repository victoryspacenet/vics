/**
 * Vercel Edge Middleware - 동적 OG 태그
 * 링크 공유 시 카카오톡, 페이스북, 트위터 등에서 "누가 누구와 대결 중!" 문구와 썸네일 표시
 */

const CRAWLER_REGEX = /bot|crawler|spider|crawling|facebookexternalhit|kakaotalk|kakaostory|twitterbot|linkedinbot|slurp|whatsapp|telegram|line|pinterest|duckduckbot|googlebot|bingbot|yandexbot/i

export const config = {
  matcher: ['/matchup/:id*'],
}

export default async function middleware(request) {
  const url = new URL(request.url)
  const pathMatch = url.pathname.match(/^\/matchup\/([^/]+)$/)
  if (!pathMatch) return passThrough(request)

  const isCrawler = CRAWLER_REGEX.test(request.headers.get('user-agent') || '')
  if (!isCrawler) return passThrough(request)

  const id = pathMatch[1]
  if (!id) return passThrough(request)

  try {
    const matchup = await fetchMatchup(id)
    if (!matchup) return passThrough(request)

    const html = buildOGHtml(matchup, url.origin + url.pathname)
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
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

async function fetchMatchup(id) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey || !isValidSupabaseUrl(supabaseUrl)) return null

  const res = await fetch(
    `${supabaseUrl}/rest/v1/matchups?id=eq.${id}&select=id,title,left_label,right_label,left_thumbnail_url,right_thumbnail_url,left_url,right_url,left_type,right_type`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Accept': 'application/json',
      },
    }
  )
  if (!res.ok) return null

  const data = await res.json()
  return Array.isArray(data) && data.length > 0 ? data[0] : null
}

function buildOGHtml(matchup, canonicalUrl) {
  const leftLabel = matchup.left_label || 'A'
  const rightLabel = matchup.right_label || 'B'
  const title = `${leftLabel} vs ${rightLabel} 대결 중!`
  const description = `누가 누구와 대결 중! ${leftLabel}와 ${rightLabel}, VICS에서 투표해보세요`

  const imageUrl = getOgImageUrl(matchup, canonicalUrl)
  const escapedTitle = escapeHtml(title)
  const escapedDesc = escapeHtml(description)
  const escapedImage = escapeHtml(imageUrl)
  const escapedUrl = escapeHtml(canonicalUrl)

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapedTitle}</title>
  <meta name="description" content="${escapedDesc}" />
  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapedTitle}" />
  <meta property="og:description" content="${escapedDesc}" />
  <meta property="og:image" content="${escapedImage}" />
  <meta property="og:url" content="${escapedUrl}" />
  <meta property="og:site_name" content="VICS" />
  <meta property="og:locale" content="ko_KR" />
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapedTitle}" />
  <meta name="twitter:description" content="${escapedDesc}" />
  <meta name="twitter:image" content="${escapedImage}" />
</head>
<body>
  <p>${escapedTitle}</p>
  <p><a href="${escapedUrl}">VICS에서 투표하기</a></p>
</body>
</html>`
}

function getOgImageUrl(matchup, canonicalUrl) {
  try {
    const origin = new URL(canonicalUrl).origin
    if (matchup?.id) {
      return `${origin}/api/matchup-share-image?matchupId=${encodeURIComponent(matchup.id)}`
    }
    return `${origin}/logo.png`
  } catch {
    return '/logo.png'
  }
}

function escapeHtml(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
