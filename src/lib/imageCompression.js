/**
 * 브라우저에서 이미지 리사이즈·JPEG 압축 (업로드 전 서버/스토리지 부담 완화)
 */

import { compressAndCropImage } from './mediaCrop'

function extensionFromType(mime) {
  if (mime === 'image/webp') return '.webp'
  if (mime === 'image/png') return '.png'
  return '.jpg'
}

function baseName(file, newExt) {
  const n = (file.name || 'image').replace(/\.[^.]+$/, '')
  return `${n}${newExt}`
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('이미지를 불러오지 못했어요'))
    img.src = url
  })
}

/**
 * 비율 유지 + 긴 변 maxEdge 이하로 축소 후 JPEG 인코딩.
 * maxBytes 초과 시 quality를 단계적으로 낮춤.
 *
 * @param {File} file
 * @param {{
 *   maxEdge?: number,
 *   quality?: number,
 *   maxBytes?: number,
 *   mimeType?: 'image/jpeg',
 * }} [opts]
 * @returns {Promise<File>}
 */
export async function compressImageContain(file, opts = {}) {
  const maxEdge = opts.maxEdge ?? 1920
  let quality = opts.quality ?? 0.82
  const maxBytes = opts.maxBytes ?? 1.8 * 1024 * 1024
  const mimeType = opts.mimeType ?? 'image/jpeg'

  const url = URL.createObjectURL(file)
  try {
    const img = await loadImageFromUrl(url)
    let w = img.naturalWidth || img.width
    let h = img.naturalHeight || img.height
    if (!w || !h) throw new Error('이미지 크기를 알 수 없어요')

    const scale = Math.min(1, maxEdge / Math.max(w, h))
    w = Math.max(1, Math.round(w * scale))
    h = Math.max(1, Math.round(h * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas를 사용할 수 없어요')
    ctx.drawImage(img, 0, 0, w, h)

    for (let step = 0; step < 8; step++) {
      const blob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), mimeType, quality)
      })
      if (!blob) throw new Error('이미지 압축에 실패했어요')
      if (blob.size <= maxBytes || quality <= 0.42) {
        return new File([blob], baseName(file, extensionFromType(mimeType)), { type: mimeType })
      }
      quality -= 0.08
    }

    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), mimeType, 0.42)
    })
    if (!blob) throw new Error('이미지 압축에 실패했어요')
    return new File([blob], baseName(file, extensionFromType(mimeType)), { type: mimeType })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * 매치업용 1:1 크롭 파이프라인 (기존 mediaCrop)
 * @param {File} file
 * @returns {Promise<File>}
 */
export function compressImageSquareForMatchup(file) {
  return compressAndCropImage(file)
}

/**
 * contentEditable 삽입·data URL 상태용: 압축 후 Data URL
 * @param {File} file
 * @param {{ maxEdge?: number, quality?: number, maxBytes?: number }} [opts]
 * @returns {Promise<string>}
 */
export async function compressImageFileToDataUrl(file, opts = {}) {
  const out = await compressImageContain(file, {
    maxEdge: opts.maxEdge ?? 1400,
    quality: opts.quality ?? 0.8,
    maxBytes: opts.maxBytes ?? 900 * 1024,
  })
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(typeof r.result === 'string' ? r.result : '')
    r.onerror = () => reject(new Error('미리보기 생성 실패'))
    r.readAsDataURL(out)
  })
}
