/**
 * 업로드 시그니처 검사 (Node / Netlify Functions).
 * ⚠️ 규칙 변경 시 `src/lib/uploadMediaValidation.js` 와 반드시 맞추세요.
 */

'use strict'

const HEADER_BYTES = 32
const VIDEO_FTYP_PROBE = Math.min(64 * 1024, 262144)

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif'])
const VIDEO_MIMES = new Set(['video/mp4', 'video/quicktime'])
const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif'])
const VIDEO_EXT = new Set(['mp4', 'mov'])

const OCTET = 'application/octet-stream'

function normMime(s) {
  if (!s || typeof s !== 'string') return ''
  const t = String(s).trim().toLowerCase().split(';')[0]
  return t || ''
}

function extFromName(name) {
  if (!name || typeof name !== 'string') return ''
  const i = name.lastIndexOf('.')
  if (i < 0) return ''
  return name.slice(i + 1).toLowerCase().replace(/[^\w]/g, '') || ''
}

function isJpeg(u8) {
  return u8.length >= 3 && u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff
}

function isPng(u8) {
  if (u8.length < 8) return false
  return (
    u8[0] === 0x89 &&
    u8[1] === 0x50 &&
    u8[2] === 0x4e &&
    u8[3] === 0x47 &&
    u8[4] === 0x0d &&
    u8[5] === 0x0a &&
    u8[6] === 0x1a &&
    u8[7] === 0x0a
  )
}

function isGif(u8) {
  if (u8.length < 6) return false
  return (
    u8[0] === 0x47 &&
    u8[1] === 0x49 &&
    u8[2] === 0x46 &&
    u8[3] === 0x38 &&
    (u8[4] === 0x37 || u8[4] === 0x39) &&
    u8[5] === 0x61
  )
}

function isWebp(u8) {
  if (u8.length < 12) return false
  return (
    u8[0] === 0x52 &&
    u8[1] === 0x49 &&
    u8[2] === 0x46 &&
    u8[3] === 0x46 &&
    u8[8] === 0x57 &&
    u8[9] === 0x45 &&
    u8[10] === 0x42 &&
    u8[11] === 0x50
  )
}

function sniffRasterMagic(u8) {
  if (isJpeg(u8)) return 'jpeg'
  if (isPng(u8)) return 'png'
  if (isGif(u8)) return 'gif'
  if (isWebp(u8)) return 'webp'
  return null
}

function sniffIsoBmff(u8) {
  const n = Math.min(u8.length - 4, VIDEO_FTYP_PROBE)
  for (let i = 0; i <= n; i++) {
    if (u8[i] === 0x66 && u8[i + 1] === 0x74 && u8[i + 2] === 0x79 && u8[i + 3] === 0x70) return true
  }
  return false
}

/**
 * Buffer 전체 또는 앞부분 — 헤더만 넘겨도 됨 (min 16 bytes 이미지, 비디오는 ftyp 포함 구간 권장)
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
function validateSelectableRasterImage(buffer, mime, filename) {
  const u = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  if (!u.length) {
    return { ok: false, code: 'EMPTY', message: '빈 이미지입니다' }
  }
  const ext = extFromName(filename || '')
  if (ext && !IMAGE_EXT.has(ext)) {
    return { ok: false, code: 'EXT', message: '허용되지 않는 이미지 확장자' }
  }
  const m = normMime(mime)
  if (m && m !== OCTET && !IMAGE_MIMES.has(m)) {
    return { ok: false, code: 'MIME', message: '허용되지 않는 이미지 MIME' }
  }

  const head = u.subarray(0, Math.min(u.length, HEADER_BYTES))
  const magic = sniffRasterMagic(head)
  if (!magic || magic === 'webp') {
    return { ok: false, code: 'MAGIC', message: 'JPG/PNG/GIF 시그니처 아님' }
  }
  return { ok: true }
}

/**
 * 압축 파이프라인 출력 JPEG
 */
function validatePipelineJpeg(buffer, mime, _filename) {
  const u = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  if (!u.length) return { ok: false, code: 'EMPTY', message: '빈 JPEG입니다' }
  const m = normMime(mime)
  if (m && m !== 'image/jpeg' && m !== OCTET) {
    return { ok: false, code: 'MIME', message: 'JPEG MIME 아님' }
  }
  const head = u.subarray(0, Math.min(u.length, HEADER_BYTES))
  if (!isJpeg(head)) {
    return { ok: false, code: 'MAGIC', message: 'JPEG 시그니처 아님' }
  }
  return { ok: true }
}

/**
 * 매치업 비디오
 */
function validateMatchupVideo(buffer, mime, filename) {
  const u = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  if (!u.length) {
    return { ok: false, code: 'EMPTY', message: '빈 영상입니다' }
  }
  const ext = extFromName(filename || '')
  if (ext && !VIDEO_EXT.has(ext)) {
    return { ok: false, code: 'EXT', message: '허용되지 않는 영상 확장자' }
  }
  const m = normMime(mime)
  if (m && m !== OCTET && !VIDEO_MIMES.has(m)) {
    return { ok: false, code: 'MIME', message: '허용되지 않는 영상 MIME' }
  }

  const probe = u.subarray(0, Math.min(u.length, VIDEO_FTYP_PROBE))
  if (!sniffIsoBmff(probe)) {
    return { ok: false, code: 'MAGIC', message: 'ISO BMFF ftyp 미검출' }
  }
  return { ok: true }
}

module.exports = {
  IMAGE_MIMES,
  VIDEO_MIMES,
  IMAGE_EXT,
  VIDEO_EXT,
  validateSelectableRasterImage,
  validatePipelineJpeg,
  validateMatchupVideo,
}
