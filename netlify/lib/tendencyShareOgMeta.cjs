/**
 * 성향 리포트 공유 OG — 메타·문구 (Netlify Functions)
 */

const TENDENCY_META = {
  trendsetter: { title: '트렌드세터', emoji: '🔮' },
  mainstream: { title: '대중적인 입맛', emoji: '🌊' },
  unique: { title: '독특한 개성파', emoji: '🎨' },
}

function sanitizeLine(value, maxLen = 120) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
}

function buildMiddleLineFromSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return ''
  const type = snapshot.tendencyType || snapshot.tendency_type
  const meta = TENDENCY_META[type] || {}
  const headline = sanitizeLine(snapshot.headline, 80)
  const core = `${meta.emoji || ''} ${meta.title || ''}`.trim()
  if (!core && !headline) return ''
  if (!headline) return core
  if (!core) return headline
  return `${core} — ${headline}`
}

function parseShareIdFromPath(pathname) {
  const m = String(pathname || '').match(/\/report\/tendency\/s\/([^/?#]+)/i)
  if (!m?.[1]) return ''
  try {
    return decodeURIComponent(m[1]).trim()
  } catch {
    return m[1].trim()
  }
}

function buildTendencyOgImageQuery({ shareId, middleLine } = {}) {
  const qs = new URLSearchParams()
  if (shareId) qs.set('sid', shareId)
  if (middleLine) qs.set('line', middleLine)
  const s = qs.toString()
  return s ? `?${s}` : ''
}

function getTendencyOgMeta({ snapshot, middleLine, shareId, baseUrl, requestUrl }) {
  const line = sanitizeLine(middleLine) || buildMiddleLineFromSnapshot(snapshot)
  const ogTitle = line || 'VictorySpace 성향 리포트'
  const ogDescription = 'VictorySpace · 투표 성향 리포트'
  const imageQs = buildTendencyOgImageQuery({ shareId, middleLine: line })
  const ogImage = `${baseUrl.replace(/\/+$/, '')}/api/tendency-og-image${imageQs}`

  return {
    title: `${ogTitle} - VICS`,
    ogTitle,
    ogDescription,
    ogImage,
    requestUrl,
    middleLine: line,
  }
}

module.exports = {
  TENDENCY_META,
  sanitizeLine,
  buildMiddleLineFromSnapshot,
  parseShareIdFromPath,
  buildTendencyOgImageQuery,
  getTendencyOgMeta,
}
