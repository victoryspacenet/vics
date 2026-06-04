/**
 * 영상 첫 구간에서 1프레임 캡처 → JPEG (유사도 검사·썸네일용, 업로드 전)
 * blob: 원본과 동일 출처이므로 canvas drawImage 가능
 */

const DEFAULT_MAX_EDGE = 720
const DEFAULT_QUALITY = 0.82

/**
 * @param {File} file - 영상 File
 * @param {{ maxEdge?: number, quality?: number }} [opts]
 * @returns {Promise<File>} image/jpeg
 */
export function captureVideoPosterJpegFile(file, opts = {}) {
  const maxEdge = opts.maxEdge ?? DEFAULT_MAX_EDGE
  const quality = opts.quality ?? DEFAULT_QUALITY

  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    video.muted = true
    video.playsInline = true
    video.setAttribute('playsinline', '')
    video.preload = 'metadata'

    const cleanup = () => {
      try {
        URL.revokeObjectURL(url)
      } catch {}
    }

    const fail = (msg) => {
      cleanup()
      reject(new Error(msg))
    }

    const onSeeked = () => {
      try {
        const vw = video.videoWidth
        const vh = video.videoHeight
        if (!vw || !vh) {
          fail('영상 크기를 읽을 수 없어요')
          return
        }
        const scale = Math.min(1, maxEdge / Math.max(vw, vh))
        const w = Math.max(1, Math.round(vw * scale))
        const h = Math.max(1, Math.round(vh * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          fail('썸네일을 만들 수 없어요')
          return
        }
        ctx.drawImage(video, 0, 0, w, h)
        canvas.toBlob(
          (blob) => {
            cleanup()
            if (!blob) {
              reject(new Error('영상 썸네일 변환에 실패했어요'))
              return
            }
            const base = (file.name || 'video').replace(/\.[^.]+$/, '')
            resolve(new File([blob], `${base}-poster.jpg`, { type: 'image/jpeg' }))
          },
          'image/jpeg',
          quality,
        )
      } catch (e) {
        fail(e?.message || '영상 썸네일 처리 실패')
      }
    }

    video.addEventListener('seeked', onSeeked, { once: true })
    video.addEventListener('error', () => fail('영상을 불러오지 못했어요'), { once: true })

    video.addEventListener(
      'loadedmetadata',
      () => {
        const dur = video.duration
        let t = 0.1
        if (Number.isFinite(dur) && dur > 0) {
          t = Math.min(Math.max(0.05, dur * 0.08), Math.max(0.05, dur - 0.05))
        }
        try {
          video.currentTime = t
        } catch {
          fail('영상 위치를 이동할 수 없어요')
        }
      },
      { once: true },
    )

    video.src = url
  })
}
