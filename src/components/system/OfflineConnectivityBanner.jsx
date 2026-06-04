import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { WifiOff } from 'lucide-react'
import { Button } from '../ui/Button'
import { getSiteOrigin } from '../../lib/siteApiBase'
import { useUIStore } from '../../store/uiStore'
import { selectServerMaintenanceActive, useServerMaintenanceStore } from '../../store/serverMaintenanceStore'
import { cn } from '../../lib/utils'
import { LAYOUT_CONTENT_MAX_WIDTH_CLASS } from '../../lib/layoutShellClasses'

function readNavigatorOnline() {
  if (typeof navigator === 'undefined') return true
  return Boolean(navigator.onLine)
}

/** 네트워크 응답 확인용 URL (Capacitor: VITE_SITE_ORIGIN 우선, 없으면 현재 출처) */
function resolveProbeUrl() {
  try {
    const site = getSiteOrigin()
    if (site) return `${site.replace(/\/+$/, '')}/`
    return new URL('/', window.location.href).href
  } catch {
    return '/'
  }
}

const BODY_BANNER_CLASS = 'vics-offline-banner-open'

/**
 * 오프라인 시 상단 안내 + 「연결 확인」
 * body 포털 + fixed: 부모의 overflow-x로 sticky가 깨지는 문제를 피하고 세로 스크롤은 document 한 줄로 유지
 */
export function OfflineConnectivityBanner() {
  const maintenanceActive = useServerMaintenanceStore(selectServerMaintenanceActive)
  const showToast = useUIStore((s) => s.showToast)
  const [searchParams, setSearchParams] = useSearchParams()
  const offlineDemo = import.meta.env.DEV && searchParams.get('offlineDemo') === '1'
  const [visible, setVisible] = useState(() => !readNavigatorOnline())
  const [checking, setChecking] = useState(false)
  const bannerRef = useRef(null)

  const showBar = useMemo(() => offlineDemo || visible, [offlineDemo, visible])

  useEffect(() => {
    const sync = () => setVisible(!readNavigatorOnline())
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return undefined
    if (!showBar) {
      document.body.classList.remove(BODY_BANNER_CLASS)
      document.body.style.removeProperty('--vics-offline-banner-h')
      return undefined
    }
    const el = bannerRef.current
    if (!el) return undefined
    const apply = () => {
      const h = Math.ceil(el.getBoundingClientRect().height)
      document.body.style.setProperty('--vics-offline-banner-h', `${h}px`)
      document.body.classList.add(BODY_BANNER_CLASS)
    }
    apply()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => apply()) : null
    ro?.observe(el)
    window.addEventListener('resize', apply)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', apply)
      document.body.classList.remove(BODY_BANNER_CLASS)
      document.body.style.removeProperty('--vics-offline-banner-h')
    }
  }, [showBar])

  const runConnectionCheck = useCallback(async () => {
    if (checking) return
    if (import.meta.env.DEV && searchParams.get('offlineDemo') === '1') {
      const next = new URLSearchParams(searchParams)
      next.delete('offlineDemo')
      setSearchParams(next, { replace: true })
      showToast('오프라인 안내 미리보기를 닫았어요.', 'success')
      return
    }
    setChecking(true)
    const url = resolveProbeUrl()
    const ctrl = new AbortController()
    const tid = window.setTimeout(() => ctrl.abort(), 10000)
    try {
      await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        signal: ctrl.signal,
      })
      setVisible(false)
      if (readNavigatorOnline()) {
        showToast('연결이 확인되었어요.', 'success')
      } else {
        showToast('네트워크는 응답했어요. 잠시 후 다시 이용해 보세요.', 'success')
      }
    } catch {
      if (readNavigatorOnline()) {
        showToast('서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.', 'error')
      } else {
        showToast('아직 연결되지 않았어요. Wi-Fi 또는 모바일 데이터를 확인해 주세요.', 'error')
      }
    } finally {
      window.clearTimeout(tid)
      setChecking(false)
    }
  }, [checking, showToast, searchParams, setSearchParams])

  if (maintenanceActive || !showBar || typeof document === 'undefined') return null

  const bar = (
    <div
      ref={bannerRef}
      className="fixed left-0 right-0 top-0 z-[100] border-b border-amber-200/80 bg-amber-50/98 px-3 py-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] shadow-sm backdrop-blur-sm overscroll-contain"
      role="status"
      aria-live="polite"
    >
      <div className={cn(LAYOUT_CONTENT_MAX_WIDTH_CLASS, 'mx-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3')}>
        <div className="flex min-w-0 items-start gap-2 text-amber-950">
          <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
          <p className="text-sm leading-snug">
            <span className="font-semibold">인터넷 연결이 끊어졌습니다.</span>
            <span className="text-amber-900/90">
              {' '}
              Wi-Fi 또는 데이터 연결을 확인한 뒤 아래에서 연결을 다시 확인해 주세요.
            </span>
            {offlineDemo ? (
              <span className="mt-1 block text-xs font-medium text-amber-800/80">
                (개발 서버 미리보기: 주소에 ?offlineDemo=1 가 있을 때만 표시됩니다. 닫으려면「연결 확인」을 누르세요.)
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 justify-end sm:justify-center">
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={checking}
            onClick={() => void runConnectionCheck()}
            className="min-w-[7.5rem]"
          >
            {checking ? '확인 중…' : '연결 확인'}
          </Button>
        </div>
      </div>
    </div>
  )

  return createPortal(bar, document.body)
}
