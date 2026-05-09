import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Clock, Gem, Home, Sparkles, Zap } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { cn } from '../lib/utils'
import { Modal } from '../components/ui/Modal'
import { safeMediaUrl } from '../lib/sanitize'
import {
  MAIN_SPOTLIGHT_1H_COST,
  MAIN_SPOTLIGHT_MAX_PER_ACCOUNT,
  MAIN_SPOTLIGHT_MAX_SLOTS,
  fetchSpotlightEligibleMatchups,
  fetchGlobalSpotlightSlotStatus,
  purchaseMainSpotlight1hRpc,
} from '../lib/mainSpotlight'
import { MainPagination } from '../components/main/MainPagination'

const PAGE_BG =
  'min-h-[70vh] pb-16 bg-gradient-to-br from-amber-50/95 via-orange-50/50 to-violet-50/70'
const CARD =
  'rounded-2xl border border-orange-100/80 bg-white/95 shadow-[0_4px_28px_-12px_rgba(251,146,60,0.25)] backdrop-blur-[1px]'

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

export function MainSpotlight1hPage() {
  const navigate = useNavigate()
  const { user, profile, fetchProfile } = useAuthStore()
  const { showToast, openLoginModal } = useUIStore()
  const points = profile?.points ?? 0

  const [eligibles, setEligibles] = useState([])
  const [slot, setSlot] = useState({
    usedSlots: 0,
    maxSlots: MAIN_SPOTLIGHT_MAX_SLOTS,
    slotsFull: false,
    earliestEnd: null,
    activeMatchupIds: [],
    myActiveCount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [purchasing, setPurchasing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [listPage, setListPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, st] = await Promise.all([
        user?.id ? fetchSpotlightEligibleMatchups(user.id) : Promise.resolve([]),
        fetchGlobalSpotlightSlotStatus(user?.id ?? null),
      ])
      setEligibles(list)
      setSlot(st)
      setSelectedId((prev) => {
        if (prev && list.some((m) => m.id === prev)) return prev
        return list[0]?.id ?? null
      })
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    load()
  }, [load])

  const totalEligiblePages = Math.max(1, Math.ceil(eligibles.length / ELIGIBLES_PAGE_SIZE))

  useEffect(() => {
    setListPage((p) => Math.min(Math.max(1, p), totalEligiblePages))
  }, [totalEligiblePages])

  const visibleEligibles = useMemo(() => {
    const start = (listPage - 1) * ELIGIBLES_PAGE_SIZE
    return eligibles.slice(start, start + ELIGIBLES_PAGE_SIZE)
  }, [eligibles, listPage])

  const selectMatchup = (id) => {
    setSelectedId(id)
  }

  useEffect(() => {
    if (!selectedId || !eligibles.length) return
    const idx = eligibles.findIndex((m) => m.id === selectedId)
    if (idx === -1) return
    setListPage(Math.floor(idx / ELIGIBLES_PAGE_SIZE) + 1)
  }, [selectedId, eligibles])

  const selectedAlreadyActive =
    !!selectedId && (slot.activeMatchupIds || []).includes(selectedId)

  const accountSlotUsed = slot.myActiveCount >= MAIN_SPOTLIGHT_MAX_PER_ACCOUNT

  const canPurchase =
    !!user &&
    !!selectedId &&
    !purchasing &&
    !loading &&
    points >= MAIN_SPOTLIGHT_1H_COST &&
    !slot.slotsFull &&
    !selectedAlreadyActive &&
    !accountSlotUsed

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

    setPurchasing(true)
    try {
      const res = await purchaseMainSpotlight1hRpc(selectedId)
      if (!res.ok) {
        showToast(res.error, 'error')
        return
      }
      setConfirmOpen(false)
      showToast('메인 스포트라이트가 시작됐어요! 메인 상단에서 확인해 보세요 ✨', 'success')
      await fetchProfile(user.id)
      window.dispatchEvent(new CustomEvent('vics:main-spotlight:updated'))
      await load()
    } catch (e) {
      showToast(e?.message || '구매 중 오류가 났어요', 'error')
    } finally {
      setPurchasing(false)
    }
  }

  const selectedTitle = eligibles.find((m) => m.id === selectedId)?.title || '선택한 매치업'

  return (
    <div className={PAGE_BG}>
      <Modal
        isOpen={confirmOpen}
        onClose={() => {
          if (!purchasing) setConfirmOpen(false)
        }}
        title="결제 전 확인"
        titleClassName="text-lg font-black text-amber-950"
        headerClassName="border-amber-100 bg-gradient-to-r from-amber-50/90 to-orange-50/50"
      >
        <div className="space-y-4">
          <div className="flex gap-3 rounded-xl border border-amber-200/80 bg-amber-50/80 p-4">
            <AlertTriangle className="h-6 w-6 shrink-0 text-amber-600" aria-hidden />
            <div className="min-w-0 space-y-2 text-sm font-semibold leading-relaxed text-amber-950/95">
              <p>
                <span className="font-black text-orange-700 tabular-nums">
                  {formatPoints(MAIN_SPOTLIGHT_1H_COST)} P
                </span>
                가 즉시 차감되며, 되돌릴 수 없어요.
              </p>
              <p className="text-xs font-medium text-amber-900/85">
                메인 홈 스포트라이트에 약 <span className="font-black">6시간</span> 노출됩니다. 전역 최대{' '}
                {slot.maxSlots}슬롯(계정당 {MAIN_SPOTLIGHT_MAX_PER_ACCOUNT}슬롯)이며, 동일 매치업은 중복 노출할 수
                없어요.
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
              className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-black text-white shadow-md transition hover:brightness-105 disabled:opacity-60"
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
          className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-orange-800/90 hover:text-orange-950"
        >
          <ArrowLeft size={18} />
          뒤로
        </button>

        <header className="mb-8 text-center">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-200/90 bg-white/90 px-4 py-1 text-xs font-black text-amber-900 shadow-sm">
            <Gem size={14} className="text-amber-500" />
            Point Reward · Boost
          </p>
          <h1 className="flex flex-wrap items-center justify-center gap-2 text-2xl font-black tracking-tight text-[#22282E] sm:text-3xl">
            <Zap className="h-8 w-8 shrink-0 text-amber-500 sm:h-9 sm:w-9" strokeWidth={2.4} />
            메인 스포트라이트 6h
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm font-semibold leading-relaxed text-slate-600 sm:text-base">
            메인 홈 최상단 스포트라이트에 <span className="text-orange-700">6시간 동안</span> 내 매치업을 노출합니다.{' '}
            동시에 최대 여섯 슬롯까지를 1계정 1슬롯으로 운영되며, 전역에 빈 슬롯이 있고 본인 계정에 사용 가능한 슬롯이 있을 때만 구매할 수 있어요.
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
                'rounded-2xl border border-orange-200/90 bg-white/90 px-5 py-2.5 text-sm font-black tabular-nums text-orange-900',
              )}
            >
              이용료{' '}
              <span className="text-orange-600">{formatPoints(MAIN_SPOTLIGHT_1H_COST)} P</span>
            </div>
            {user && (
              <div
                className={cn(
                  'rounded-2xl border border-violet-200/80 bg-violet-50/90 px-4 py-2 text-xs font-black tabular-nums text-violet-900',
                )}
              >
                전역 {slot.usedSlots}/{slot.maxSlots}
              </div>
            )}
          </div>
        </header>

        {user && slot.slotsFull && (
          <div
            className={cn(
              CARD,
              'mb-6 flex flex-col gap-2 border-amber-200/90 bg-gradient-to-r from-amber-50/95 to-orange-50/80 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5',
            )}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Clock size={20} strokeWidth={2.5} />
              </span>
              <div>
                <p className="text-sm font-black text-amber-950">전역 스포트라이트 슬롯이 모두 찼어요</p>
                <p className="mt-0.5 text-xs font-semibold leading-relaxed text-amber-900/75">
                  여섯 슬롯이 모두 사용 중이에요. 가장 빠른 종료 시각은 약{' '}
                  <span className="font-black text-amber-950">{formatEndsAt(slot.earliestEnd)}</span>
                  입니다.
                </p>
              </div>
            </div>
          </div>
        )}

        {user && accountSlotUsed && (
          <div className={cn(CARD, 'mb-6 border-violet-100/90 bg-violet-50/50 p-4 text-sm font-semibold text-violet-950')}>
            이 계정은 이미 스포트라이트 슬롯을 사용 중이에요(계정당 1슬롯). 종료 후 다시 구매할 수 있어요.
          </div>
        )}

        {!user && (
          <div className={cn(CARD, 'mb-6 p-5 text-center')}>
            <p className="text-sm font-bold text-slate-600">로그인 후 구매할 수 있어요.</p>
            <button
              type="button"
              onClick={() => openLoginModal()}
              className="mt-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-2.5 text-sm font-black text-white shadow-md hover:brightness-105"
            >
              로그인
            </button>
          </div>
        )}

        <section className={cn(CARD, 'p-5 sm:p-6')}>
          <h2 className="flex items-center gap-2 text-base font-black text-[#22282E] sm:text-lg">
            <Sparkles className="h-5 w-5 text-violet-500" />
            노출할 매치업 선택
          </h2>
          <p className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">
            내가 만든 매치업 중, 양쪽이 모두 채워진 활성 매치업만 표시돼요.
          </p>

          {loading ? (
            <ul className="mt-5 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </ul>
          ) : eligibles.length === 0 ? (
            <div className="mt-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 py-10 text-center text-sm font-semibold text-slate-500">
              선택 가능한 매치업이 없어요.
              <br />
              <Link to="/" className="mt-2 inline-block font-black text-orange-600 hover:underline">
                메인에서 매치업 만들기 →
              </Link>
            </div>
          ) : (
            <>
            <ul className="mt-5 space-y-3">
              {visibleEligibles.map((m) => {
                const selected = selectedId === m.id
                const thumb = safeMediaUrl(m.left_thumbnail_url || '')
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => selectMatchup(m.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-all sm:p-4',
                        selected
                          ? 'border-orange-400 bg-gradient-to-r from-orange-50 to-amber-50/80 shadow-md shadow-orange-100/60'
                          : 'border-slate-100 bg-white hover:border-orange-200/80',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                          selected ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-300 bg-white',
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
                        <p className="mt-0.5 text-xs font-semibold text-slate-500">
                          투표 {formatPoints(m.total_votes || 0)} ·{' '}
                          <Link
                            to={`/matchup/${m.id}`}
                            className="text-orange-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            상세 보기
                          </Link>
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

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            disabled={!canPurchase}
            onClick={openPurchaseConfirm}
            className={cn(
              'rounded-2xl px-8 py-4 text-base font-black text-white shadow-lg transition-all sm:min-w-[240px]',
              canPurchase
                ? 'bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 shadow-orange-200/50 hover:brightness-[1.03] active:scale-[0.99]'
                : 'cursor-not-allowed bg-slate-300 text-slate-100 shadow-none',
            )}
          >
            {purchasing ? '처리 중…' : `${formatPoints(MAIN_SPOTLIGHT_1H_COST)} P 결제하고 시작하기`}
          </button>
          <Link
            to="/"
            className={cn(
              'group relative isolate inline-flex min-w-[220px] items-stretch justify-center rounded-3xl p-[2.5px]',
              'bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400 shadow-[0_12px_40px_-10px_rgba(192,38,211,0.45)]',
              'transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_16px_48px_-8px_rgba(34,211,238,0.35)] active:scale-[0.98]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 focus-visible:ring-offset-2',
            )}
          >
            <span
              className={cn(
                'relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-[1.35rem]',
                'bg-gradient-to-br from-white/98 via-fuchsia-50/90 to-cyan-50/85 px-7 py-4 backdrop-blur-md',
                'ring-1 ring-white/80',
              )}
            >
              <span
                className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-fuchsia-400/25 to-cyan-300/20 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                aria-hidden
              />
              <span
                className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-fuchsia-500/[0.06] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                aria-hidden
              />
              <Home
                size={20}
                strokeWidth={2.4}
                className="relative shrink-0 text-fuchsia-600 drop-shadow-sm transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:text-fuchsia-700"
                aria-hidden
              />
              <span className="relative bg-gradient-to-r from-violet-800 via-fuchsia-700 to-sky-600 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-[17px]">
                메인에서 확인
              </span>
              <Sparkles
                size={17}
                className="relative shrink-0 text-amber-500 drop-shadow-[0_0_8px_rgba(251,191,36,0.55)] transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110"
                aria-hidden
              />
              <ArrowRight
                size={18}
                strokeWidth={2.6}
                className="relative shrink-0 text-violet-500 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-violet-600"
                aria-hidden
              />
            </span>
          </Link>
        </div>

        {user && selectedAlreadyActive && (
          <p className="mt-4 text-center text-xs font-bold text-amber-800">
            선택한 매치업은 이미 스포트라이트에 노출 중이에요. 종료 후 다시 구매할 수 있어요.
          </p>
        )}

        {user && accountSlotUsed && !selectedAlreadyActive && (
          <p className="mt-4 text-center text-xs font-bold text-violet-900">
            계정당 1건만 이용할 수 있어요. 기존 노출이 끝난 뒤 다른 매치업을 올릴 수 있어요.
          </p>
        )}

        {user && points < MAIN_SPOTLIGHT_1H_COST && (
          <p className="mt-4 text-center text-xs font-bold text-rose-600">
            포인트가 {formatPoints(MAIN_SPOTLIGHT_1H_COST - points)} P 부족해요.
          </p>
        )}

        <p className="mx-auto mt-10 max-w-md text-center text-[11px] font-medium leading-relaxed text-slate-400">
          결제 즉시 포인트가 차감되며, 노출은 구매 시점부터 6시간입니다. 앱·DB에 따라 표시 시각은 수 초 차이날 수
          있어요.
        </p>
      </div>
    </div>
  )
}
