import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'
import { isCapacitorNativeShell } from '../../lib/capacitorShell'
import {
  captureSquareJpegFromVideo,
  isWebCameraCaptureSupported,
  pickCameraPhotoViaInput,
  requestWebCameraStream,
  stopWebCameraStream,
} from '../../lib/webCameraCapture'

function looksLikeUserDismissed(error) {
  const msg = String(error?.message ?? error ?? '').toLowerCase()
  if (!msg) return false
  return (
    msg.includes('cancel') ||
    msg.includes('dismiss') ||
    msg.includes('user_cancelled') ||
    msg.includes('user denied') ||
    msg.includes('no image picked') ||
    msg.includes('pick cancelled')
  )
}

const useNativeCamera = isCapacitorNativeShell()

/**
 * 스마트폰·웹 카메라로 사진을 찍고 미리보기합니다.
 *
 * - 네이티브 앱: @capacitor/camera
 * - 웹 브라우저: getUserMedia 라이브 미리보기 + 촬영 (실패 시 capture input)
 *
 * @param {{
 *   className?: string,
 *   quality?: number,
 *   onCapture?: (photo: { webPath: string, format: string, path?: string, file?: File }) => void,
 *   onError?: (message: string) => void,
 * }} props
 */
export function SmartphoneCameraCapture({
  className,
  quality = 88,
  onCapture,
  onError,
}) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const previewUrlRef = useRef(null)

  const [previewUrl, setPreviewUrl] = useState(null)
  const [cameraLive, setCameraLive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrlRef.current)
    }
    previewUrlRef.current = null
  }, [])

  const stopStream = useCallback(() => {
    stopWebCameraStream(streamRef.current)
    streamRef.current = null
    setCameraLive(false)
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const clear = useCallback(() => {
    revokePreview()
    setPreviewUrl(null)
    setError(null)
    stopStream()
  }, [revokePreview, stopStream])

  const emitCapture = useCallback((webPath, extra = {}) => {
    previewUrlRef.current = webPath
    setPreviewUrl(webPath)
    onCapture?.({ webPath, format: 'jpeg', ...extra })
  }, [onCapture])

  const startWebCamera = useCallback(async () => {
    if (!isWebCameraCaptureSupported()) {
      const msg = '이 브라우저에서는 카메라를 사용할 수 없어요.'
      setError(msg)
      onError?.(msg)
      return false
    }
    setBusy(true)
    setError(null)
    try {
      const stream = await requestWebCameraStream('environment')
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play()
      }
      setCameraLive(true)
      return true
    } catch (err) {
      const msg = err?.message ? String(err.message) : '카메라 권한이 필요해요.'
      setError(msg)
      onError?.(msg)
      stopStream()
      return false
    } finally {
      setBusy(false)
    }
  }, [onError, stopStream])

  const captureWebPhoto = useCallback(async () => {
    const video = videoRef.current
    if (!video || !cameraLive) return
    setBusy(true)
    setError(null)
    try {
      const blob = await captureSquareJpegFromVideo(video, quality / 100)
      stopStream()
      const webPath = URL.createObjectURL(blob)
      emitCapture(webPath)
    } catch (err) {
      const msg = err?.message ? String(err.message) : '사진을 촬영하지 못했어요.'
      setError(msg)
      onError?.(msg)
    } finally {
      setBusy(false)
    }
  }, [cameraLive, emitCapture, onError, quality, stopStream])

  const openWebCameraFallback = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const file = await pickCameraPhotoViaInput('capture.jpg')
      const webPath = URL.createObjectURL(file)
      emitCapture(webPath, { file })
    } catch (err) {
      if (looksLikeUserDismissed(err)) return
      const msg = err?.message ? String(err.message) : '카메라를 열지 못했어요.'
      setError(msg)
      onError?.(msg)
    } finally {
      setBusy(false)
    }
  }, [emitCapture, onError])

  const takeNativePhoto = useCallback(async () => {
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

      emitCapture(webPath, { path: photo.path, format: photo.format || 'jpeg' })
    } catch (err) {
      if (looksLikeUserDismissed(err)) return
      const msg = err?.message ? String(err.message) : '카메라를 열지 못했어요.'
      setError(msg)
      onError?.(msg)
    } finally {
      setBusy(false)
    }
  }, [emitCapture, onError, quality])

  const handlePrimaryAction = useCallback(async () => {
    if (useNativeCamera) {
      await takeNativePhoto()
      return
    }
    if (previewUrl) {
      clear()
      await startWebCamera()
      return
    }
    if (cameraLive) {
      await captureWebPhoto()
      return
    }
    const started = await startWebCamera()
    if (!started) await openWebCameraFallback()
  }, [
    cameraLive,
    captureWebPhoto,
    clear,
    openWebCameraFallback,
    previewUrl,
    startWebCamera,
    takeNativePhoto,
  ])

  useEffect(() => {
    if (useNativeCamera) return undefined

    let cancelled = false

    ;(async () => {
      if (!isWebCameraCaptureSupported()) {
        if (!cancelled) {
          const msg = '이 브라우저에서는 카메라를 사용할 수 없어요.'
          setError(msg)
          onError?.(msg)
        }
        return
      }
      setBusy(true)
      try {
        const stream = await requestWebCameraStream('environment')
        if (cancelled) {
          stopWebCameraStream(stream)
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play()
        }
        setCameraLive(true)
      } catch (err) {
        if (!cancelled) {
          const msg = err?.message ? String(err.message) : '카메라 권한이 필요해요.'
          setError(msg)
          onError?.(msg)
        }
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()

    return () => {
      cancelled = true
      revokePreview()
      stopStream()
    }
    // 웹 카메라는 패널이 열릴 때 1회만 시작
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const primaryLabel = useNativeCamera
    ? (busy ? '카메라 준비 중…' : '카메라로 촬영')
    : previewUrl
      ? (busy ? '준비 중…' : '다시 찍기')
      : cameraLive
        ? (busy ? '촬영 중…' : '촬영')
        : (busy ? '카메라 준비 중…' : '카메라 열기')

  return (
    <div className={cn('flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm max-lg:p-5', className)}>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="primary" size="md" disabled={busy} onClick={handlePrimaryAction}>
          {primaryLabel}
        </Button>
        {!useNativeCamera && !previewUrl && !cameraLive ? (
          <Button type="button" variant="outline" size="md" disabled={busy} onClick={openWebCameraFallback}>
            기본 카메라 앱으로
          </Button>
        ) : null}
        {previewUrl ? (
          <Button type="button" variant="outline" size="md" disabled={busy} onClick={clear}>
            취소
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
      ) : !useNativeCamera && cameraLive ? (
        <figure className="overflow-hidden rounded-xl border border-gray-100 bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="mx-auto max-h-[min(70vh,520px)] w-full object-cover aspect-square"
          />
          <figcaption className="border-t border-gray-100 bg-gray-50 px-3 py-2 text-center text-xs text-gray-500">
            화면을 맞춘 뒤 「촬영」을 눌러 주세요
          </figcaption>
        </figure>
      ) : (
        <p className="rounded-xl bg-gray-50 px-3 py-6 text-center text-sm text-gray-500">
          {useNativeCamera ? '촬영하면 이곳에 미리보기가 표시돼요.' : '카메라를 열면 이곳에 미리보기가 표시돼요.'}
        </p>
      )}
    </div>
  )
}
