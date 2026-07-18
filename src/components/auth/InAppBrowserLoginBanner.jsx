import { useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { getExternalBrowserLabel, getLoginPageUrl, isInAppBrowser } from '../../lib/inAppBrowser'
import { copyToClipboard } from '../../lib/utils'
import { useUIStore } from '../../store/uiStore'

/**
 * 카카오톡·인스타 등 인앱 브라우저에서 Google 로그인 차단 시 안내
 * @param {{ tone?: 'mz' | 'default' }} props
 */
export function InAppBrowserLoginBanner({ tone = 'default' }) {
  const { showToast } = useUIStore()
  const [copied, setCopied] = useState(false)
  const visible = useMemo(() => isInAppBrowser(), [])
  const browser = useMemo(() => getExternalBrowserLabel(), [])

  if (!visible) return null

  const isMz = tone === 'mz'

  const handleCopy = async () => {
    const url = getLoginPageUrl()
    try {
      await copyToClipboard(url)
      setCopied(true)
      showToast(`주소를 복사했어요. ${browser} 주소창에 붙여넣어 주세요.`, 'success')
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      showToast('복사에 실패했어요. 주소창 URL을 직접 복사해 주세요.', 'error')
    }
  }

  return (
    <div
      className={
        isMz
          ? 'overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50/95 to-orange-50/80 shadow-sm'
          : 'overflow-hidden rounded-xl border border-amber-200 bg-amber-50 shadow-sm'
      }
      role="status"
    >
      <div className="h-0.5 bg-gradient-to-r from-amber-400 to-orange-400" />
      <div className={isMz ? 'px-4 py-4' : 'px-3.5 py-3.5'}>
        <div className="mb-2 flex items-center gap-2.5">
          <span
            className={
              isMz
                ? 'flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm'
                : 'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white'
            }
          >
            <ExternalLink className={isMz ? 'h-3.5 w-3.5 text-white' : 'h-3 w-3'} strokeWidth={2.2} />
          </span>
          <p className={isMz ? 'text-sm font-black text-amber-950' : 'text-sm font-bold text-amber-950'}>
            {browser}에서 열어주세요
          </p>
        </div>
        <p
          className={
            isMz
              ? 'text-sm font-medium leading-relaxed text-amber-900/85'
              : 'text-xs font-medium leading-relaxed text-amber-900/80'
          }
        >
          지금 앱 안 브라우저에서는 <strong className="text-amber-950">Google·카카오 로그인이 차단</strong>될 수
          있어요. <strong className="text-amber-950">{browser}</strong> 주소창에 아래 주소를 붙여넣거나, 메뉴(
          <span className="whitespace-nowrap">···</span>)에서 「{browser}에서 열기」를 선택해 주세요.
        </p>
        <button
          type="button"
          onClick={handleCopy}
          className={
            isMz
              ? 'mt-3 inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-amber-700 active:scale-[0.98]'
              : 'mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-amber-700'
          }
        >
          {copied ? '복사됨 ✓' : '로그인 주소 복사'}
        </button>
      </div>
    </div>
  )
}
