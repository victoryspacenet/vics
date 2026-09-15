import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Share, Smartphone, X } from 'lucide-react'
import { cn, copyToClipboard } from '../../lib/utils'
import { LAYOUT_CONTENT_MAX_WIDTH_CLASS } from '../../lib/layoutShellClasses'
import { getExternalBrowserLabel, openInExternalBrowser } from '../../lib/inAppBrowser'
import { getPwaInstallMode, shouldOfferPwaInstall } from '../../lib/pwaInstall'
import { useUIStore } from '../../store/uiStore'

const ANDROID_PROMPT_WAIT_MS = 2500

/**
 * 모바일 브라우저에서 홈 화면 추가를 유도.
 * Android Chrome: 설치 프롬프트. iOS Safari: 공유 → 홈 화면에 추가.
 * 카카오톡·인스타 인앱 / iOS Chrome 등은 설치가 안 되므로 외부 브라우저 안내.
 */
export function PwaInstallBanner() {
  const { showToast } = useUIStore()
  const mode = useMemo(() => getPwaInstallMode(), [])
  const browser = useMemo(() => getExternalBrowserLabel(), [])
  const [visible, setVisible] = useState(() => shouldOfferPwaInstall() && getPwaInstallMode() !== 'none')
  const [installEvent, setInstallEvent] = useState(null)
  const [androidWaited, setAndroidWaited] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!shouldOfferPwaInstall()) return undefined
    if (mode === 'none') return undefined

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

    let waitTimer
    if (mode === 'android') {
      waitTimer = window.setTimeout(() => setAndroidWaited(true), ANDROID_PROMPT_WAIT_MS)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      if (waitTimer) window.clearTimeout(waitTimer)
    }
  }, [mode])

  if (!visible || mode === 'none') return null

  const copyPageUrl = async () => {
    try {
      await copyToClipboard(window.location.href)
      setCopied(true)
      showToast(`${browser} 주소창에 붙여넣어 주세요.`, 'success')
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      showToast('복사에 실패했어요. 주소창 URL을 직접 복사해 주세요.', 'error')
    }
  }

  const onAndroidInstall = async () => {
    if (!installEvent) return
    installEvent.prompt()
    try {
      await installEvent.userChoice
    } catch {
      /* 사용자가 닫으면 무시 */
    }
    setInstallEvent(null)
    setVisible(false)
  }

  const onOpenExternal = () => {
    const opened = openInExternalBrowser(window.location.href)
    if (!opened) {
      void copyPageUrl()
    }
  }

  const copyLabel = copied ? '복사됨 ✓' : '주소 복사'
  const androidCanPrompt = Boolean(installEvent)
  const canOpenChrome = mode === 'in-app' && /Android/i.test(navigator.userAgent || '')

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
            {mode === 'in-app' || mode === 'ios-other' ? (
              <ExternalLink size={18} className="text-white" />
            ) : (
              <Smartphone size={18} className="text-white" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black tracking-tight text-violet-950">
              {mode === 'in-app' || mode === 'ios-other'
                ? `${browser}에서 열어주세요`
                : '홈 화면에 VICS 추가'}
            </p>
            {mode === 'ios-safari' ? (
              <p className="mt-1.5 flex items-start gap-1.5 text-[11px] font-bold leading-relaxed text-fuchsia-800">
                <Share size={14} className="mt-0.5 shrink-0" />
                하단 공유 버튼 → 「홈 화면에 추가」
              </p>
            ) : null}
            {mode === 'ios-other' ? (
              <p className="mt-0.5 text-[11px] font-semibold leading-snug text-violet-800/70">
                iPhone은 Safari에서만 홈 화면에 넣을 수 있어요. 메뉴에서 Safari로 연 뒤 공유 → 홈 화면에 추가해 주세요.
              </p>
            ) : null}
            {mode === 'in-app' ? (
              <p className="mt-0.5 text-[11px] font-semibold leading-snug text-violet-800/70">
                카카오톡·인스타 안에서는 홈 화면에 넣을 수 없어요. {browser}에서 연 다음 다시 시도해 주세요.
              </p>
            ) : null}
            {mode === 'android' && androidCanPrompt ? (
              <p className="mt-0.5 text-[11px] font-semibold leading-snug text-violet-800/70">
                아이콘만 누르면 앱처럼 바로 열려요
              </p>
            ) : null}
            {mode === 'android' && !androidCanPrompt && androidWaited ? (
              <p className="mt-1.5 text-[11px] font-bold leading-relaxed text-fuchsia-800">
                브라우저 메뉴(⋮) → 앱 설치 또는 홈 화면에 추가
              </p>
            ) : null}
            {mode === 'android' && !androidCanPrompt && !androidWaited ? (
              <p className="mt-0.5 text-[11px] font-semibold leading-snug text-violet-800/70">
                설치 버튼을 준비하고 있어요
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
            {mode === 'android' && androidCanPrompt ? (
              <button
                type="button"
                onClick={onAndroidInstall}
                className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-1.5 text-[11px] font-black text-white shadow-sm"
              >
                추가하기
              </button>
            ) : null}
            {mode === 'in-app' || mode === 'ios-other' ? (
              <div className="flex flex-col items-end gap-1">
                {canOpenChrome ? (
                  <button
                    type="button"
                    onClick={onOpenExternal}
                    className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-1.5 text-[11px] font-black text-white shadow-sm"
                  >
                    Chrome에서 열기
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={copyPageUrl}
                  className="rounded-xl border border-violet-200 bg-white px-3 py-1.5 text-[11px] font-black text-violet-800 shadow-sm"
                >
                  {copyLabel}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
