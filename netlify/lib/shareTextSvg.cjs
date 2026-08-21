/**
 * OG 썸네일 텍스트 레이어 — 글자를 외곽선 path로 그려 렌더러의 폰트 탐색에 의존하지 않는다.
 */
const { renderKoreanSvgToJimp } = require('./koreanSvgRender.cjs')
const { textToSvgPath, wrapToWidth, measureText } = require('./koreanTextPath.cjs')

function escapeXml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 투명 배경 텍스트 레이어를 Jimp 이미지로 만든다. 실패하면 null (텍스트 없이 진행).
 * @param {{ width: number, height: number, nodes: object[] }} opts
 */
async function renderTextLayer({ width, height, nodes }) {
  const body = (nodes || [])
    .filter(Boolean)
    .map((n) => textToSvgPath(n))
    .filter(Boolean)
    .join('\n  ')
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

module.exports = { escapeXml, wrapToWidth, measureText, textToSvgPath, renderTextLayer }
