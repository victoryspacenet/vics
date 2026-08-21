/**
 * SVG → Jimp 이미지.
 *
 * 텍스트는 koreanTextPath로 외곽선 path를 만들어 넣는다. sharp 내부 렌더러(librsvg)는
 * CSS @font-face의 data URI를 무시하고 시스템 폰트를 찾는데, 리눅스 람다에는 한글 폰트가
 * 없어 <text>로 그리면 전부 두부(□)가 되기 때문이다.
 */
const Jimp = require('jimp')

async function renderKoreanSvgToJimp(svg) {
  const sharp = require('sharp')
  const pngBuffer = await sharp(Buffer.from(String(svg))).png().toBuffer()
  return Jimp.read(pngBuffer)
}

module.exports = { renderKoreanSvgToJimp }
