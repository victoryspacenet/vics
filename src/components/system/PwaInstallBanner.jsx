import { useEffect, useState } from 'react'
import { Share, Smartphone, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { LAYOUT_CONTENT_MAX_WIDTH_CLASS } from '../../lib/layoutShellClasses'
import {
  isIosSafariFamily,
  isMobileBrowserViewport,
  shouldOfferPwaInstall,
} from '../../lib/pwaInstall'

/**
 * 모바일 브라우저에서 홈 화면 추가를 유도.
 * Android Chrome: 설치 프롬프트. iOS Safari: 공유 → 홈 화면에 추가 안내.
 */
export function PwaInstallBanner() {
  const [visible, setVisible] = useState(false)
  const [iosHelp, setIosHelp] = useState(false)
  const [installEvent, setInstallEvent] = useState(null)

  useEffect(() => {
    if (!shouldOfferPwaInstall()) return undefined
    if (!isMobileBrowserViewport() && !isIosSafariFamily()) return undefined

    setVisible(true)

    const onPrompt = (event) => {
      event.preventDefault()
      setInstallEvent(event)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    const onInstalled = () => {
      setVisible(false)
      setInstallEvent(null)
    }
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!visible) return null

  const onInstall = async () => {
    if (installEvent) {
      installEvent.prompt()
      try {
        await installEvent.userChoice
      } catch {
        /* 사용자가 닫으면 무시 */
      }
      setInstallEvent(null)
      setVisible(false)
      return
    }
    if (isIosSafariFamily()) {
      setIosHelp(true)
      return
    }
    setIosHelp(true)
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] px-3 max-lg:bottom-[calc(5.35rem+env(safe-area-inset-bottom,0px))] lg:bottom-4"
      role="dialog"
      aria-label="홈 화면에 추가"
    >
      <div
        className={cn(
          'pointer-events-auto mx-auto overflow-hidden rounded-2xl border border-violet-200/80 bg-white/95 shadow-[0_8px_28px_-8px_rgba(109,40,217,0.35)] backdrop-blur-md',
          LAYOUT_CONTENT_MAX_WIDTH_CLASS,
        )}
      >
        <div className="h-0.5 bg-gradient-to-r from-sky-400 via-violet-500 to-fuchsia-500" />
        <div className="flex items-start gap-3 px-3.5 py-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-sm">
            <Smartphone size={18} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black tracking-tight text-violet-950">홈 화면에 VICS 추가</p>
            <p className="mt-0.5 text-[11px] font-semibold leading-snug text-violet-800/70">
              아이콘만 누르면 앱처럼 바로 열려요
            </p>
            {iosHelp ? (
              <p className="mt-2 flex items-start gap-1.5 text-[11px] font-bold leading-relaxed text-fuchsia-800">
                <Share size={14} className="mt-0.5 shrink-0" />
                {isIosSafariFamily()
                  ? '하단 공유 버튼 → 홈 화면에 추가'
                  : '브라우저 메뉴(⋮) → 앱 설치 또는 홈 화면에 추가'}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <button
              type="button"
              onClick={() => setVisible(false)}
              className="rounded-lg p-1 text-violet-400 hover:bg-violet-50 hover:text-violet-700"
              aria-label="닫기"
            >
              <X size={16} />
            </button>
            {!iosHelp ? (
              <button
                type="button"
                onClick={onInstall}
                className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-1.5 text-[11px] font-black text-white shadow-sm"
              >
                추가하기
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
