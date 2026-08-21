/**
 * Netlify SVG → PNG — 한글 폰트(@fontsource/noto-sans-kr) 임베드
 */
const fs = require('fs')
const path = require('path')
const Jimp = require('jimp')

const KOREAN_FONT_FAMILY = 'NotoSansKR'
// 저장소에 넣어둔 사본이 1순위. node_modules는 Netlify 번들에 안 실릴 수 있어 폴백으로만 둔다.
const FONT_CANDIDATES = [
  '../fonts/noto-sans-kr-korean-700-normal.woff2',
  '../node_modules/@fontsource/noto-sans-kr/files/noto-sans-kr-korean-700-normal.woff2',
  '../node_modules/@fontsource/noto-sans-kr/files/noto-sans-kr-korean-700-normal.woff',
]

let fontBase64 = null
let fontFormat = 'woff2'

function getKoreanFontBase64() {
  if (fontBase64) return fontBase64
  for (const rel of FONT_CANDIDATES) {
    const filePath = path.join(__dirname, rel)
    if (!fs.existsSync(filePath)) continue
    fontBase64 = fs.readFileSync(filePath).toString('base64')
    fontFormat = filePath.endsWith('.woff2') ? 'woff2' : 'woff'
    return fontBase64
  }
  throw new Error('Korean font file not found (@fontsource/noto-sans-kr)')
}

function koreanFontFamilyAttr() {
  return `${KOREAN_FONT_FAMILY}, sans-serif`
}

function injectKoreanFontStyles(svgContent) {
  const base64 = getKoreanFontBase64()
  const styleBlock = `<style type="text/css"><![CDATA[
      @font-face {
        font-family: '${KOREAN_FONT_FAMILY}';
        src: url('data:font/${fontFormat};base64,${base64}') format('${fontFormat}');
        font-weight: 700;
        font-style: normal;
      }
    ]]></style>`

  if (/<defs[\s>]/i.test(svgContent)) {
    return svgContent.replace(/<defs([\s>])/i, `<defs$1${styleBlock}`)
  }
  return svgContent.replace(/(<svg[^>]*>)/i, `$1<defs>${styleBlock}</defs>`)
}

function applyKoreanFontFamily(svgContent) {
  return String(svgContent || '').replace(
    /font-family="[^"]*"/gi,
    `font-family="${koreanFontFamilyAttr()}"`,
  )
}

async function renderKoreanSvgToJimp(svg) {
  const sharp = require('sharp')
  const withFont = injectKoreanFontStyles(applyKoreanFontFamily(svg))
  const pngBuffer = await sharp(Buffer.from(withFont)).png().toBuffer()
  return Jimp.read(pngBuffer)
}

module.exports = {
  KOREAN_FONT_FAMILY,
  koreanFontFamilyAttr,
  renderKoreanSvgToJimp,
}
