/**
 * 매치업 콘텐츠 업로드 규격
 * - 최대 용량, 권장 해상도, 영상 길이·해상도·평균 비트레이트 추정
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

/** 영상: 최대 해상도 (긴 변 기준) */
export const VIDEO_MAX_SIDE = 1080
/** 권장 영상 해상도 */
export const VIDEO_RECOMMENDED = '1080×1080 (1:1, 15초 이내)'

/**
 * 평균 비트레이트 상한 (Mbps, 파일크기·재생길이로 추정).
 * 50MB·15초 ≈ 27Mbps — 극단적으로 짧은 구간에 큰 파일을 넣는 경우를 걸러 업로드·재생 부담을 줄임.
 */
export const VIDEO_MAX_AVG_BITRATE_MBPS = 32

// ── 허용 형식 ─────────────────────────────────────────────────────
export const IMAGE_FORMATS = 'JPG, PNG, GIF'
export const VIDEO_FORMATS = 'MP4, MOV'

/** 클라이언트 업로드 대기 상한 (ms) */
export const UPLOAD_TIMEOUT_IMAGE_MS = 3 * 60 * 1000
export const UPLOAD_TIMEOUT_VIDEO_MS = 12 * 60 * 1000
export const VIDEO_METADATA_READ_MS = 45 * 1000

/**
 * 메타데이터 한 번만 읽기 (길이·해상도)
 * @param {File} file
 * @returns {Promise<{ duration: number, width: number, height: number } | { error: string }>}
 */
export function getVideoMetadata(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    video.preload = 'metadata'
    let settled = false

    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      resolve(result)
    }

    const timer = setTimeout(() => {
      finish({ error: '영상 정보 읽기 시간이 초과했어요. 다른 파일로 시도해 주세요.' })
    }, VIDEO_METADATA_READ_MS)

    video.onloadedmetadata = () => {
      const duration = video.duration
      const width = video.videoWidth
      const height = video.videoHeight
      if (!Number.isFinite(duration) || duration <= 0) {
        finish({ error: '영상 길이를 읽을 수 없어요' })
        return
      }
      if (!width || !height) {
        finish({ error: '영상 해상도를 읽을 수 없어요' })
        return
      }
      finish({ duration, width, height })
    }

    video.onerror = () => {
      finish({ error: '영상 정보를 읽을 수 없어요' })
    }

    video.src = url
  })
}

/**
 * 영상 전체 검증 (길이 + 해상도 + 평균 비트레이트 추정)
 */
export async function validateVideo(file) {
  const meta = await getVideoMetadata(file)
  if (meta.error) return { valid: false, error: meta.error }

  const { duration, width, height } = meta
  if (duration > MAX_VIDEO_SECONDS) {
    return {
      valid: false,
      error: `영상은 ${MAX_VIDEO_SECONDS}초 이하여야 해요 (현재 ${Math.ceil(duration)}초)`,
    }
  }

  const maxSide = Math.max(width, height)
  if (maxSide > VIDEO_MAX_SIDE) {
    return {
      valid: false,
      error: `영상 해상도는 ${VIDEO_MAX_SIDE}p 이하여야 해요 (현재 ${maxSide}p)`,
    }
  }

  if (duration >= 1.5) {
    const mbps = (file.size * 8) / duration / 1e6
    if (mbps > VIDEO_MAX_AVG_BITRATE_MBPS) {
      return {
        valid: false,
        error: `영상 데이터량이 너무 커요 (평균 약 ${mbps.toFixed(0)}Mbps, 허용 ${VIDEO_MAX_AVG_BITRATE_MBPS}Mbps 이하). 해상도·비트레이드를 낮춘 뒤 다시 올려 주세요.`,
      }
    }
  }

  return { valid: true }
}
