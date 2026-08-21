/**
 * OG 썸네일 텍스트 레이어 — 한글 폰트를 임베드한 SVG로 그린다.
 * Jimp 비트맵 폰트는 ASCII 전용이라 한글이 '???'로 찍히므로 텍스트는 전부 이 경로를 쓴다.
 */
const { renderKoreanSvgToJimp } = require('./koreanSvgRender.cjs')

function escapeXml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 한글은 글자 폭이 거의 일정해 글자 수 기준으로 끊어도 충분하다 */
function wrapByChars(text, maxCharsPerLine, maxLines) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim()
  if (!raw) return []
  const lines = []
  let line = ''
  for (const word of raw.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (next.length > maxCharsPerLine && line) {
      lines.push(line)
      if (lines.length >= maxLines) return lines
      line = word
    } else {
      line = next
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  return lines
}

/**
 * @param {{ x: number, y: number, text: string, size?: number, weight?: number, fill?: string, opacity?: number, anchor?: string }} node
 */
function textNode(node) {
  const {
    x,
    y,
    text,
    size = 32,
    weight = 700,
    fill = '#ffffff',
    opacity = 1,
    anchor = 'middle',
  } = node
  return (
    `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle"` +
    ` fill="${fill}" fill-opacity="${opacity}" font-size="${size}" font-weight="${weight}"` +
    ` font-family="sans-serif">${escapeXml(text)}</text>`
  )
}

/**
 * 투명 배경 텍스트 레이어를 Jimp 이미지로 만든다. 실패하면 null (텍스트 없이 진행).
 * @param {{ width: number, height: number, nodes: object[] }} opts
 */
async function renderTextLayer({ width, height, nodes }) {
  const body = (nodes || []).filter(Boolean).map(textNode).join('\n  ')
  if (!body) return null
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${body}
</svg>`
  try {
    return await renderKoreanSvgToJimp(svg)
  } catch (e) {
    console.warn('[shareTextSvg] text layer render failed', e?.message || e)
    return null
  }
}

module.exports = { escapeXml, wrapByChars, renderTextLayer }
