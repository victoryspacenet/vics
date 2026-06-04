import { useEffect } from 'react'
import { X } from 'lucide-react'
import { safeMediaUrl } from '../../lib/sanitize'
import { canOpenMatchupMediaView } from '../../lib/matchupMediaView'
import { cn } from '../../lib/utils'

/** 이미지·영상·텍스트 매치업 측 콘텐츠를 크게 보기 */
export function MatchupMediaViewer({ open, media, onClose }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open || !media || !canOpenMatchupMediaView(media)) return null

  const { type, url, thumbnail, text, label } = media
  const safeUrl = safeMediaUrl(url || '')
  const safeThumb = safeMediaUrl(thumbnail || '')

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${label || '매치업'} 미디어 보기`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/88 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="닫기"
      />
      <div className="relative z-10 flex w-full max-w-4xl flex-col gap-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="text-sm font-bold text-white/90">{label}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl bg-black/40 shadow-2xl ring-1 ring-white/10">
          {type === 'image' && (safeThumb || safeUrl) && (
            <img
              src={safeThumb || safeUrl}
              alt={label || ''}
              className="max-h-[min(78vh,720px)] w-full object-contain"
            />
          )}

          {type === 'video' && safeUrl && (
            <video
              src={safeUrl}
              poster={safeThumb || undefined}
              controls
              playsInline
              autoPlay
              className="max-h-[min(78vh,720px)] w-full bg-black object-contain"
            />
          )}

          {type === 'video' && !safeUrl && safeThumb && (
            <img
              src={safeThumb}
              alt={label || ''}
              className="max-h-[min(78vh,720px)] w-full object-contain"
            />
          )}

          {type === 'text' && (
            <div className="max-h-[min(78vh,720px)] overflow-y-auto p-6 sm:p-8">
              <p className="whitespace-pre-wrap text-center text-base font-semibold leading-relaxed text-white sm:text-lg">
                {text}
              </p>
            </div>
          )}

          {!['image', 'video', 'text'].includes(type) && (safeThumb || safeUrl) && (
            <img
              src={safeThumb || safeUrl}
              alt={label || ''}
              className="max-h-[min(78vh,720px)] w-full object-contain"
            />
          )}
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
