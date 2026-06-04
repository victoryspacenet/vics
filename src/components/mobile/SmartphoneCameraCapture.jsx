import { useCallback, useState } from 'react'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'

function looksLikeUserDismissed(error) {
  const msg = String(error?.message ?? error ?? '').toLowerCase()
  if (!msg) return false
  return (
    msg.includes('cancel') ||
    msg.includes('dismiss') ||
    msg.includes('user denied') ||
    msg.includes('no image picked') ||
    msg.includes('pick cancelled')
  )
}

/**
 * 스마트폰 카메라로 사진을 찍고 미리보기합니다. (@capacitor/camera)
 *
 * - 네이티브: `CameraSource.Camera` + `CameraResultType.Uri` → `webPath`로 `<img>` 미리보기
 * - 웹: Capacitor Camera 동작(브라우저/PWA 요소에 따라 파일 선택 등으로 대체될 수 있음)
 *
 * @param {{
 *   className?: string,
 *   quality?: number,
 *   onCapture?: (photo: { webPath: string, format: string, path?: string }) => void,
 *   onError?: (message: string) => void,
 * }} props
 */
export function SmartphoneCameraCapture({
  className,
  quality = 88,
  onCapture,
  onError,
}) {
  const [previewUrl, setPreviewUrl] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const clear = useCallback(() => {
    setPreviewUrl(null)
    setError(null)
  }, [])

  const takePhoto = useCallback(async () => {
    setError(null)
    setBusy(true)
    try {
      const current = await Camera.checkPermissions()
      if (current.camera !== 'granted') {
        const requested = await Camera.requestPermissions({ permissions: ['camera'] })
        if (requested.camera !== 'granted') {
          const msg = '카메라 권한이 필요해요. 설정에서 허용해 주세요.'
          setError(msg)
          onError?.(msg)
          return
        }
      }

      const photo = await Camera.getPhoto({
        quality,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        saveToGallery: false,
        correctOrientation: true,
      })

      const webPath = photo.webPath
      if (!webPath) {
        const msg = '이미지 경로를 가져오지 못했어요.'
        setError(msg)
        onError?.(msg)
        return
      }

      setPreviewUrl(webPath)
      onCapture?.({ webPath, format: photo.format, path: photo.path })
    } catch (err) {
      if (looksLikeUserDismissed(err)) return
      const msg = err?.message ? String(err.message) : '카메라를 열지 못했어요.'
      setError(msg)
      onError?.(msg)
    } finally {
      setBusy(false)
    }
  }, [quality, onCapture, onError])

  return (
    <div className={cn('flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm max-lg:p-5', className)}>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="primary" size="md" disabled={busy} onClick={takePhoto}>
          {busy ? '카메라 준비 중…' : '카메라로 촬영'}
        </Button>
        {previewUrl ? (
          <Button type="button" variant="outline" size="md" disabled={busy} onClick={clear}>
            다시 찍기
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {previewUrl ? (
        <figure className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
          <img
            src={previewUrl}
            alt="촬영 미리보기"
            className="mx-auto max-h-[min(70vh,520px)] w-full object-contain"
            decoding="async"
          />
          <figcaption className="border-t border-gray-100 px-3 py-2 text-center text-xs text-gray-500">
            미리보기 · 업로드 전 화면에서 한 번 더 확인해 주세요
          </figcaption>
        </figure>
      ) : (
        <p className="rounded-xl bg-gray-50 px-3 py-6 text-center text-sm text-gray-500">
          촬영하면 이곳에 미리보기가 표시돼요.
        </p>
      )}
    </div>
  )
}
