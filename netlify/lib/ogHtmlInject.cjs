/**
 * SPA index.html — OG/Twitter 메타 일괄 교체 (stale og:image:secure_url 제거)
 */
function escapeHtml(s) {
  if (!s) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** index.html은 `content="..." />` 처럼 닫기 전 공백을 쓰므로 `\s*`가 없으면 하나도 매칭되지 않는다 */
function metaTagRegex(attr, name) {
  return new RegExp(`<meta ${attr}="${name}" content="[^"]*"\\s*/?>\\s*`, 'gi')
}

function stripExistingShareMeta(html) {
  return String(html || '')
    .replace(metaTagRegex('property', 'og:type'), '')
    .replace(metaTagRegex('property', 'og:url'), '')
    .replace(metaTagRegex('property', 'og:title'), '')
    .replace(metaTagRegex('property', 'og:description'), '')
    .replace(/<meta property="og:image(?::[^"]*)?" content="[^"]*"\s*\/?>\s*/gi, '')
    .replace(metaTagRegex('property', 'og:site_name'), '')
    .replace(metaTagRegex('property', 'og:locale'), '')
    .replace(metaTagRegex('name', 'twitter:card'), '')
    .replace(metaTagRegex('name', 'twitter:url'), '')
    .replace(metaTagRegex('name', 'twitter:title'), '')
    .replace(metaTagRegex('name', 'twitter:description'), '')
    .replace(metaTagRegex('name', 'twitter:image'), '')
}

function injectOgIntoHtml(html, meta) {
  const pageTitle = escapeHtml(meta.title)
  const ogTitle = escapeHtml(meta.ogTitle)
  const d = escapeHtml(meta.ogDescription)
  const img = escapeHtml(meta.ogImage)
  const url = escapeHtml(meta.requestUrl)

  let out = stripExistingShareMeta(html)
    .replace(/<title>.*?<\/title>/s, `<title>${pageTitle}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/i, `<meta name="description" content="${d}" />`)

  const ogBlock = `
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
  <meta name="twitter:url" content="${url}" />
  <meta name="twitter:title" content="${ogTitle}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${img}" />`

  if (out.includes('</head>')) {
    out = out.replace('</head>', `${ogBlock}\n</head>`)
  } else {
    out = `${ogBlock}\n${out}`
  }

  return out
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

async function fetchSpaIndexHtml(baseUrl) {
  const candidates = [`${baseUrl}/index.html`, `${baseUrl}/`]
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Netlify-OG-Bot', Accept: 'text/html' },
      })
      if (!res.ok) continue
      const html = await res.text()
      if (html.includes('id="root"') && (html.includes('/assets/') || html.includes('/src/main.jsx'))) {
        return html
      }
    } catch {
      /* try next */
    }
  }
  return null
}

module.exports = {
  escapeHtml,
  injectOgIntoHtml,
  buildOgScraperHtml,
  fetchSpaIndexHtml,
}
