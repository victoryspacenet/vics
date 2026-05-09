/**
 * 매치업 콘텐츠 업로드 규격
 * - 최대 용량, 권장 해상도, 영상 길이 제한
 */

// ── 최대 용량 ─────────────────────────────────────────────────────
export const MAX_IMAGE_MB = 5
export const MAX_VIDEO_MB = 50
export const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024
export const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024

// ── 영상 길이 제한 ─────────────────────────────────────────────────
export const MAX_VIDEO_SECONDS = 15

// ── 해상도 제한 ───────────────────────────────────────────────────
/** 이미지: 1:1 정방형, 최대 변 1200px (저장 시) */
export const IMAGE_MAX_SIDE = 1200
/** 권장 이미지 해상도 (1:1) */
export const IMAGE_RECOMMENDED = '1080×1080 (1:1)'

/** 영상: 최대 해상도 (짧은 변 기준) */
export const VIDEO_MAX_SIDE = 1080
/** 권장 영상 해상도 */
export const VIDEO_RECOMMENDED = '1080×1080 (1:1, 15초 이내)'

// ── 허용 형식 ─────────────────────────────────────────────────────
export const IMAGE_FORMATS = 'JPG, PNG, GIF'
export const VIDEO_FORMATS = 'MP4, MOV'

/**
 * 영상 길이(초) 검증
 * @param {File} file - 영상 파일
 * @returns {Promise<{ duration: number, valid: boolean, error?: string }>}
 */
export function validateVideoDuration(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    video.preload = 'metadata'

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      const duration = video.duration
      const valid = duration <= MAX_VIDEO_SECONDS
      resolve({
        duration,
        valid,
        error: valid ? null : `영상은 ${MAX_VIDEO_SECONDS}초 이하여야 해요 (현재 ${Math.ceil(duration)}초)`,
      })
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ duration: 0, valid: false, error: '영상 정보를 읽을 수 없어요' })
    }

    video.src = url
  })
}

/**
 * 영상 해상도 검증 (최대 1080p)
 * @param {File} file - 영상 파일
 * @returns {Promise<{ width: number, height: number, valid: boolean, error?: string }>}
 */
export function validateVideoResolution(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    video.preload = 'metadata'

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      const { videoWidth: width, videoHeight: height } = video
      const maxSide = Math.max(width, height)
      const valid = maxSide <= VIDEO_MAX_SIDE
      resolve({
        width,
        height,
        valid,
        error: valid ? null : `영상 해상도는 ${VIDEO_MAX_SIDE}p 이하여야 해요 (현재 ${maxSide}p)`,
      })
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ width: 0, height: 0, valid: false, error: '영상 정보를 읽을 수 없어요' })
    }

    video.src = url
  })
}

/**
 * 영상 전체 검증 (길이 + 해상도)
 */
export async function validateVideo(file) {
  const [durationResult, resolutionResult] = await Promise.all([
    validateVideoDuration(file),
    validateVideoResolution(file),
  ])

  if (!durationResult.valid) return { valid: false, error: durationResult.error }
  if (!resolutionResult.valid) return { valid: false, error: resolutionResult.error }

  return { valid: true }
}
