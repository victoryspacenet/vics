/**
 * SVG 텍스트를 글리프 외곽선(path)으로 변환한다.
 *
 * sharp 내부 렌더러(librsvg)는 CSS @font-face의 data URI를 쓰지 않고 시스템 폰트를 찾는다.
 * 리눅스 람다에는 한글 폰트가 없어 <text>로 그리면 전부 두부(□)가 된다.
 * 글리프를 path로 박아버리면 렌더 시점에 폰트 탐색이 아예 일어나지 않는다.
 */
const fs = require('fs')
const path = require('path')

const FONT_FILE = path.join(__dirname, '../fonts/noto-sans-kr-700.ttf')

let cachedFont = null
let loadFailed = false

function getFont() {
  if (cachedFont) return cachedFont
  if (loadFailed) return null
  try {
    const opentype = require('opentype.js')
    const buf = fs.readFileSync(FONT_FILE)
    cachedFont = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
    return cachedFont
  } catch (e) {
    console.warn('[koreanTextPath] font load failed', e?.message || e)
    loadFailed = true
    return null
  }
}

function measureText(text, size) {
  const font = getFont()
  if (!font) return 0
  return font.getAdvanceWidth(String(text), size)
}

/**
 * 글자 수 기준으로 줄바꿈하지 않고 실제 렌더 폭으로 끊는다.
 * @returns {string[]}
 */
function wrapToWidth(text, size, maxWidth, maxLines = 3) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim()
  if (!raw) return []
  const font = getFont()
  if (!font) return [raw]

  const lines = []
  let line = ''
  const flush = () => {
    if (line) lines.push(line)
    line = ''
  }

  for (const word of raw.split(' ')) {
    const candidate = line ? `${line} ${word}` : word
    if (measureText(candidate, size) <= maxWidth) {
      line = candidate
      continue
    }
    flush()
    if (lines.length >= maxLines) return lines.slice(0, maxLines)
    // 한 낱말이 통째로 넘치면 글자 단위로 자른다 (한글은 띄어쓰기가 드물다)
    line = ''
    for (const ch of word) {
      if (measureText(line + ch, size) > maxWidth && line) {
        lines.push(line)
        if (lines.length >= maxLines) return lines.slice(0, maxLines)
        line = ch
      } else {
        line += ch
      }
    }
  }
  flush()
  return lines.slice(0, maxLines)
}

/**
 * opentype.js의 toPathData()는 좌표가 지수 표기(1e-15 등)로 떨어지면 "NaN"을 뱉는다.
 * 경로 중간에 NaN이 하나라도 있으면 렌더러가 그 뒤를 통째로 버려 첫 글자만 남는다.
 * 그래서 커맨드에서 직접 문자열을 만든다.
 */
function num(v) {
  if (!Number.isFinite(v)) return '0'
  const r = Math.round(v * 100) / 100
  return Object.is(r, -0) ? '0' : String(r)
}

function commandsToPathData(commands) {
  let d = ''
  for (const c of commands) {
    switch (c.type) {
      case 'M':
        d += `M${num(c.x)} ${num(c.y)}`
        break
      case 'L':
        d += `L${num(c.x)} ${num(c.y)}`
        break
      case 'Q':
        d += `Q${num(c.x1)} ${num(c.y1)} ${num(c.x)} ${num(c.y)}`
        break
      case 'C':
        d += `C${num(c.x1)} ${num(c.y1)} ${num(c.x2)} ${num(c.y2)} ${num(c.x)} ${num(c.y)}`
        break
      case 'Z':
        d += 'Z'
        break
      default:
        break
    }
  }
  return d
}

/**
 * @param {{ text: string, x: number, y: number, size: number, fill?: string,
 *           opacity?: number, anchor?: 'start'|'middle'|'end' }} opts
 * @returns {string} <path .../> 또는 빈 문자열
 */
function textToSvgPath(opts) {
  const { text, x, y, size, fill = '#ffffff', opacity = 1, anchor = 'middle' } = opts
  const value = String(text || '')
  if (!value.trim()) return ''

  const font = getFont()
  if (!font) return ''

  const width = font.getAdvanceWidth(value, size)
  let startX = x
  if (anchor === 'middle') startX = x - width / 2
  else if (anchor === 'end') startX = x - width

  // y를 글자 상자의 세로 중앙으로 다루기 위해 베이스라인을 직접 계산한다
  const scale = size / font.unitsPerEm
  const ascender = font.ascender * scale
  const descender = font.descender * scale
  const baseline = y - (ascender + descender) / 2

  const d = commandsToPathData(font.getPath(value, startX, baseline, size).commands)
  if (!d) return ''
  return `<path d="${d}" fill="${fill}" fill-opacity="${opacity}" />`
}

module.exports = { getFont, measureText, wrapToWidth, textToSvgPath }
