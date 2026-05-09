import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, Gem, Palette, Sparkles } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { cn } from '../lib/utils'
import { Modal } from '../components/ui/Modal'
import {
  NEON_PROFILE_THEME_COST,
  NEON_PROFILE_THEMES,
  getNeonThemeDef,
  isNeonProfileThemeBenefitExpired,
  isNeonProfileThemeUnlocked,
  purchaseNeonProfileThemeUnlockRpc,
  setNeonProfileThemeRpc,
} from '../lib/neonProfileTheme'

const PAGE_BG =
  'min-h-[70vh] bg-gradient-to-br from-amber-50/95 via-fuchsia-50/45 to-violet-50/60 px-4 pb-16 pt-2'
const CARD =
  'rounded-2xl border border-fuchsia-100/70 bg-white/95 shadow-[0_4px_28px_-12px_rgba(217,70,239,0.2)] backdrop-blur-[1px]'

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

export function NeonProfileThemePage() {
  const navigate = useNavigate()
  const { user, profile, fetchProfile } = useAuthStore()
  const { showToast, openLoginModal } = useUIStore()
  const points = profile?.points ?? 0

  const benefitActive = isNeonProfileThemeUnlocked(profile)
  const benefitExpired = isNeonProfileThemeBenefitExpired(profile)
  const currentId = useMemo(() => {
    const raw = profile?.neon_profile_theme_id
    const ids = NEON_PROFILE_THEMES.map((t) => t.id)
    const stored = ids.includes(raw) ? raw : 'classic'
    return isNeonProfileThemeUnlocked(profile) ? stored : 'classic'
  }, [profile])

  const [selectedId, setSelectedId] = useState(currentId)
  const [savingTheme, setSavingTheme] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [purchasing, setPurchasing] = useState(false)

  useEffect(() => {
    setSelectedId(currentId)
  }, [currentId])

  useEffect(() => {
    if (!user?.id) return
    void fetchProfile(user.id)
  }, [user?.id, fetchProfile])

  const canPurchase = Boolean(user && !purchasing && points >= NEON_PROFILE_THEME_COST)

  const openPurchaseConfirm = () => {
    if (!user) {
      openLoginModal()
      return
    }
    if (benefitActive) return
    if (points < NEON_PROFILE_THEME_COST) {
      showToast(`포인트가 부족해요 (${formatPoints(NEON_PROFILE_THEME_COST)} P 필요)`, 'error')
      return
    }
    setConfirmOpen(true)
  }

  const executePurchase = useCallback(async () => {
    if (!user?.id || benefitActive) return
    if (points < NEON_PROFILE_THEME_COST) {
      showToast(`포인트가 부족해요 (${formatPoints(NEON_PROFILE_THEME_COST)} P 필요)`, 'error')
      return
    }
    setPurchasing(true)
    try {
      const res = await purchaseNeonProfileThemeUnlockRpc()
      if (!res.ok) {
        showToast(res.error, 'error')
        return
      }
      setConfirmOpen(false)
      const endLabel = res.expiresAt ? formatDt(res.expiresAt) : ''
      showToast(
        `네온 프로필 테마가 적용됐어요! ${formatPoints(res.pointsSpent)} P가 차감됐어요.${endLabel ? ` 이용 종료: ${endLabel}` : ''} 마이페이지에서 바로 반영돼요 ✨`,
        'success',
      )
      await fetchProfile(user.id)
      setSelectedId(res.themeId || 'magenta_pulse')
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vics:neon-profile-theme:updated'))
      }
    } catch (e) {
      showToast(e?.message || '구매 중 오류가 났어요', 'error')
    } finally {
      setPurchasing(false)
    }
  }, [user?.id, benefitActive, points, fetchProfile, showToast])

  const saveTheme = useCallback(async () => {
    if (!user?.id || !benefitActive) return
    if (selectedId === currentId) {
      showToast('이미 적용된 테마예요', 'error')
      return
    }
    setSavingTheme(true)
    try {
      const res = await setNeonProfileThemeRpc(selectedId)
      if (!res.ok) {
        showToast(res.error, 'error')
        return
      }
      showToast('마이페이지 테마가 바뀌었어요!', 'success')
      await fetchProfile(user.id)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vics:neon-profile-theme:updated'))
      }
    } catch (e) {
      showToast(e?.message || '저장 중 오류가 났어요', 'error')
    } finally {
      setSavingTheme(false)
    }
  }, [user?.id, benefitActive, selectedId, currentId, fetchProfile, showToast])

  return (
    <div className={PAGE_BG}>
      <Modal
        isOpen={confirmOpen}
        onClose={() => {
          if (!purchasing) setConfirmOpen(false)
        }}
        title="결제 전 확인"
        titleClassName="text-lg font-black text-fuchsia-950"
        headerClassName="border-fuchsia-100 bg-gradient-to-r from-fuchsia-50/90 to-violet-50/50"
        rootClassName="z-[100002]"
      >
        <div className="space-y-4">
          <div className="flex gap-3 rounded-xl border border-fuchsia-200/80 bg-fuchsia-50/80 p-4">
            <AlertTriangle className="h-6 w-6 shrink-0 text-fuchsia-600" aria-hidden />
            <div className="min-w-0 space-y-2 text-sm font-semibold leading-relaxed text-fuchsia-950/95">
              <p>
                <span className="font-black text-fuchsia-700 tabular-nums">
                  {formatPoints(NEON_PROFILE_THEME_COST)} P
                </span>
                가 즉시 차감되며, 되돌릴 수 없어요.
              </p>
              <p className="text-xs font-medium text-fuchsia-900/85">
                1회 구매 시 결제 시점부터 4개월간 이용이 시작돼요. 그동안 마이페이지 배경·포인트 강조 색을 테마별로 바꿀 수 있어요. 만료 후에는 다시 구매할 수 있어요.
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
            <Palette className="h-8 w-8 shrink-0 text-fuchsia-600 sm:h-9 sm:w-9" strokeWidth={2.2} />
            네온 프로필 테마
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm font-semibold leading-relaxed text-fuchsia-900/75 sm:text-base">
            마이페이지 배경과 포인트 하이라이트에 네온 무드를 입혀요. 한 번 사면 테마는 결제일부터 4개월 동안 무료로 바꿔 가며 쓸 수 있어요.
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
              <span className="text-fuchsia-600">{formatPoints(NEON_PROFILE_THEME_COST)} P</span>
              <span className="ml-1 text-[10px] font-bold text-fuchsia-700/80">/ 4개월 이용</span>
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

        {user && benefitExpired && (
          <div
            className={cn(
              CARD,
              'mb-6 border-amber-200/90 bg-amber-50/85 p-4 text-sm font-semibold text-amber-950',
            )}
          >
            네온 테마 이용 기간이 끝났어요. 다시 구매하면 결제일부터 4개월이 새로 적용돼요.
            {profile?.neon_profile_theme_expires_at && (
              <span className="mt-1 block text-xs font-medium text-amber-900/85">
                직전 이용 종료: {formatDt(profile.neon_profile_theme_expires_at)}
              </span>
            )}
          </div>
        )}

        {user && benefitActive && (
          <div
            className={cn(
              CARD,
              'mb-6 flex flex-col gap-3 border-emerald-200/90 bg-gradient-to-br from-emerald-50/95 to-teal-50/70 p-5 sm:flex-row sm:items-center sm:justify-between',
            )}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Sparkles className="h-6 w-6" strokeWidth={2.4} />
              </span>
              <div>
                <p className="text-sm font-black text-emerald-950">네온 프로필 테마 이용 중</p>
                <p className="mt-1 text-xs font-semibold text-emerald-900/80">
                  현재 테마:{' '}
                  <span className="font-black text-emerald-950">{getNeonThemeDef(currentId).label}</span>
                </p>
                {profile?.neon_profile_theme_expires_at && (
                  <p className="mt-1 text-[11px] font-bold text-emerald-900/75">
                    이용 종료: <span className="text-emerald-950">{formatDt(profile.neon_profile_theme_expires_at)}</span>
                  </p>
                )}
              </div>
            </div>
            <Link
              to="/mypage"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-xs font-black text-emerald-900 shadow-sm hover:bg-emerald-50"
            >
              마이페이지에서 확인
              <Check className="h-4 w-4" strokeWidth={2.5} />
            </Link>
          </div>
        )}

        <section className={cn(CARD, 'p-5 sm:p-6')}>
          <h2 className="flex items-center gap-2 text-base font-black text-[#22282E] sm:text-lg">
            <Palette className="h-5 w-5 text-violet-600" strokeWidth={2.2} />
            테마 미리보기
          </h2>
          <p className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">
            이용 기간(결제일부터 4개월) 동안 아래에서 원하는 무드를 고르고 저장하면 마이페이지에 바로 반영돼요.
          </p>

          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {NEON_PROFILE_THEMES.map((t) => {
              const sel = selectedId === t.id
              const disabledOption = !benefitActive && t.id !== 'classic'
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    disabled={disabledOption}
                    onClick={() => {
                      if (disabledOption) return
                      setSelectedId(t.id)
                    }}
                    className={cn(
                      'flex w-full flex-col overflow-hidden rounded-2xl border-2 text-left transition-all',
                      disabledOption && 'cursor-not-allowed opacity-45',
                      sel && benefitActive && 'border-fuchsia-500 shadow-lg shadow-fuchsia-200/50 ring-2 ring-fuchsia-300/40',
                      !sel && 'border-slate-100 hover:border-fuchsia-200',
                    )}
                  >
                    <div className={cn('h-24 w-full', t.previewWrap)} />
                    <div className="flex items-start gap-2 border-t border-slate-100/80 bg-white/95 p-3">
                      <span
                        className={cn(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                          sel && benefitActive ? 'border-fuchsia-500 bg-fuchsia-500 text-white' : 'border-slate-300 bg-white',
                        )}
                      >
                        {sel && benefitActive ? <Check size={12} strokeWidth={3} /> : null}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-[#22282E]">{t.label}</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{t.subtitle}</p>
                        {!benefitActive && t.id !== 'classic' && (
                          <p className="mt-1 text-[10px] font-bold text-amber-700">구매 후 선택 가능</p>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>

          {user && !benefitActive && (
            <div className="mt-8 border-t border-fuchsia-100/80 pt-6">
              <button
                type="button"
                disabled={!canPurchase}
                onClick={openPurchaseConfirm}
                className={cn(
                  'w-full rounded-2xl py-4 text-sm font-black text-white shadow-lg transition sm:text-base',
                  'bg-gradient-to-r from-fuchsia-600 via-violet-600 to-cyan-600 hover:brightness-110',
                  !canPurchase && 'cursor-not-allowed opacity-50 hover:brightness-100',
                )}
              >
                {points < NEON_PROFILE_THEME_COST
                  ? `포인트 부족 (${formatPoints(NEON_PROFILE_THEME_COST)} P 필요)`
                  : `${formatPoints(NEON_PROFILE_THEME_COST)} P로 4개월 이용 시작하기`}
              </button>
              <p className="mt-2 text-center text-[11px] font-medium text-slate-500">
                구매 전 결제 내용을 확인하는 창이 열려요.
              </p>
            </div>
          )}

          {user && benefitActive && (
            <div className="mt-8 border-t border-fuchsia-100/80 pt-6">
              <button
                type="button"
                disabled={savingTheme || selectedId === currentId}
                onClick={() => void saveTheme()}
                className={cn(
                  'w-full rounded-2xl py-4 text-sm font-black text-white shadow-lg transition sm:text-base',
                  'bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 hover:brightness-110',
                  (savingTheme || selectedId === currentId) && 'cursor-not-allowed opacity-50',
                )}
              >
                {savingTheme ? '저장 중…' : '이 테마로 마이페이지에 적용하기'}
              </button>
            </div>
          )}
        </section>

        <section className={cn(CARD, 'mt-6 p-5 sm:p-6')}>
          <h2 className="text-base font-black text-[#22282E] sm:text-lg">포함 혜택</h2>
          <ul className="mt-4 space-y-2.5 text-sm font-semibold text-slate-700">
            <li className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-600" strokeWidth={2.5} />
              마이페이지 배경 그라데이션·프로필 카드 네온 링
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-600" strokeWidth={2.5} />
              My 등급 영역의 포인트 숫자 강조 색 (테마 연동)
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-600" strokeWidth={2.5} />
              클래식 파스텔 포함 5종 — 4개월 동안 무료 전환 · 만료 후 재구매
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}
