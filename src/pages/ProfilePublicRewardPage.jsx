import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, Gem, ShieldCheck, Users } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { cn } from '../lib/utils'
import { Modal } from '../components/ui/Modal'
import {
  PROFILE_PUBLIC_UNLOCK_COST,
  purchaseProfilePublicUnlockRpc,
  isProfilePublicUnlockActive,
} from '../lib/profilePublicUnlock'

const PAGE_BG =
  'min-h-[70vh] bg-gradient-to-br from-amber-50/95 via-fuchsia-50/40 to-violet-50/60 px-4 pb-16 pt-2'
const CARD =
  'rounded-2xl border border-pink-100/70 bg-white/95 shadow-[0_4px_28px_-12px_rgba(244,114,182,0.2)] backdrop-blur-[1px]'

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

  const canPurchase = useMemo(() => {
    return Boolean(user && !purchasing && points >= PROFILE_PUBLIC_UNLOCK_COST)
  }, [user, purchasing, points])

  useEffect(() => {
    if (!user?.id) return
    void fetchProfile(user.id)
  }, [user?.id, fetchProfile])

  const openPurchaseConfirm = () => {
    if (!user) {
      openLoginModal()
      return
    }
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
      if (!res.ok) {
        showToast(res.error, 'error')
        return
      }
      setConfirmOpen(false)
      const endLabel = res.expiresAt ? formatDt(res.expiresAt) : ''
      showToast(
        wasExtend
          ? `1개월이 연장됐어요! ${formatPoints(res.pointsSpent)} P가 차감됐어요.${endLabel ? ` 이용 종료: ${endLabel}` : ''}`
          : `프로필 공개 권한이 시작됐어요! ${formatPoints(res.pointsSpent)} P가 차감됐어요.${endLabel ? ` 이용 종료: ${endLabel}` : ''}`,
        'success',
      )
      await fetchProfile(user.id)
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
    <div className={PAGE_BG}>
      <Modal
        isOpen={confirmOpen}
        onClose={() => {
          if (!purchasing) setConfirmOpen(false)
        }}
        title={confirmExtend ? '연장 전 확인' : '결제 전 확인'}
        titleClassName="text-lg font-black text-fuchsia-950"
        headerClassName="border-pink-100 bg-gradient-to-r from-fuchsia-50/90 to-violet-50/50"
        rootClassName="z-[100002]"
      >
        <div className="space-y-4">
          <div className="flex gap-3 rounded-xl border border-fuchsia-200/80 bg-fuchsia-50/80 p-4">
            <AlertTriangle className="h-6 w-6 shrink-0 text-fuchsia-600" aria-hidden />
            <div className="min-w-0 space-y-2 text-sm font-semibold leading-relaxed text-fuchsia-950/95">
              <p>
                <span className="font-black text-fuchsia-700 tabular-nums">
                  {formatPoints(PROFILE_PUBLIC_UNLOCK_COST)} P
                </span>
                가 즉시 차감되며, 되돌릴 수 없어요.
              </p>
              <p className="text-xs font-medium text-fuchsia-900/85">
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

      <div className="mx-auto max-w-screen-md px-0 pt-0 sm:px-1">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/rewards'))}
          className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-fuchsia-700 hover:text-fuchsia-900"
        >
          <ArrowLeft size={18} />
          포인트 리워드로
        </button>

        <header className="mb-8 text-center">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-200/90 bg-white/90 px-4 py-1 text-xs font-black text-amber-900 shadow-sm">
            <Gem size={14} className="text-amber-500" />
            Point Reward · Style
          </p>
          <h1 className="flex flex-wrap items-center justify-center gap-2 text-2xl font-black tracking-tight text-[#22282E] sm:text-3xl">
            <Users className="h-8 w-8 shrink-0 text-fuchsia-600 sm:h-9 sm:w-9" strokeWidth={2.2} />
            프로필 공개 권한
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm font-semibold leading-relaxed text-fuchsia-900/75 sm:text-base">
            닫혀 있던 내 프로필을 포인트로 공개해요. V-Card·딥링크에서 팬이 바로 프로필로 이동할 수 있게 됩니다.
          </p>
          <div className="mx-auto mt-5 flex flex-wrap items-center justify-center gap-3">
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
                'rounded-2xl border border-fuchsia-200/90 bg-white/90 px-5 py-2.5 text-sm font-black tabular-nums text-fuchsia-900',
              )}
            >
              이용료{' '}
              <span className="text-fuchsia-600">{formatPoints(PROFILE_PUBLIC_UNLOCK_COST)} P</span>
              <span className="ml-1 text-[10px] font-bold text-fuchsia-700/80">/ 1개월</span>
            </div>
          </div>
        </header>

        {!user && (
          <div className={cn(CARD, 'mb-6 p-5 text-center')}>
            <p className="text-sm font-bold text-slate-600">로그인 후 구매할 수 있어요.</p>
            <button
              type="button"
              onClick={() => openLoginModal()}
              className="mt-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-2.5 text-sm font-black text-white shadow-md hover:brightness-105"
            >
              로그인
            </button>
          </div>
        )}

        {user && isActive && (
          <div
            className={cn(
              CARD,
              'mb-6 flex flex-col gap-3 border-emerald-200/90 bg-gradient-to-br from-emerald-50/95 to-teal-50/70 p-5 sm:flex-row sm:items-center sm:justify-between',
            )}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <ShieldCheck className="h-6 w-6" strokeWidth={2.4} />
              </span>
              <div>
                <p className="text-sm font-black text-emerald-950">프로필 공개 권한 이용 중</p>
                <p className="mt-1 text-xs font-semibold text-emerald-900/80">
                  이용 종료:{' '}
                  <span className="font-black text-emerald-950">{formatDt(expiresAt)}</span>
                </p>
                {unlockedAt && (
                  <p className="mt-0.5 text-[11px] font-medium text-emerald-900/70">
                    마지막 결제: {formatDt(unlockedAt)}
                  </p>
                )}
              </div>
            </div>
            <Link
              to="/rewards/v-card"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-xs font-black text-emerald-900 shadow-sm hover:bg-emerald-50"
            >
              V-Card로 이동
              <Check className="h-4 w-4" strokeWidth={2.5} />
            </Link>
          </div>
        )}

        {user && hadSubscription && !isActive && (
          <div
            className={cn(
              CARD,
              'mb-6 border-amber-200/90 bg-amber-50/80 p-4 text-sm font-semibold text-amber-950',
            )}
          >
            현재 혜택이 만료됐어요. 아래에서 다시 구매하면 즉시 1개월이 적용돼요.
            {expiresAt && (
              <span className="mt-1 block text-xs font-medium text-amber-900/80">
                직전 이용 종료: {formatDt(expiresAt)}
              </span>
            )}
          </div>
        )}

        <section className={cn(CARD, 'p-5 sm:p-6')}>
          <h2 className="flex items-center gap-2 text-base font-black text-[#22282E] sm:text-lg">
            <ShieldCheck className="h-5 w-5 text-violet-600" strokeWidth={2.2} />
            포함 혜택
          </h2>
          <ul className="mt-4 space-y-2.5 text-sm font-semibold text-slate-700">
            <li className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-600" strokeWidth={2.5} />
              V-Card 스토리 미리보기에서「View Full Profile」버튼 활성화 (QR·딥링크 유입)
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-600" strokeWidth={2.5} />
              프로필 공개 정책에 맞는 범위에서 내 닉네임·프로필로 연결 (서비스 정책에 따름)
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-600" strokeWidth={2.5} />
              1회 구매 후 1개월 유지 (만료 후 재구매·만료 전 연장 가능)
            </li>
          </ul>

          {user && (
            <div className="mt-8 border-t border-pink-100/80 pt-6">
              <button
                type="button"
                disabled={!canPurchase}
                onClick={openPurchaseConfirm}
                className={cn(
                  'w-full rounded-2xl py-4 text-sm font-black text-white shadow-lg transition sm:text-base',
                  'bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 hover:brightness-110',
                  !canPurchase && 'cursor-not-allowed opacity-50 hover:brightness-100',
                )}
              >
                {points < PROFILE_PUBLIC_UNLOCK_COST
                  ? `포인트 부족 (${formatPoints(PROFILE_PUBLIC_UNLOCK_COST)} P 필요)`
                  : isActive
                    ? `${formatPoints(PROFILE_PUBLIC_UNLOCK_COST)} P로 1개월 연장하기`
                    : `${formatPoints(PROFILE_PUBLIC_UNLOCK_COST)} P로 구매하기`}
              </button>
              <p className="mt-2 text-center text-[11px] font-medium text-slate-500">
                구매 전 결제 내용을 확인하는 창이 열려요.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
