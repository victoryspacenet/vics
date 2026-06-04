import { Capacitor } from '@capacitor/core'

/**
 * @capacitor/camera 촬영 결과를 업로드용 File 로 변환합니다.
 *
 * @param {{ webPath: string, path?: string }} photo `Camera.getPhoto` 결과
 * @param {string} [filename='capture.jpg']
 * @returns {Promise<File>}
 */
export async function cameraPhotoToFile(photo, filename = 'capture.jpg') {
  const { webPath, path } = photo
  let url = webPath
  if (path && Capacitor.isNativePlatform()) {
    try {
      url = Capacitor.convertFileSrc(path)
    } catch {
      url = webPath
    }
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error('이미지를 불러오지 못했어요')
  const blob = await res.blob()
  const mime = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg'
  const ext = mime.includes('png') ? '.png' : '.jpg'
  const base = String(filename || 'capture').replace(/\.(jpe?g|png)$/i, '')
  return new File([blob], `${base}${ext}`, { type: mime })
}
