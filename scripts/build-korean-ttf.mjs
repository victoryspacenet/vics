/**
 * @fontsource woff2 → TTF 변환. opentype.js가 woff2를 못 읽어서 한 번만 만들어 저장소에 커밋한다.
 * 사용: node scripts/build-korean-ttf.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const wawoff = require('../netlify/node_modules/wawoff2')
const opentype = require('../netlify/node_modules/opentype.js')

const src = path.join(
  'netlify',
  'node_modules',
  '@fontsource',
  'noto-sans-kr',
  'files',
  'noto-sans-kr-korean-700-normal.woff2',
)
const out = path.join('netlify', 'fonts', 'noto-sans-kr-700.ttf')

const woff2 = fs.readFileSync(src)
const ttf = Buffer.from(await wawoff.decompress(woff2))
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, ttf)

const font = opentype.parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength))
const probe = '가나다ABC123'
const missing = [...probe].filter((ch) => !font.charToGlyphIndex(ch))

console.log(`woff2 ${(woff2.length / 1024).toFixed(0)}KB → ttf ${(ttf.length / 1024).toFixed(0)}KB`)
console.log(`unitsPerEm ${font.unitsPerEm}  글리프 ${font.glyphs.length}개`)
console.log(missing.length ? `누락 글리프: ${missing.join('')}` : `"${probe}" 전부 렌더 가능`)
