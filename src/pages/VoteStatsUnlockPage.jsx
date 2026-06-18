import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  ChevronLeft,
  Gem,
  Sparkles,
  Users,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { cn } from '../lib/utils'
import { Modal } from '../components/ui/Modal'
import { safeMediaUrl } from '../lib/sanitize'
import {
  VOTE_STATS_UNLOCK_COST,
  fetchVoteStatsEligibleMatchups,
  fetchVoteStatsUnlockedMatchupIds,
  purchaseVoteStatsUnlockRpc,
} from '../lib/voteStatsUnlock'
import { MainPagination } from '../components/main/MainPagination'

const PAGE_BG = 'bg-gradient-to-br from-teal-50/90 via-cyan-50/35 to-sky-50/45'
const HEADER_GLASS =
  'bg-gradient-to-b from-white/90 via-teal-50/40 to-cyan-50/20 backdrop-blur-md border-b border-teal-100/55'

const ELIGIBLES_PAGE_SIZE = 5

function formatPoints(n) {
  return Number(n || 0).toLocaleString('ko-KR')
}

function isUnlocked(unlocked, matchupId) {
  return unlocked.has(matchupId)
}

export function VoteStatsUnlockPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectId = searchParams.get('matchup') || searchParams.get('id')

  const { user, profile, fetchProfile } = useAuthStore()
  const { showToast, openLoginModal } = useUIStore()
  const points = profile?.points ?? 0

  const [eligibles, setEligibles] = useState([])
  const [unlockedIds, setUnlockedIds] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [purchasing, setPurchasing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [listPage, setListPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = user?.id ? await fetchVoteStatsEligibleMatchups(user.id) : []
      const unlocked = user?.id ? await fetchVoteStatsUnlockedMatchupIds(user.id) : new Set()
      const u = unlocked instanceof Set ? unlocked : new Set(unlocked)
      setEligibles(list)
      setUnlockedIds(new Set(u))
      setSelectedId((prev) => {
        const purchasable = list.filter((m) => !u.has(m.id))
        if (preselectId && purchasable.some((m) => m.id === preselectId)) return preselectId
        if (prev && purchasable.some((m) => m.id === prev)) return prev
        return purchasable[0]?.id ?? null
      })
    } finally {
      setLoading(false)
    }
  }, [user?.id, preselectId])

  useEffect(() => { void load() }, [load])

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
  const selectedPurchasable = selected ? !isUnlocked(unlockedIds, selected.id) : false

  const canPurchase =
    !!user && !!selectedId && selectedPurchasable && !purchasing && !loading &&
    points >= VOTE_STATS_UNLOCK_COST

  const openPurchaseConfirm = () => {
    if (!user) { openLoginModal(); return }
    if (!canPurchase) return
    setConfirmOpen(true)
  }

  const executePurchase = async () => {
    if (!user || !selectedId || !canPurchase) return
    const row = eligibles.find((m) => m.id === selectedId)
    if (!row || isUnlocked(unlockedIds, row.id)) return
    setPurchasing(true)
    try {
      const res = await purchaseVoteStatsUnlockRpc(selectedId)
      if (!res.ok) { showToast(res.error, 'error'); return }
      setConfirmOpen(false)
      showToast('투표 통계 열람권이 적용됐어요! 해당 매치업 상세에서 확인해 보세요 📊', 'success')
      await fetchProfile(user.id, { force: true })
      window.dispatchEvent(new CustomEvent('vics:vote-stats-unlock:updated'))
      await load()
    } catch (e) {
      showToast(e?.message || '구매 중 오류가 났어요', 'error')
    } finally {
      setPurchasing(false)
    }
  }

  return (
    <div className={cn('min-h-screen relative overflow-hidden pb-12', PAGE_BG)}>
      {/* 앰비언트 배경 */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-28 -left-28 w-96 h-96 rounded-full bg-[radial-gradient(circle,_rgba(20,184,166,0.12)_0%,_transparent_70%)] blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-72 h-72 rounded-full bg-[radial-gradient(circle,_rgba(14,165,233,0.11)_0%,_transparent_70%)] blur-3xl" />
        <div className="absolute bottom-20 left-1/4 w-64 h-64 rounded-full bg-[radial-gradient(circle,_rgba(34,211,238,0.09)_0%,_transparent_70%)] blur-3xl" />
      </div>

      {/* 결제 확인 모달 */}
      <Modal
        isOpen={confirmOpen}
        onClose={() => { if (!purchasing) setConfirmOpen(false) }}
        title="결제 전 확인"
        titleClassName="text-lg font-black text-teal-950"
        headerClassName="border-teal-100 bg-gradient-to-r from-teal-50/90 to-cyan-50/50"
      >
        <div className="space-y-4">
          <div className="flex gap-3 rounded-xl border border-teal-200/80 bg-gradient-to-r from-teal-50 to-cyan-50/60 p-4">
            <AlertTriangle className="h-6 w-6 shrink-0 text-teal-600 mt-0.5" aria-hidden />
            <div className="min-w-0 space-y-2 text-sm font-semibold leading-relaxed text-teal-950/95">
              <p>
                <span className="font-black text-cyan-700 tabular-nums">
                  {formatPoints(VOTE_STATS_UNLOCK_COST)} P
                </span>
                가 즉시 차감되며, 되돌릴 수 없어요.
              </p>
              <p className="text-xs font-medium text-teal-900/80">
                해당 매치업에 한해 성별·연령대 등 투표 분석을 열람할 수 있어요. 매치업당 1회만 구매할 수 있어요.
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
              className="rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-5 py-3 text-sm font-black text-white shadow-md transition hover:brightness-105 disabled:opacity-60"
            >
              {purchasing ? '처리 중…' : '확인했어요, 결제하기'}
            </button>
          </div>
        </div>
      </Modal>

      <div className="mx-auto max-w-screen-md relative z-10">
        {/* 스티키 헤더 */}
        <div className={cn('sticky top-0 z-10 px-4 py-3 flex items-center gap-2.5', HEADER_GLASS)}>
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/rewards'))}
            className="flex items-center gap-1 pl-2 pr-3 py-2 -ml-1 rounded-xl bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200/60 hover:from-teal-100 hover:to-cyan-100 transition-all shrink-0 shadow-sm"
          >
            <ChevronLeft size={16} className="text-teal-700" />
            <span className="text-xs font-bold text-teal-700">뒤로</span>
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 shadow-md shadow-teal-300/40">
              <BarChart3 size={13} className="text-white" />
            </span>
            <h1 className="text-base font-black bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-600 bg-clip-text text-transparent tracking-tight truncate">
              투표 통계 열람권
            </h1>
          </div>
        </div>

        <div className="px-4 py-5 space-y-5">

          {/* 히어로 카드 */}
          <div className="rounded-2xl overflow-hidden border border-teal-200/60 bg-white/90 shadow-[0_4px_28px_-10px_rgba(20,184,166,0.18)] backdrop-blur-sm">
            <div className="h-1.5 bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-400" />
            <div className="px-5 py-5 text-center">
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-gradient-to-r from-teal-50 to-cyan-50 px-4 py-1 text-xs font-black text-teal-800 shadow-sm">
                <Gem size={13} className="text-amber-500" />
                Point Reward · Data
              </p>
              <h2 className="flex flex-wrap items-center justify-center gap-2 text-xl font-black tracking-tight mt-1">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 shadow-md shadow-teal-300/40">
                  <BarChart3 size={15} className="text-white" />
                </span>
                <span className="bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-600 bg-clip-text text-transparent sm:text-2xl">
                  투표 통계 열람권
                </span>
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-relaxed text-slate-500">
                작성한 매치업에서{' '}
                <span className="font-black text-teal-600">성별·연령대</span> 등으로 투표가 어떻게 갈렸는지
                확인해 보세요. 매치업당 <span className="font-black text-teal-700">1회</span>만 구매할 수 있어요.
              </p>

              {/* 포인트 뱃지 */}
              <div className="mx-auto mt-4 flex flex-wrap items-center justify-center gap-2">
                <div className="rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50 to-yellow-50/90 px-4 py-2 shadow-sm text-sm font-black tabular-nums">
                  <span className="text-amber-800/80">보유</span>{' '}
                  <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                    {user ? `${formatPoints(points)} P` : '로그인 필요'}
                  </span>
                </div>
                <div className="rounded-2xl border border-teal-200/80 bg-white/90 px-4 py-2 text-sm font-black text-teal-900 shadow-sm">
                  이용료 <span className="text-cyan-600">{formatPoints(VOTE_STATS_UNLOCK_COST)} P</span>
                </div>
              </div>
            </div>
          </div>

          {/* 비로그인 */}
          {!user && (
            <div className="rounded-2xl overflow-hidden border border-teal-100/70 bg-white/90 text-center shadow-sm">
              <div className="h-0.5 bg-gradient-to-r from-teal-400 to-cyan-400" />
              <div className="px-5 py-5">
                <p className="text-sm font-bold text-slate-600">로그인 후 구매할 수 있어요.</p>
                <button
                  type="button"
                  onClick={() => openLoginModal()}
                  className="mt-3 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-2.5 text-sm font-black text-white shadow-md hover:scale-[1.02] transition-all"
                >
                  로그인
                </button>
              </div>
            </div>
          )}

          {/* 매치업 선택 섹션 */}
          <div className="rounded-2xl overflow-hidden border border-teal-100/70 bg-white/90 shadow-[0_4px_22px_-10px_rgba(20,184,166,0.13)] backdrop-blur-sm">
            <div className="h-0.5 bg-gradient-to-r from-teal-400 via-cyan-400 to-sky-400" />
            <div className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 shadow-md mt-0.5">
                  <Users size={14} className="text-white" />
                </span>
                <div>
                  <h2 className="text-base font-black bg-gradient-to-r from-teal-700 to-cyan-700 bg-clip-text text-transparent">
                    열람할 매치업 선택
                  </h2>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">
                    내가 만든 활성 매치업 중 투표가 종료된 것만 표시돼요. 이미 열람권을 산 매치업은 다시 구매할 수 없어요.
                  </p>
                </div>
              </div>

              {loading ? (
                <ul className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <li key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
                  ))}
                </ul>
              ) : eligibles.length === 0 ? (
                <div className="flex flex-col items-center rounded-xl border border-dashed border-teal-200/60 bg-teal-50/30 py-10 text-center">
                  <p className="text-2xl mb-2">📊</p>
                  <p className="text-sm font-semibold text-slate-500">선택 가능한 매치업이 없어요.</p>
                </div>
              ) : (
                <>
                  <ul className="space-y-2.5">
                    {visibleEligibles.map((m) => {
                      const isSelected = selectedId === m.id
                      const thumb = safeMediaUrl(m.left_thumbnail_url || '')
                      const locked = isUnlocked(unlockedIds, m.id)
                      return (
                        <li key={m.id}>
                          <button
                            type="button"
                            disabled={locked}
                            onClick={() => { if (!locked) setSelectedId(m.id) }}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-all',
                              locked && 'cursor-not-allowed opacity-55 border-slate-200 bg-slate-50/80',
                              !locked && isSelected && 'border-teal-400 bg-gradient-to-r from-teal-50 to-cyan-50/70 shadow-md shadow-teal-100/50',
                              !locked && !isSelected && 'border-slate-100 bg-white hover:border-teal-200/70 hover:bg-teal-50/30',
                            )}
                          >
                            <span className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                              locked
                                ? 'border-slate-200 bg-slate-100'
                                : isSelected
                                  ? 'border-teal-500 bg-teal-500 text-white'
                                  : 'border-slate-300 bg-white',
                            )}>
                              {!locked && isSelected && <Check size={12} strokeWidth={3} />}
                            </span>
                            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-100">
                              {thumb ? (
                                <img src={thumb} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full items-center justify-center text-[10px] font-bold text-slate-400">VS</div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-black text-[#22282E]">{m.title}</p>
                              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-slate-400">
                                투표 {formatPoints(m.total_votes || 0)} ·{' '}
                                <Link
                                  to={`/matchup/${m.id}`}
                                  className="text-teal-600 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  상세 보기
                                </Link>
                                {locked && (
                                  <span className="rounded-full bg-gradient-to-r from-teal-100 to-cyan-100 px-2 py-0.5 text-[10px] font-black text-teal-800 ring-1 ring-teal-200/60">
                                    열람권 구매함
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
                    <div className="mt-5 space-y-2">
                      <MainPagination current={listPage} total={totalEligiblePages} onPage={setListPage} />
                      <p className="text-center text-[11px] font-semibold text-slate-400">
                        {eligibles.length}개 중 {(listPage - 1) * ELIGIBLES_PAGE_SIZE + 1}–
                        {Math.min(listPage * ELIGIBLES_PAGE_SIZE, eligibles.length)}번째
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 모두 열람 완료 안내 */}
          {user && !loading && eligibles.length > 0 && eligibles.every((m) => isUnlocked(unlockedIds, m.id)) && (
            <p className="text-center text-xs font-bold text-teal-800 bg-teal-50/80 border border-teal-200/60 rounded-xl px-4 py-3">
              표시된 매치업은 모두 통계 열람권을 구매한 상태예요.
            </p>
          )}

          {/* 포인트 부족 안내 */}
          {user && points < VOTE_STATS_UNLOCK_COST && (
            <p className="text-center text-xs font-bold text-rose-600 bg-rose-50/80 border border-rose-200/60 rounded-xl px-4 py-3">
              포인트가 {formatPoints(VOTE_STATS_UNLOCK_COST - points)} P 부족해요.
            </p>
          )}

          {/* CTA 버튼 */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              disabled={!canPurchase}
              onClick={openPurchaseConfirm}
              className={cn(
                'rounded-2xl px-8 py-4 text-base font-black text-white shadow-lg transition-all sm:min-w-[240px]',
                canPurchase
                  ? 'bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-500 shadow-[0_4px_18px_-4px_rgba(20,184,166,0.55)] hover:scale-[1.02] active:scale-[0.99]'
                  : 'cursor-not-allowed bg-slate-200 text-slate-400 shadow-none',
              )}
            >
              {purchasing ? '처리 중…' : `${formatPoints(VOTE_STATS_UNLOCK_COST)} P 결제하고 열람하기`}
            </button>

            <Link
              to="/matchups"
              className={cn(
                'group relative isolate inline-flex min-w-[220px] items-stretch justify-center rounded-3xl p-[2.5px]',
                'bg-gradient-to-r from-teal-600 via-cyan-500 to-sky-500 shadow-[0_8px_32px_-10px_rgba(20,184,166,0.45)]',
                'transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2',
              )}
            >
              <span className="relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-white/98 via-teal-50/90 to-cyan-50/85 px-7 py-4 backdrop-blur-md ring-1 ring-white/80">
                <span className="pointer-events-none absolute -right-5 -top-7 h-24 w-24 rounded-full bg-gradient-to-br from-teal-300/25 to-cyan-300/20 blur-2xl" aria-hidden />
                <BarChart3 size={18} strokeWidth={2.2} className="relative shrink-0 text-teal-600 transition-transform duration-300 group-hover:-translate-y-0.5" aria-hidden />
                <span className="relative bg-gradient-to-r from-teal-800 via-cyan-700 to-sky-700 bg-clip-text text-base font-black tracking-tight text-transparent">
                  매치업 목록
                </span>
                <Sparkles size={15} className="relative shrink-0 text-cyan-500 drop-shadow-[0_0_6px_rgba(34,211,238,0.5)] transition-transform duration-300 group-hover:rotate-12" aria-hidden />
                <ArrowRight size={16} strokeWidth={2.6} className="relative shrink-0 text-sky-500 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
              </span>
            </Link>
          </div>

          <p className="mx-auto max-w-md text-center text-[11px] font-medium leading-relaxed text-slate-400">
            프로필에 생일·성별이 입력된 투표자만 집계에 반영돼요. 미입력은 &quot;미입력&quot; 구간으로 묶입니다.
          </p>

        </div>
      </div>
    </div>
  )
}
