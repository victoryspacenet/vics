import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { safeMediaUrl } from '../../lib/sanitize'
import { canOpenMatchupMediaView } from '../../lib/matchupMediaView'
import { cn } from '../../lib/utils'

/** 이미지·영상·텍스트 매치업 측 콘텐츠를 크게 보기 */
export function MatchupMediaViewer({ open, media, onClose }) {
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const handleClose = useCallback(() => {
    onCloseRef.current?.()
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, handleClose])

  if (!open || !media || !canOpenMatchupMediaView(media)) return null

  const { type, url, thumbnail, text, label } = media
  const safeUrl = safeMediaUrl(url || '')
  const safeThumb = safeMediaUrl(thumbnail || '')
  const imageSrc = safeUrl || safeThumb

  const node = (
    <MatchupMediaViewerBody
      key={`${type}:${safeUrl || safeThumb || text || ''}`}
      type={type}
      label={label}
      text={text}
      safeUrl={safeUrl}
      safeThumb={safeThumb}
      imageSrc={imageSrc}
      onClose={handleClose}
    />
  )

  return createPortal(node, document.body)
}

function MatchupMediaViewerBody({
  type,
  label,
  text,
  safeUrl,
  safeThumb,
  imageSrc,
  onClose,
}) {
  const [mediaReady, setMediaReady] = useState(type === 'text')
  const imgRef = useRef(null)

  const markImageReady = (el) => {
    imgRef.current = el
    if (el?.complete && el.naturalWidth > 0) {
      setMediaReady(true)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={`${label || '매치업'} 미디어 보기`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/92 backdrop-blur-sm"
        onClick={onClose}
        aria-label="닫기"
      />

      <div
        className="pointer-events-none relative z-[301] flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-black/80 px-4 py-3 backdrop-blur-md"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <span className="min-w-0 truncate text-sm font-bold text-white">{label}</span>
        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-white/35 bg-white text-[#111] shadow-[0_4px_24px_rgba(0,0,0,0.55)] transition-transform hover:scale-105 active:scale-95"
          aria-label="닫기"
        >
          <X size={22} strokeWidth={2.75} />
        </button>
      </div>

      <div
        className="relative z-[301] flex min-h-0 flex-1 items-center justify-center p-4 sm:p-6"
        onClick={onClose}
      >
        <div
          className="w-full max-w-4xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="overflow-hidden rounded-2xl bg-black/50 shadow-2xl ring-1 ring-white/15">
            {type === 'image' && imageSrc && (
              <img
                key={imageSrc}
                ref={markImageReady}
                src={imageSrc}
                alt={label || ''}
                className={cn(
                  'max-h-[min(72vh,720px)] w-full object-contain transition-opacity duration-200',
                  mediaReady ? 'opacity-100' : 'opacity-0',
                )}
                onLoad={() => setMediaReady(true)}
              />
            )}

            {type === 'video' && safeUrl && (
              <video
                key={safeUrl}
                src={safeUrl}
                poster={safeThumb || undefined}
                controls
                playsInline
                preload="metadata"
                className="max-h-[min(72vh,720px)] w-full bg-black object-contain"
                onLoadedData={() => setMediaReady(true)}
              />
            )}

            {type === 'video' && !safeUrl && safeThumb && (
              <img
                key={safeThumb}
                ref={markImageReady}
                src={safeThumb}
                alt={label || ''}
                className={cn(
                  'max-h-[min(72vh,720px)] w-full object-contain transition-opacity duration-200',
                  mediaReady ? 'opacity-100' : 'opacity-0',
                )}
                onLoad={() => setMediaReady(true)}
              />
            )}

            {type === 'text' && (
              <div className="max-h-[min(72vh,720px)] overflow-y-auto p-6 sm:p-8">
                <p className="whitespace-pre-wrap text-center text-base font-semibold leading-relaxed text-white sm:text-lg">
                  {text}
                </p>
              </div>
            )}

            {!['image', 'video', 'text'].includes(type) && imageSrc && (
              <img
                key={imageSrc}
                ref={markImageReady}
                src={imageSrc}
                alt={label || ''}
                className={cn(
                  'max-h-[min(72vh,720px)] w-full object-contain transition-opacity duration-200',
                  mediaReady ? 'opacity-100' : 'opacity-0',
                )}
                onLoad={() => setMediaReady(true)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** 썸네일 탭 시 뷰어 오픈 (투표·링크와 분리) */
export function MatchupMediaOpenButton({ media, onOpen, className, children }) {
  const canOpen = canOpenMatchupMediaView(media)
  if (!canOpen) {
    return <div className={cn('relative h-full w-full', className)}>{children}</div>
  }

  return (
    <button
      type="button"
      className={cn(
        'relative block h-full w-full cursor-zoom-in text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80 focus-visible:ring-offset-1',
        className,
      )}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onOpen(media)
      }}
      aria-label={`${media.label || '항목'} 크게 보기`}
    >
      {children}
    </button>
  )
}
