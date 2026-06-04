/**
 * 매치업/문의 등 미디어 업로드 검증 — MIME·확장자 화이트리스트 + 시그니처(매직 바이트).
 * 브라우저 File.type 과 확장자는 위조 가능하므로 본문 앞쪽 바이트로 재확인합니다.
 */

const HEADER_BYTES = 32
/** ISO BMFF(MOV/M4V/mp4류) 에서 `ftyp` 박스 탐색 */
const VIDEO_FTYP_PROBE = Math.min(64 * 1024, 262144)

/** 파일 선택 UI용 accept 문자열 */
export const MATCHUP_IMAGE_INPUT_ACCEPT =
  'image/jpeg,image/png,image/gif,.jpg,.jpeg,.png,.gif'
export const MATCHUP_VIDEO_INPUT_ACCEPT = 'video/mp4,video/quicktime,.mp4,.mov'

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

/**
 * @param {Uint8Array} u8
 */
function isJpeg(u8) {
  return u8.length >= 3 && u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff
}

/**
 * @param {Uint8Array} u8
 */
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

/**
 * GIF87a / GIF89a — "GIF87a" | "GIF89a"
 * @param {Uint8Array} u8
 */
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

/**
 * RIFF .... WEBP
 * @param {Uint8Array} u8
 */
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

/**
 * @param {Uint8Array} u8
 * @returns {'jpeg'|'png'|'gif'|'webp'|null}
 */
export function sniffRasterImageMagic(u8) {
  if (isJpeg(u8)) return 'jpeg'
  if (isPng(u8)) return 'png'
  if (isGif(u8)) return 'gif'
  if (isWebp(u8)) return 'webp'
  return null
}

/**
 * MP4/MOV 계열 ISO BMFF: 앞쪽 구간에 `ftyp` 시그니처가 있으면 허용
 * @param {Uint8Array} u8
 */
export function sniffIsoBmffFtypMagic(u8) {
  const n = Math.min(u8.length - 4, VIDEO_FTYP_PROBE)
  for (let i = 0; i <= n; i++) {
    if (u8[i] === 0x66 && u8[i + 1] === 0x74 && u8[i + 2] === 0x79 && u8[i + 3] === 0x70) return true
  }
  return false
}

/**
 * @param {Blob} blob
 * @param {number} maxBytes
 */
export async function readBlobPrefix(blob, maxBytes) {
  const slice = blob.slice(0, maxBytes)
  const ab = await slice.arrayBuffer()
  return new Uint8Array(ab)
}

function mimeAllowsImageSelectable(mime) {
  const m = normMime(mime)
  if (!m || m === OCTET) return true
  return IMAGE_MIMES.has(m)
}

function mimeAllowsVideo(mime) {
  const m = normMime(mime)
  if (!m || m === OCTET) return true
  return VIDEO_MIMES.has(m)
}

function extAllowsImageSelectable(ext) {
  if (!ext) return true
  return IMAGE_EXT.has(ext)
}

function extAllowsVideo(ext) {
  if (!ext) return true
  return VIDEO_EXT.has(ext)
}

/**
 * 사용자 선택 직후(압축 전) JPG/PNG/GIF — 매치업 A/B·문의 등과 동일 규격
 * @param {File | Blob} file
 * @returns {Promise<{ ok: true } | { ok: false, message: string }>}
 */
export async function validateSelectableRasterImageUpload(file) {
  if (!(file instanceof Blob) || file.size <= 0) {
    return { ok: false, message: '이미지 파일을 확인할 수 없어요' }
  }
  const name = file instanceof File ? file.name : ''
  const ext = extFromName(name)
  if (!extAllowsImageSelectable(ext)) {
    return {
      ok: false,
      message: '허용된 이미지 형식만 올려주세요 (JPG, PNG, GIF)',
    }
  }
  if (!mimeAllowsImageSelectable(file instanceof File ? file.type : '')) {
    return { ok: false, message: '허용되지 않는 이미지 형식이에요' }
  }

  const u8 = await readBlobPrefix(file, HEADER_BYTES)
  const magic = sniffRasterImageMagic(u8)
  if (!magic || magic === 'webp') {
    return {
      ok: false,
      message: '파일 내용이 이미지(JPG·PNG·GIF)가 아니에요. 다른 파일일 수 있어요',
    }
  }
  return { ok: true }
}

/**
 * `compressAndCropImage` 등으로 만들어진 JPEG 객체 — 스토리지 직전
 * @param {File | Blob} file
 */
export async function validatePipelineJpegOutput(file) {
  if (!(file instanceof Blob) || file.size <= 0) {
    return { ok: false, message: '이미지를 처리한 뒤 다시 시도해 주세요' }
  }
  const m = normMime(file instanceof File ? file.type : '')
  if (m && m !== 'image/jpeg' && m !== OCTET) {
    return { ok: false, message: '압축된 이미지 형식을 확인하지 못했어요' }
  }
  const u8 = await readBlobPrefix(file, HEADER_BYTES)
  if (!isJpeg(u8)) {
    return { ok: false, message: '저장 형식(JPEG)이 올바르지 않아요' }
  }
  return { ok: true }
}

/**
 * 매치업 영상 — MP4/MOV (브라우저 라벨 + ISO BMFF ftyp).
 * @param {File | Blob} file
 */
export async function validateMatchupVideoUpload(file) {
  if (!(file instanceof Blob) || file.size <= 0) {
    return { ok: false, message: '영상 파일을 확인할 수 없어요' }
  }
  const name = file instanceof File ? file.name : ''
  const ext = extFromName(name)
  if (!extAllowsVideo(ext)) {
    return { ok: false, message: '영상은 MP4 또는 MOV만 올려주세요' }
  }
  if (!mimeAllowsVideo(file instanceof File ? file.type : '')) {
    return { ok: false, message: '허용되지 않는 영상 형식이에요' }
  }

  const n = Math.min(file.size, VIDEO_FTYP_PROBE)
  const u8 = await readBlobPrefix(file, n)
  if (!sniffIsoBmffFtypMagic(u8)) {
    return {
      ok: false,
      message: '파일 내용이 MP4/MOV(ISO 미디어)가 아니에요. 다른 확장자로 저장된 파일일 수 있어요',
    }
  }
  return { ok: true }
}
