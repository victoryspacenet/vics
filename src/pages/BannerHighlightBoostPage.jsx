import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Gem, List, Sparkles } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { cn } from '../lib/utils'
import { Modal } from '../components/ui/Modal'
import { safeMediaUrl } from '../lib/sanitize'
import {
  BANNER_HIGHLIGHT_COST,
  canPurchaseBannerHighlightForMatchup,
  fetchBannerHighlightEligibleMatchups,
  isFeedBannerHighlightActive,
  purchaseMatchupBannerHighlightRpc,
} from '../lib/bannerHighlightBoost'
import { MainPagination } from '../components/main/MainPagination'

const PAGE_BG =
  'min-h-[70vh] pb-16 bg-gradient-to-br from-violet-50/95 via-fuchsia-50/40 to-amber-50/50'
const CARD =
  'rounded-2xl border border-violet-100/80 bg-white/95 shadow-[0_4px_28px_-12px_rgba(139,92,246,0.22)] backdrop-blur-[1px]'

const ELIGIBLES_PAGE_SIZE = 10

function formatPoints(n) {
  return Number(n || 0).toLocaleString('ko-KR')
}

function formatEndsAt(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export function BannerHighlightBoostPage() {
  const navigate = useNavigate()
  const { user, profile, fetchProfile } = useAuthStore()
  const { showToast, openLoginModal } = useUIStore()
  const points = profile?.points ?? 0

  const [eligibles, setEligibles] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [purchasing, setPurchasing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [listPage, setListPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = user?.id ? await fetchBannerHighlightEligibleMatchups(user.id) : []
      setEligibles(list)
      setSelectedId((prev) => {
        const purchasable = list.filter((m) => canPurchaseBannerHighlightForMatchup(m))
        if (prev && purchasable.some((m) => m.id === prev)) return prev
        return purchasable[0]?.id ?? null
      })
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void load()
  }, [load])

  const totalEligiblePages = Math.max(1, Math.ceil(eligibles.length / ELIGIBLES_PAGE_SIZE))

  useEffect(() => {
    setListPage((p) => Math.min(Math.max(1, p), totalEligiblePages))
  }, [totalEligiblePages])

  const visibleEligibles = useMemo(() => {
    const start = (listPage - 1) * ELIGIBLES_PAGE_SIZE
    return eligibles.slice(start, start + ELIGIBLES_PAGE_SIZE)
  }, [eligibles, listPage])

  useEffect(() => {
    if (!selectedId || !eligibles.length) return
    const idx = eligibles.findIndex((m) => m.id === selectedId)
    if (idx === -1) return
    setListPage(Math.floor(idx / ELIGIBLES_PAGE_SIZE) + 1)
  }, [selectedId, eligibles])

  const selected = eligibles.find((m) => m.id === selectedId)
  const selectedTitle = selected?.title || '선택한 매치업'
  const selectedPurchasable = selected ? canPurchaseBannerHighlightForMatchup(selected) : false
  const canPurchase =
    !!user &&
    !!selectedId &&
    selectedPurchasable &&
    !purchasing &&
    !loading &&
    points >= BANNER_HIGHLIGHT_COST

  const openPurchaseConfirm = () => {
    if (!user) {
      openLoginModal()
      return
    }
    if (!canPurchase) return
    setConfirmOpen(true)
  }

  const executePurchase = async () => {
    if (!user || !selectedId || !canPurchase) return
    const row = eligibles.find((m) => m.id === selectedId)
    if (!row || !canPurchaseBannerHighlightForMatchup(row)) return

    setPurchasing(true)
    try {
      const res = await purchaseMatchupBannerHighlightRpc(selectedId)
      if (!res.ok) {
        showToast(res.error, 'error')
        return
      }
      setConfirmOpen(false)
      showToast(`배너 강조가 적용됐어요! 피드에서 ${formatEndsAt(res.endsAt)}까지 네온 효과가 보여요 ✨`, 'success')
      await fetchProfile(user.id)
      window.dispatchEvent(new CustomEvent('vics:matchup-banner-highlight:updated'))
      await load()
    } catch (e) {
      showToast(e?.message || '구매 중 오류가 났어요', 'error')
    } finally {
      setPurchasing(false)
    }
  }

  return (
    <div className={PAGE_BG}>
      <Modal
        isOpen={confirmOpen}
        onClose={() => {
          if (!purchasing) setConfirmOpen(false)
        }}
        title="결제 전 확인"
        titleClassName="text-lg font-black text-violet-950"
        headerClassName="border-violet-100 bg-gradient-to-r from-violet-50/90 to-fuchsia-50/50"
      >
        <div className="space-y-4">
          <div className="flex gap-3 rounded-xl border border-violet-200/80 bg-violet-50/80 p-4">
            <AlertTriangle className="h-6 w-6 shrink-0 text-violet-600" aria-hidden />
            <div className="min-w-0 space-y-2 text-sm font-semibold leading-relaxed text-violet-950/95">
              <p>
                <span className="font-black text-fuchsia-700 tabular-nums">
                  {formatPoints(BANNER_HIGHLIGHT_COST)} P
                </span>
                가 즉시 차감되며, 되돌릴 수 없어요.
              </p>
              <p className="text-xs font-medium text-violet-900/85">
                매치업 카드에 네온 테두리가 표시돼요. 강조는{' '}
                <span className="font-black">24시간</span>과 <span className="font-black">48시간</span>
                {' 중에 투표 기간에 맞춰 유지돼요.'}
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-3 text-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">선택한 매치업</p>
            <p className="mt-1 line-clamp-2 font-black text-[#22282E]">{selectedTitle}</p>
          </div>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={purchasing}
              onClick={() => setConfirmOpen(false)}
              className="rounded-xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              disabled={purchasing}
              onClick={() => void executePurchase()}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 text-sm font-black text-white shadow-md transition hover:brightness-105 disabled:opacity-60"
            >
              {purchasing ? '처리 중…' : '확인했어요, 결제하기'}
            </button>
          </div>
        </div>
      </Modal>

      <div className="mx-auto max-w-screen-md px-4 pt-2">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/rewards'))}
          className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-violet-800/90 hover:text-violet-950"
        >
          <ArrowLeft size={18} />
          뒤로
        </button>

        <header className="mb-8 text-center">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-200/90 bg-white/90 px-4 py-1 text-xs font-black text-violet-900 shadow-sm">
            <Gem size={14} className="text-amber-500" />
            Point Reward · Boost
          </p>
          <h1 className="flex flex-wrap items-center justify-center gap-2 text-2xl font-black tracking-tight text-[#22282E] sm:text-3xl">
            <Sparkles className="h-8 w-8 shrink-0 text-fuchsia-500 sm:h-9 sm:w-9" strokeWidth={2.4} />
            배너 강조 효과
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm font-semibold leading-relaxed text-slate-600 sm:text-base">
            매치업 목록 피드에서 카드 테두리에 <span className="text-fuchsia-700">네온 링</span>이 들어가 시선을
            모읍니다. 강조는{' '}
            <span className="font-black text-violet-800">24시간</span>과{' '}
            <span className="font-black text-violet-800">48시간</span>
            {' 중에 투표 기간에 맞춰 유지돼요.'}
          </p>
          <div className="mx-auto mt-5 inline-flex flex-wrap items-center justify-center gap-3">
            <div
              className={cn(
                'rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-yellow-50/90 px-5 py-2.5 shadow-md shadow-amber-100/50',
                'text-sm font-black tabular-nums',
              )}
            >
              <span className="text-amber-900/85">보유 포인트</span>{' '}
              <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                {user ? `${formatPoints(points)} P` : '로그인 후 확인'}
              </span>
            </div>
            <div
              className={cn(
                'rounded-2xl border border-violet-200/90 bg-white/90 px-5 py-2.5 text-sm font-black tabular-nums text-violet-900',
              )}
            >
              이용료{' '}
              <span className="text-fuchsia-600">{formatPoints(BANNER_HIGHLIGHT_COST)} P</span>
            </div>
          </div>
        </header>

        {!user && (
          <div className={cn(CARD, 'mb-6 p-5 text-center')}>
            <p className="text-sm font-bold text-slate-600">로그인 후 구매할 수 있어요.</p>
            <button
              type="button"
              onClick={() => openLoginModal()}
              className="mt-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-2.5 text-sm font-black text-white shadow-md hover:brightness-105"
            >
              로그인
            </button>
          </div>
        )}

        <section className={cn(CARD, 'p-5 sm:p-6')}>
          <h2 className="flex items-center gap-2 text-base font-black text-[#22282E] sm:text-lg">
            <Sparkles className="h-5 w-5 text-fuchsia-500" />
            강조할 매치업 선택
          </h2>
          <p className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">
            내가 만든 매치업 중, 투표가 아직 진행 중이고 양쪽이 모두 채워진 활성 매치업만 표시돼요. 이미 네온 부스트가
            적용 중인 매치업은 종료 전까지 다시 결제할 수 없어요.
          </p>

          {loading ? (
            <ul className="mt-5 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </ul>
          ) : eligibles.length === 0 ? (
            <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/80 py-10 text-center text-sm font-semibold text-slate-500">
              <p>선택 가능한 매치업이 없어요.</p>
              <Link
                to="/"
                className="mt-2 inline-flex items-center justify-center whitespace-nowrap font-black text-violet-600 hover:underline"
              >
                메인에서 매치업 만들기 →
              </Link>
            </div>
          ) : (
            <>
            <ul className="mt-5 space-y-3">
              {visibleEligibles.map((m) => {
                const selected = selectedId === m.id
                const thumb = safeMediaUrl(m.left_thumbnail_url || '')
                const active = isFeedBannerHighlightActive(m)
                const purchasable = canPurchaseBannerHighlightForMatchup(m)
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      disabled={!purchasable}
                      onClick={() => {
                        if (!purchasable) return
                        setSelectedId(m.id)
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-all sm:p-4',
                        !purchasable && 'cursor-not-allowed opacity-60',
                        purchasable &&
                          selected &&
                          'border-fuchsia-400 bg-gradient-to-r from-violet-50 to-fuchsia-50/80 shadow-md shadow-fuchsia-100/60',
                        purchasable && !selected && 'border-slate-100 bg-white hover:border-violet-200/80',
                        !purchasable && 'border-slate-200 bg-slate-50/90',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                          selected ? 'border-fuchsia-500 bg-fuchsia-500 text-white' : 'border-slate-300 bg-white',
                        )}
                      >
                        {selected ? <Check size={12} strokeWidth={3} /> : null}
                      </span>
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        {thumb ? (
                          <img src={thumb} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[10px] font-bold text-slate-400">
                            VS
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-[#22282E]">{m.title}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-slate-500">
                          투표 {formatPoints(m.total_votes || 0)} ·{' '}
                          <Link
                            to={`/matchup/${m.id}`}
                            className="text-violet-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            상세 보기
                          </Link>
                          {m.expires_at && (
                            <span className="text-[10px] font-bold text-slate-400">
                              투표 마감 {formatEndsAt(m.expires_at)}
                            </span>
                          )}
                          {active && (
                            <span className="rounded-full bg-fuchsia-100 px-2 py-0.5 text-[10px] font-black text-fuchsia-800">
                              강조 중 ~{formatEndsAt(m.feed_banner_highlight_until)}
                            </span>
                          )}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
            {totalEligiblePages > 1 && (
              <div className="mt-6 space-y-2">
                <MainPagination
                  current={listPage}
                  total={totalEligiblePages}
                  onPage={setListPage}
                />
                <p className="text-center text-[11px] font-semibold text-slate-400">
                  {eligibles.length}개 중 {(listPage - 1) * ELIGIBLES_PAGE_SIZE + 1}–
                  {Math.min(listPage * ELIGIBLES_PAGE_SIZE, eligibles.length)}번째 표시
                </p>
              </div>
            )}
            </>
          )}
        </section>

        {user &&
          !loading &&
          eligibles.length > 0 &&
          eligibles.every((m) => !canPurchaseBannerHighlightForMatchup(m)) && (
            <p className="mx-auto mt-4 max-w-md text-center text-xs font-semibold text-violet-800/90">
              표시된 매치업은 모두 네온 부스트가 진행 중이에요. 종료 후 다시 구매할 수 있어요.
            </p>
          )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            disabled={!canPurchase}
            onClick={openPurchaseConfirm}
            className={cn(
              'rounded-2xl px-8 py-4 text-base font-black text-white shadow-lg transition-all sm:min-w-[240px]',
              canPurchase
                ? 'bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-500 shadow-fuchsia-200/50 hover:brightness-[1.03] active:scale-[0.99]'
                : 'cursor-not-allowed bg-slate-300 text-slate-100 shadow-none',
            )}
          >
            {purchasing ? '처리 중…' : `${formatPoints(BANNER_HIGHLIGHT_COST)} P 결제하고 적용하기`}
          </button>
          <Link
            to="/matchups"
            className={cn(
              'group relative isolate inline-flex min-w-[220px] items-stretch justify-center rounded-3xl p-[2.5px]',
              'bg-gradient-to-r from-violet-600 via-fuchsia-500 to-amber-400 shadow-[0_12px_40px_-10px_rgba(139,92,246,0.5)]',
              'transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_16px_48px_-8px_rgba(244,114,182,0.4)] active:scale-[0.98]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2',
            )}
          >
            <span
              className={cn(
                'relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-[1.35rem]',
                'bg-gradient-to-br from-white/98 via-violet-50/90 to-fuchsia-50/85 px-7 py-4 backdrop-blur-md',
                'ring-1 ring-white/80',
              )}
            >
              <span
                className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-violet-400/30 to-fuchsia-300/20 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                aria-hidden
              />
              <span
                className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-fuchsia-500/[0.07] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                aria-hidden
              />
              <List
                size={20}
                strokeWidth={2.4}
                className="relative shrink-0 text-violet-600 drop-shadow-sm transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:text-violet-700"
                aria-hidden
              />
              <span className="relative bg-gradient-to-r from-violet-800 via-fuchsia-700 to-rose-600 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-[17px]">
                피드에서 확인
              </span>
              <Sparkles
                size={17}
                className="relative shrink-0 text-amber-500 drop-shadow-[0_0_8px_rgba(251,191,36,0.55)] transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110"
                aria-hidden
              />
              <ArrowRight
                size={18}
                strokeWidth={2.6}
                className="relative shrink-0 text-fuchsia-500 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-fuchsia-600"
                aria-hidden
              />
            </span>
          </Link>
        </div>

        {user && points < BANNER_HIGHLIGHT_COST && (
          <p className="mt-4 text-center text-xs font-bold text-rose-600">
            포인트가 {formatPoints(BANNER_HIGHLIGHT_COST - points)} P 부족해요.
          </p>
        )}

        <p className="mx-auto mt-10 max-w-md text-center text-[11px] font-medium leading-relaxed text-slate-400">
          결제 즉시 포인트가 차감되며, 강조는 24시간과 48시간 중에 투표 기간에 맞춰 유지됩니다. 앱·DB에 따라 표시
          시각은 수 초 차이날 수 있어요.
        </p>
      </div>
    </div>
  )
}
