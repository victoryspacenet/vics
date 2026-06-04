/**
 * 매치업 미디어 1:1 크롭 유틸
 * 모든 이미지/영상은 1:1 정방형으로 저장하여 레이아웃 일관성 유지
 */

const MAX_SIZE = 1200
const JPEG_QUALITY = 0.85
const CROP_LOAD_TIMEOUT_MS = 90_000

/**
 * 이미지를 1:1 정방형으로 중앙 크롭 후 리사이즈
 * @param {File} file - 원본 이미지 파일
 * @returns {Promise<File>} - 1:1 크롭된 JPEG 파일
 */
export async function compressAndCropImage(file) {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    const url = URL.createObjectURL(file)
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      URL.revokeObjectURL(url)
      reject(new Error('이미지 처리 시간이 초과했어요. 더 작은 사진으로 다시 시도해 주세요.'))
    }, CROP_LOAD_TIMEOUT_MS)

    const fail = (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      reject(err)
    }

    img.onload = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      try {
        const { width, height } = img
        const size = Math.min(width, height)
        const sx = (width - size) / 2
        const sy = (height - size) / 2

        let outW = size
        let outH = size
        if (size > MAX_SIZE) {
          outW = MAX_SIZE
          outH = MAX_SIZE
        }

        const canvas = document.createElement('canvas')
        canvas.width = outW
        canvas.height = outH
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, sx, sy, size, size, 0, 0, outW, outH)

        canvas.toBlob(
          (blob) => {
            if (!blob) return fail(new Error('이미지 변환 실패'))
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
          },
          'image/jpeg',
          JPEG_QUALITY
        )
      } catch (err) {
        fail(err)
      }
    }
    img.onerror = () => {
      fail(new Error('이미지 로드 실패'))
    }
    img.src = url
  })
}
