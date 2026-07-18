/** 브라우저 카메라(getUserMedia) — Capacitor 네이티브가 아닌 웹·모바일 브라우저용 */

export function isWebCameraCaptureSupported() {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  )
}

/**
 * @param {'environment'|'user'} [facingMode]
 * @returns {Promise<MediaStream>}
 */
export async function requestWebCameraStream(facingMode = 'environment') {
  if (!isWebCameraCaptureSupported()) {
    throw new Error('이 브라우저에서는 카메라를 사용할 수 없어요.')
  }
  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  })
}

/** @param {MediaStream|null|undefined} stream */
export function stopWebCameraStream(stream) {
  if (!stream) return
  for (const track of stream.getTracks()) track.stop()
}

/**
 * 비디오 프레임을 1:1 중앙 크롭 JPEG blob으로 캡처
 * @param {HTMLVideoElement} video
 * @param {number} [quality=0.88] 0~1
 */
export function captureSquareJpegFromVideo(video, quality = 0.88) {
  const vw = video?.videoWidth || 0
  const vh = video?.videoHeight || 0
  if (!vw || !vh) throw new Error('카메라 화면을 불러오지 못했어요.')

  const size = Math.min(vw, vh)
  const sx = (vw - size) / 2
  const sy = (vh - size) / 2
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('사진을 처리하지 못했어요.')
  ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('사진을 저장하지 못했어요.'))),
      'image/jpeg',
      quality,
    )
  })
}

/**
 * getUserMedia 실패 시 모바일 브라우저용 capture input fallback
 * @param {string} [filename]
 * @returns {Promise<File>}
 */
export function pickCameraPhotoViaInput(filename = 'capture.jpg') {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.style.display = 'none'
    document.body.appendChild(input)

    const cleanup = () => {
      input.remove()
    }

    input.addEventListener('change', () => {
      const file = input.files?.[0]
      cleanup()
      if (!file) {
        reject(new Error('USER_CANCELLED'))
        return
      }
      if (!file.type.startsWith('image/')) {
        reject(new Error('이미지 파일만 선택할 수 있어요.'))
        return
      }
      const base = String(filename).replace(/\.(jpe?g|png)$/i, '')
      const ext = file.name.match(/\.(jpe?g|png)$/i)?.[0] || '.jpg'
      resolve(new File([file], `${base}${ext}`, { type: file.type || 'image/jpeg' }))
    }, { once: true })

    input.addEventListener('cancel', () => {
      cleanup()
      reject(new Error('USER_CANCELLED'))
    }, { once: true })

    input.click()
  })
}
