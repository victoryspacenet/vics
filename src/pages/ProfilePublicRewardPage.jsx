import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronLeft,
  Gem,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { cn } from '../lib/utils'
import { Modal } from '../components/ui/Modal'
import {
  PROFILE_PUBLIC_UNLOCK_COST,
  purchaseProfilePublicUnlockRpc,
  isProfilePublicUnlockActive,
} from '../lib/profilePublicUnlock'

const PAGE_BG = 'bg-gradient-to-br from-pink-50/90 via-fuchsia-50/35 to-violet-50/50'
const HEADER_GLASS =
  'bg-gradient-to-b from-white/90 via-pink-50/40 to-fuchsia-50/20 backdrop-blur-md border-b border-pink-100/55'

function formatPoints(n) {
  return Number(n || 0).toLocaleString('ko-KR')
}

function formatDt(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

const BENEFITS = [
  'V-Card 스토리 미리보기에서「View Full Profile」버튼 활성화 (QR·딥링크 유입)',
  '프로필 공개 정책에 맞는 범위에서 내 닉네임·프로필로 연결 (서비스 정책에 따름)',
  '1회 구매 후 1개월 유지 (만료 후 재구매·만료 전 연장 가능)',
]

export function ProfilePublicRewardPage() {
  const navigate = useNavigate()
  const { user, profile, fetchProfile } = useAuthStore()
  const { showToast, openLoginModal } = useUIStore()
  const points = profile?.points ?? 0

  const unlockedAt = profile?.profile_public_unlocked_at ?? null
  const expiresAt = profile?.profile_public_expires_at ?? null
  const isActive = isProfilePublicUnlockActive(profile)
  const hadSubscription = Boolean(unlockedAt || expiresAt)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmExtend, setConfirmExtend] = useState(false)
  const confirmExtendRef = useRef(false)
  const [purchasing, setPurchasing] = useState(false)

  const canPurchase = useMemo(
    () => Boolean(user && !purchasing && points >= PROFILE_PUBLIC_UNLOCK_COST),
    [user, purchasing, points],
  )

  const openPurchaseConfirm = () => {
    if (!user) { openLoginModal(); return }
    if (points < PROFILE_PUBLIC_UNLOCK_COST) {
      showToast(`포인트가 부족해요 (${formatPoints(PROFILE_PUBLIC_UNLOCK_COST)} P 필요)`, 'error')
      return
    }
    confirmExtendRef.current = isActive
    setConfirmExtend(isActive)
    setConfirmOpen(true)
  }

  const executePurchase = useCallback(async () => {
    if (!user?.id) return
    if (points < PROFILE_PUBLIC_UNLOCK_COST) {
      showToast(`포인트가 부족해요 (${formatPoints(PROFILE_PUBLIC_UNLOCK_COST)} P 필요)`, 'error')
      return
    }
    const wasExtend = confirmExtendRef.current
    setPurchasing(true)
    try {
      const res = await purchaseProfilePublicUnlockRpc()
      if (!res.ok) { showToast(res.error, 'error'); return }
      setConfirmOpen(false)
      const endLabel = res.expiresAt ? formatDt(res.expiresAt) : ''
      showToast(
        wasExtend
          ? `1개월이 연장됐어요! ${formatPoints(res.pointsSpent)} P가 차감됐어요.${endLabel ? ` 이용 종료: ${endLabel}` : ''}`
          : `프로필 공개 권한이 시작됐어요! ${formatPoints(res.pointsSpent)} P가 차감됐어요.${endLabel ? ` 이용 종료: ${endLabel}` : ''}`,
        'success',
      )
      await fetchProfile(user.id, { force: true })
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vics:profile-public:updated'))
      }
    } catch (e) {
      showToast(e?.message || '구매 중 오류가 났어요', 'error')
    } finally {
      setPurchasing(false)
    }
  }, [user?.id, points, fetchProfile, showToast])

  return (
    <div className={cn('min-h-screen relative overflow-hidden pb-12', PAGE_BG)}>
      {/* 앰비언트 배경 */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-28 -left-28 w-96 h-96 rounded-full bg-[radial-gradient(circle,_rgba(244,114,182,0.12)_0%,_transparent_70%)] blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-72 h-72 rounded-full bg-[radial-gradient(circle,_rgba(192,38,211,0.11)_0%,_transparent_70%)] blur-3xl" />
        <div className="absolute bottom-20 left-1/4 w-64 h-64 rounded-full bg-[radial-gradient(circle,_rgba(139,92,246,0.09)_0%,_transparent_70%)] blur-3xl" />
      </div>

      {/* 결제 확인 모달 */}
      <Modal
        isOpen={confirmOpen}
        onClose={() => { if (!purchasing) setConfirmOpen(false) }}
        title={confirmExtend ? '연장 전 확인' : '결제 전 확인'}
        titleClassName="text-lg font-black text-fuchsia-950"
        headerClassName="border-pink-100 bg-gradient-to-r from-fuchsia-50/90 to-violet-50/50"
        rootClassName="z-[100002]"
      >
        <div className="space-y-4">
          <div className="flex gap-3 rounded-xl border border-fuchsia-200/80 bg-gradient-to-r from-fuchsia-50 to-violet-50/60 p-4">
            <AlertTriangle className="h-6 w-6 shrink-0 text-fuchsia-600 mt-0.5" aria-hidden />
            <div className="min-w-0 space-y-2 text-sm font-semibold leading-relaxed text-fuchsia-950/95">
              <p>
                <span className="font-black text-fuchsia-700 tabular-nums">
                  {formatPoints(PROFILE_PUBLIC_UNLOCK_COST)} P
                </span>
                가 즉시 차감되며, 되돌릴 수 없어요.
              </p>
              <p className="text-xs font-medium text-fuchsia-900/80">
                {confirmExtend
                  ? '아직 만료 전이면「현재 이용 종료 시각」에 1개월이 더해져요. 이미 만료된 경우에는 오늘부터 1개월이에요.'
                  : '결제 시점부터 1개월간 V-Card「View Full Profile」등 공개 혜택이 적용돼요. 만료 후에는 다시 구매할 수 있어요.'}
              </p>
            </div>
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
              className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-3 text-sm font-black text-white shadow-md transition hover:brightness-105 disabled:opacity-60"
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
            className="flex items-center gap-1 pl-2 pr-3 py-2 -ml-1 rounded-xl bg-gradient-to-r from-pink-50 to-fuchsia-50 border border-pink-200/60 hover:from-pink-100 hover:to-fuchsia-100 transition-all shrink-0 shadow-sm"
          >
            <ChevronLeft size={16} className="text-fuchsia-700" />
            <span className="text-xs font-bold text-fuchsia-700">뒤로</span>
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-fuchsia-600 shadow-md shadow-pink-300/40">
              <Users size={13} className="text-white" />
            </span>
            <h1 className="text-base font-black bg-gradient-to-r from-pink-600 via-fuchsia-600 to-violet-600 bg-clip-text text-transparent tracking-tight truncate">
              프로필 공개 권한
            </h1>
          </div>
        </div>

        <div className="px-4 py-5 space-y-5">

          {/* 히어로 카드 */}
          <div className="rounded-2xl overflow-hidden border border-pink-200/60 bg-white/90 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-sm">
            <div className="h-1.5 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500" />
            <div className="px-5 py-5 text-center">
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-1 text-xs font-black text-amber-800 shadow-sm">
                <Gem size={13} className="text-amber-500" />
                Point Reward · Style
              </p>
              <h2 className="flex flex-wrap items-center justify-center gap-2 text-xl font-black tracking-tight mt-1">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-fuchsia-600 shadow-md shadow-pink-300/40">
                  <Users size={15} className="text-white" />
                </span>
                <span className="bg-gradient-to-r from-pink-600 via-fuchsia-600 to-violet-600 bg-clip-text text-transparent sm:text-2xl">
                  프로필 공개 권한
                </span>
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-sm font-semibold leading-relaxed text-fuchsia-900/60">
                닫혀 있던 내 프로필을 포인트로 공개해요. V-Card·딥링크에서 팬이 바로 프로필로 이동할 수 있게 됩니다.
              </p>

              {/* 포인트 & 이용료 뱃지 */}
              <div className="mx-auto mt-4 flex flex-wrap items-center justify-center gap-2">
                <div className="rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50 to-yellow-50/90 px-4 py-2 shadow-sm text-sm font-black tabular-nums">
                  <span className="text-amber-800/80">보유</span>{' '}
                  <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                    {user ? `${formatPoints(points)} P` : '로그인 필요'}
                  </span>
                </div>
                <div className="rounded-2xl border border-fuchsia-200/80 bg-white/90 px-4 py-2 text-sm font-black text-fuchsia-900 shadow-sm">
                  이용료{' '}
                  <span className="text-fuchsia-600">{formatPoints(PROFILE_PUBLIC_UNLOCK_COST)} P</span>
                  <span className="ml-1 text-[10px] font-bold text-fuchsia-700/70">/ 1개월</span>
                </div>
              </div>
            </div>
          </div>

          {/* 비로그인 */}
          {!user && (
            <div className="rounded-2xl overflow-hidden border border-pink-100/70 bg-white/90 text-center shadow-sm">
              <div className="h-0.5 bg-gradient-to-r from-pink-400 to-fuchsia-400" />
              <div className="px-5 py-5">
                <p className="text-sm font-bold text-slate-600">로그인 후 구매할 수 있어요.</p>
                <button
                  type="button"
                  onClick={() => openLoginModal()}
                  className="mt-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-2.5 text-sm font-black text-white shadow-md hover:scale-[1.02] transition-all"
                >
                  로그인
                </button>
              </div>
            </div>
          )}

          {/* 이용 중 상태 */}
          {user && isActive && (
            <div className="rounded-2xl overflow-hidden border border-emerald-200/70 shadow-sm">
              <div className="h-0.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />
              <div className="flex flex-col gap-3 bg-gradient-to-br from-emerald-50/95 to-teal-50/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-md shadow-emerald-300/40">
                    <ShieldCheck size={18} className="text-white" strokeWidth={2.4} />
                  </span>
                  <div>
                    <p className="text-sm font-black text-emerald-950">프로필 공개 권한 이용 중</p>
                    <p className="mt-1 text-xs font-semibold text-emerald-900/75">
                      이용 종료:{' '}
                      <span className="font-black text-emerald-950">{formatDt(expiresAt)}</span>
                    </p>
                    {unlockedAt && (
                      <p className="mt-0.5 text-[11px] font-medium text-emerald-900/60">
                        마지막 결제: {formatDt(unlockedAt)}
                      </p>
                    )}
                  </div>
                </div>
                <Link
                  to="/rewards/v-card"
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-emerald-300/80 bg-white px-4 py-2.5 text-xs font-black text-emerald-900 shadow-sm hover:bg-emerald-50 transition-all hover:scale-[1.02]"
                >
                  V-Card로 이동
                  <ArrowRight size={13} strokeWidth={2.5} />
                </Link>
              </div>
            </div>
          )}

          {/* 만료 상태 */}
          {user && hadSubscription && !isActive && (
            <div className="rounded-2xl overflow-hidden border border-amber-200/70 shadow-sm">
              <div className="h-0.5 bg-gradient-to-r from-amber-400 to-orange-400" />
              <div className="bg-amber-50/80 p-4 text-sm font-semibold text-amber-950">
                현재 혜택이 만료됐어요. 아래에서 다시 구매하면 즉시 1개월이 적용돼요.
                {expiresAt && (
                  <span className="mt-1 block text-xs font-medium text-amber-900/75">
                    직전 이용 종료: {formatDt(expiresAt)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 혜택 안내 카드 */}
          <div className="rounded-2xl overflow-hidden border border-violet-100/70 bg-white/90 shadow-[0_4px_22px_-10px_rgba(139,92,246,0.13)] backdrop-blur-sm">
            <div className="h-0.5 bg-gradient-to-r from-pink-400 via-fuchsia-400 to-violet-400" />
            <div className="p-5">
              <div className="flex items-start gap-3 mb-5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-md mt-0.5">
                  <ShieldCheck size={14} className="text-white" />
                </span>
                <h2 className="text-base font-black bg-gradient-to-r from-violet-700 to-fuchsia-700 bg-clip-text text-transparent mt-1">
                  포함 혜택
                </h2>
              </div>

              <ul className="space-y-3">
                {BENEFITS.map((benefit, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-xl border border-fuchsia-100/60 bg-gradient-to-r from-fuchsia-50/50 to-violet-50/30 px-3.5 py-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-500 mt-0.5">
                      <Check size={11} className="text-white" strokeWidth={3} />
                    </span>
                    <p className="text-sm font-semibold text-slate-700 leading-snug">{benefit}</p>
                  </li>
                ))}
              </ul>

              {user && (
                <div className="mt-6 border-t border-pink-100/70 pt-5">
                  <button
                    type="button"
                    disabled={!canPurchase}
                    onClick={openPurchaseConfirm}
                    className={cn(
                      'w-full rounded-2xl py-4 text-sm font-black text-white shadow-lg transition-all sm:text-base',
                      canPurchase
                        ? 'bg-gradient-to-r from-pink-600 via-fuchsia-600 to-violet-600 shadow-[0_4px_18px_-4px_rgba(192,38,211,0.55)] hover:scale-[1.01] active:scale-[0.99]'
                        : 'cursor-not-allowed bg-slate-200 text-slate-400 shadow-none',
                    )}
                  >
                    {points < PROFILE_PUBLIC_UNLOCK_COST
                      ? `포인트 부족 (${formatPoints(PROFILE_PUBLIC_UNLOCK_COST)} P 필요)`
                      : isActive
                        ? `${formatPoints(PROFILE_PUBLIC_UNLOCK_COST)} P로 1개월 연장하기`
                        : `${formatPoints(PROFILE_PUBLIC_UNLOCK_COST)} P로 구매하기`}
                  </button>
                  <p className="mt-2 text-center text-[11px] font-medium text-slate-400">
                    구매 전 결제 내용을 확인하는 창이 열려요.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
