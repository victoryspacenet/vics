/**
 * 매치업 공유 OG — 메타·문구 (Netlify Functions)
 */
const { buildMatchupShareCopy } = require('./matchupShareCopy.cjs')

function escapeMetaText(value, maxLen = 200) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
}

function getMatchupOgMeta(matchup, baseUrl, requestUrl) {
  const copy = buildMatchupShareCopy(matchup)
  const ogTitle = escapeMetaText(copy.ogTitle, 120)
  const ogDescription = escapeMetaText(copy.ogDescription, 200)

  const ogImage = matchup?.id
    ? `${String(baseUrl).replace(/\/+$/, '')}/api/matchup-share-image?matchupId=${encodeURIComponent(matchup.id)}`
    : `${String(baseUrl).replace(/\/+$/, '')}/api/site-og-image`

  return {
    title: `${ogTitle} - VICS`,
    ogTitle,
    ogDescription,
    ogImage,
    requestUrl,
    phase: copy.phase,
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseMatchupIdFromPath(pathname) {
  const s = String(pathname || '')
  const shareMatch = s.match(/\/matchup\/share\/([^/?#]+)/i)
  if (shareMatch?.[1]) {
    try {
      return decodeURIComponent(shareMatch[1]).trim()
    } catch {
      return shareMatch[1].trim()
    }
  }
  const directMatch = s.match(/\/matchup\/([^/?#]+)/i)
  if (directMatch?.[1] && directMatch[1] !== 'share') {
    try {
      return decodeURIComponent(directMatch[1]).trim()
    } catch {
      return directMatch[1].trim()
    }
  }
  return ''
}

function resolveMatchupId(event) {
  const fromQuery = String(event.queryStringParameters?.matchupId || '').trim()
  if (UUID_RE.test(fromQuery)) return fromQuery

  const candidates = [
    event.path,
    event.rawUrl,
    event.headers?.['x-forwarded-uri'],
    event.headers?.['x-url'],
  ].filter(Boolean)

  for (const candidate of candidates) {
    const id = parseMatchupIdFromPath(candidate)
    if (UUID_RE.test(id)) return id
  }

  return ''
}

function isSharePageRequest(event) {
  if (event.queryStringParameters?.sharePath === '1') return true
  const candidates = [event.path, event.rawUrl].filter(Boolean)
  return candidates.some((c) => String(c).includes('/matchup/share/'))
}

module.exports = {
  getMatchupOgMeta,
  resolveMatchupId,
  isSharePageRequest,
  parseMatchupIdFromPath,
  UUID_RE,
}
