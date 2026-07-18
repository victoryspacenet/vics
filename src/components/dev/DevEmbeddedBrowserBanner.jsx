import { useMemo, useState } from 'react'
import { ExternalLink, RefreshCw, X } from 'lucide-react'
import {
  dismissDevEmbeddedBrowserBanner,
  hardReloadDevPreview,
  isDevEmbeddedBrowserBannerDismissed,
  isDevEmbeddedIdeBrowser,
} from '../../lib/devEmbeddedBrowser'

/**
 * Cursor Simple Browser 등 — 코드 변경이 늦게 반영될 때 안내 (개발 전용)
 */
export function DevEmbeddedBrowserBanner() {
  const embedded = useMemo(() => isDevEmbeddedIdeBrowser(), [])
  const [dismissed, setDismissed] = useState(() => isDevEmbeddedBrowserBannerDismissed())

  if (!embedded || dismissed) return null

  const openExternal = () => {
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className="sticky top-0 z-[200] border-b border-amber-200/80 bg-gradient-to-r from-amber-50 via-orange-50/90 to-amber-50 px-3 py-2 text-amber-950 shadow-sm"
      role="status"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 text-xs sm:text-[13px]">
        <p className="min-w-0 flex-1 font-semibold leading-snug">
          Cursor 내장 브라우저는 변경 사항 반영이 늦을 수 있어요.
          <span className="hidden sm:inline"> Chrome 등 외부 브라우저에서 확인하는 것을 권장합니다.</span>
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => hardReloadDevPreview()}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-300/80 bg-white/90 px-2.5 py-1.5 font-bold text-amber-900 hover:bg-amber-100"
          >
            <RefreshCw size={13} />
            새로고침
          </button>
          <button
            type="button"
            onClick={openExternal}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 font-bold text-white hover:bg-amber-700"
          >
            <ExternalLink size={13} />
            http://127.0.0.1:5173
          </button>
          <button
            type="button"
            onClick={() => {
              dismissDevEmbeddedBrowserBanner()
              setDismissed(true)
            }}
            className="rounded-lg p-1.5 text-amber-700/80 hover:bg-amber-100/80"
            aria-label="닫기"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
