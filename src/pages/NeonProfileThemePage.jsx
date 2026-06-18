import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronLeft,
  Gem,
  Palette,
  Sparkles,
} from 'lucide-react'
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

const PAGE_BG = 'bg-gradient-to-br from-fuchsia-50/90 via-violet-50/35 to-indigo-50/45'
const HEADER_GLASS =
  'bg-gradient-to-b from-white/90 via-fuchsia-50/40 to-violet-50/20 backdrop-blur-md border-b border-fuchsia-100/55'

const BENEFITS = [
  '마이페이지 배경 그라데이션·프로필 카드 네온 링',
  'My 등급 영역의 포인트 숫자 강조 색 (테마 연동)',
  '클래식 파스텔 포함 5종 — 4개월 동안 무료 전환 · 만료 후 재구매',
]

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

  useEffect(() => { setSelectedId(currentId) }, [currentId])

  const canPurchase = Boolean(user && !purchasing && points >= NEON_PROFILE_THEME_COST)

  const openPurchaseConfirm = () => {
    if (!user) { openLoginModal(); return }
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
      if (!res.ok) { showToast(res.error, 'error'); return }
      setConfirmOpen(false)
      const endLabel = res.expiresAt ? formatDt(res.expiresAt) : ''
      showToast(
        `네온 프로필 테마가 적용됐어요! ${formatPoints(res.pointsSpent)} P가 차감됐어요.${endLabel ? ` 이용 종료: ${endLabel}` : ''} 마이페이지에서 바로 반영돼요 ✨`,
        'success',
      )
      await fetchProfile(user.id, { force: true })
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
    if (selectedId === currentId) { showToast('이미 적용된 테마예요', 'error'); return }
    setSavingTheme(true)
    try {
      const res = await setNeonProfileThemeRpc(selectedId)
      if (!res.ok) { showToast(res.error, 'error'); return }
      showToast('마이페이지 테마가 바뀌었어요!', 'success')
      await fetchProfile(user.id, { force: true })
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
    <div className={cn('min-h-screen relative overflow-hidden pb-12', PAGE_BG)}>
      {/* 앰비언트 배경 */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-28 -left-28 w-96 h-96 rounded-full bg-[radial-gradient(circle,_rgba(217,70,239,0.13)_0%,_transparent_70%)] blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-72 h-72 rounded-full bg-[radial-gradient(circle,_rgba(139,92,246,0.12)_0%,_transparent_70%)] blur-3xl" />
        <div className="absolute bottom-20 left-1/4 w-64 h-64 rounded-full bg-[radial-gradient(circle,_rgba(99,102,241,0.09)_0%,_transparent_70%)] blur-3xl" />
      </div>

      {/* 결제 확인 모달 */}
      <Modal
        isOpen={confirmOpen}
        onClose={() => { if (!purchasing) setConfirmOpen(false) }}
        title="결제 전 확인"
        titleClassName="text-lg font-black text-fuchsia-950"
        headerClassName="border-fuchsia-100 bg-gradient-to-r from-fuchsia-50/90 to-violet-50/50"
        rootClassName="z-[100002]"
      >
        <div className="space-y-4">
          <div className="flex gap-3 rounded-xl border border-fuchsia-200/80 bg-gradient-to-r from-fuchsia-50 to-violet-50/60 p-4">
            <AlertTriangle className="h-6 w-6 shrink-0 text-fuchsia-600 mt-0.5" aria-hidden />
            <div className="min-w-0 space-y-2 text-sm font-semibold leading-relaxed text-fuchsia-950/95">
              <p>
                <span className="font-black text-fuchsia-700 tabular-nums">
                  {formatPoints(NEON_PROFILE_THEME_COST)} P
                </span>
                가 즉시 차감되며, 되돌릴 수 없어요.
              </p>
              <p className="text-xs font-medium text-fuchsia-900/80">
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

      <div className="mx-auto max-w-screen-md relative z-10">
        {/* 스티키 헤더 */}
        <div className={cn('sticky top-0 z-10 px-4 py-3 flex items-center gap-2.5', HEADER_GLASS)}>
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/rewards'))}
            className="flex items-center gap-1 pl-2 pr-3 py-2 -ml-1 rounded-xl bg-gradient-to-r from-fuchsia-50 to-violet-50 border border-fuchsia-200/60 hover:from-fuchsia-100 hover:to-violet-100 transition-all shrink-0 shadow-sm"
          >
            <ChevronLeft size={16} className="text-fuchsia-700" />
            <span className="text-xs font-bold text-fuchsia-700">뒤로</span>
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-md shadow-fuchsia-300/40">
              <Palette size={13} className="text-white" />
            </span>
            <h1 className="text-base font-black bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 bg-clip-text text-transparent tracking-tight truncate">
              네온 프로필 테마
            </h1>
          </div>
        </div>

        <div className="px-4 py-5 space-y-5">

          {/* 히어로 카드 */}
          <div className="rounded-2xl overflow-hidden border border-fuchsia-200/60 bg-white/90 shadow-[0_4px_28px_-10px_rgba(217,70,239,0.18)] backdrop-blur-sm">
            <div className="h-1.5 bg-gradient-to-r from-fuchsia-500 via-violet-500 to-indigo-500" />
            <div className="px-5 py-5 text-center">
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-1 text-xs font-black text-amber-800 shadow-sm">
                <Gem size={13} className="text-amber-500" />
                Point Reward · Style
              </p>
              <h2 className="flex flex-wrap items-center justify-center gap-2 text-xl font-black tracking-tight mt-1">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-md shadow-fuchsia-300/40">
                  <Palette size={15} className="text-white" />
                </span>
                <span className="bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 bg-clip-text text-transparent sm:text-2xl">
                  네온 프로필 테마
                </span>
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-sm font-semibold leading-relaxed text-fuchsia-900/60">
                마이페이지 배경과 포인트 하이라이트에 네온 무드를 입혀요. 한 번 사면 테마는 결제일부터{' '}
                <span className="font-black text-fuchsia-700">4개월</span> 동안 무료로 바꿔 가며 쓸 수 있어요.
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
                  <span className="text-fuchsia-600">{formatPoints(NEON_PROFILE_THEME_COST)} P</span>
                  <span className="ml-1 text-[10px] font-bold text-fuchsia-700/70">/ 4개월</span>
                </div>
              </div>
            </div>
          </div>

          {/* 비로그인 */}
          {!user && (
            <div className="rounded-2xl overflow-hidden border border-fuchsia-100/70 bg-white/90 text-center shadow-sm">
              <div className="h-0.5 bg-gradient-to-r from-fuchsia-400 to-violet-400" />
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

          {/* 만료 상태 */}
          {user && benefitExpired && (
            <div className="rounded-2xl overflow-hidden border border-amber-200/70 shadow-sm">
              <div className="h-0.5 bg-gradient-to-r from-amber-400 to-orange-400" />
              <div className="bg-amber-50/80 p-4 text-sm font-semibold text-amber-950">
                네온 테마 이용 기간이 끝났어요. 다시 구매하면 결제일부터 4개월이 새로 적용돼요.
                {profile?.neon_profile_theme_expires_at && (
                  <span className="mt-1 block text-xs font-medium text-amber-900/80">
                    직전 이용 종료: {formatDt(profile.neon_profile_theme_expires_at)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 이용 중 상태 */}
          {user && benefitActive && (
            <div className="rounded-2xl overflow-hidden border border-emerald-200/70 shadow-sm">
              <div className="h-0.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />
              <div className="flex flex-col gap-3 bg-gradient-to-br from-emerald-50/95 to-teal-50/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-md shadow-emerald-300/40">
                    <Sparkles size={18} className="text-white" strokeWidth={2.4} />
                  </span>
                  <div>
                    <p className="text-sm font-black text-emerald-950">네온 프로필 테마 이용 중</p>
                    <p className="mt-1 text-xs font-semibold text-emerald-900/75">
                      현재 테마:{' '}
                      <span className="font-black text-emerald-950">{getNeonThemeDef(currentId).label}</span>
                    </p>
                    {profile?.neon_profile_theme_expires_at && (
                      <p className="mt-0.5 text-[11px] font-bold text-emerald-900/65">
                        이용 종료: {formatDt(profile.neon_profile_theme_expires_at)}
                      </p>
                    )}
                  </div>
                </div>
                <Link
                  to="/mypage"
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-emerald-300/80 bg-white px-4 py-2.5 text-xs font-black text-emerald-900 shadow-sm hover:bg-emerald-50 transition-all hover:scale-[1.02]"
                >
                  마이페이지에서 확인
                  <ArrowRight size={13} strokeWidth={2.5} />
                </Link>
              </div>
            </div>
          )}

          {/* 테마 미리보기 섹션 */}
          <div className="rounded-2xl overflow-hidden border border-violet-100/70 bg-white/90 shadow-[0_4px_22px_-10px_rgba(139,92,246,0.13)] backdrop-blur-sm">
            <div className="h-0.5 bg-gradient-to-r from-fuchsia-400 via-violet-400 to-indigo-400" />
            <div className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md mt-0.5">
                  <Sparkles size={14} className="text-white" />
                </span>
                <div>
                  <h2 className="text-base font-black bg-gradient-to-r from-violet-700 to-indigo-700 bg-clip-text text-transparent">
                    테마 미리보기
                  </h2>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">
                    이용 기간(결제일부터 4개월) 동안 아래에서 원하는 무드를 고르고 저장하면 마이페이지에 바로 반영돼요.
                  </p>
                </div>
              </div>

              <ul className="grid gap-3 sm:grid-cols-2">
                {NEON_PROFILE_THEMES.map((t) => {
                  const sel = selectedId === t.id
                  const disabledOption = !benefitActive && t.id !== 'classic'
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        disabled={disabledOption}
                        onClick={() => { if (!disabledOption) setSelectedId(t.id) }}
                        className={cn(
                          'flex w-full flex-col overflow-hidden rounded-2xl border-2 text-left transition-all',
                          disabledOption && 'cursor-not-allowed opacity-45',
                          sel && benefitActive && 'border-fuchsia-500 shadow-lg shadow-fuchsia-200/40 ring-2 ring-fuchsia-300/35',
                          sel && !benefitActive && 'border-slate-300',
                          !sel && 'border-slate-100 hover:border-fuchsia-200/70',
                        )}
                      >
                        <div className={cn('h-24 w-full', t.previewWrap)} />
                        <div className="flex items-start gap-2 border-t border-slate-100/70 bg-white/95 p-3">
                          <span className={cn(
                            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                            sel && benefitActive ? 'border-fuchsia-500 bg-fuchsia-500 text-white' : 'border-slate-300 bg-white',
                          )}>
                            {sel && benefitActive && <Check size={12} strokeWidth={3} />}
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

              {/* 구매 버튼 (미구매) */}
              {user && !benefitActive && (
                <div className="mt-6 border-t border-fuchsia-100/70 pt-5">
                  <button
                    type="button"
                    disabled={!canPurchase}
                    onClick={openPurchaseConfirm}
                    className={cn(
                      'w-full rounded-2xl py-4 text-sm font-black text-white shadow-lg transition-all sm:text-base',
                      canPurchase
                        ? 'bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 shadow-[0_4px_18px_-4px_rgba(139,92,246,0.55)] hover:scale-[1.01] active:scale-[0.99]'
                        : 'cursor-not-allowed bg-slate-200 text-slate-400 shadow-none',
                    )}
                  >
                    {points < NEON_PROFILE_THEME_COST
                      ? `포인트 부족 (${formatPoints(NEON_PROFILE_THEME_COST)} P 필요)`
                      : `${formatPoints(NEON_PROFILE_THEME_COST)} P로 4개월 이용 시작하기`}
                  </button>
                  <p className="mt-2 text-center text-[11px] font-medium text-slate-400">
                    구매 전 결제 내용을 확인하는 창이 열려요.
                  </p>
                </div>
              )}

              {/* 테마 저장 버튼 (이용 중) */}
              {user && benefitActive && (
                <div className="mt-6 border-t border-fuchsia-100/70 pt-5">
                  <button
                    type="button"
                    disabled={savingTheme || selectedId === currentId}
                    onClick={() => void saveTheme()}
                    className={cn(
                      'w-full rounded-2xl py-4 text-sm font-black text-white shadow-lg transition-all sm:text-base',
                      !savingTheme && selectedId !== currentId
                        ? 'bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 shadow-[0_4px_18px_-4px_rgba(192,38,211,0.5)] hover:scale-[1.01] active:scale-[0.99]'
                        : 'cursor-not-allowed bg-slate-200 text-slate-400 shadow-none',
                    )}
                  >
                    {savingTheme ? '저장 중…' : '이 테마로 마이페이지에 적용하기'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 혜택 안내 카드 */}
          <div className="rounded-2xl overflow-hidden border border-violet-100/70 bg-white/90 shadow-[0_4px_20px_-8px_rgba(139,92,246,0.12)] backdrop-blur-sm">
            <div className="h-0.5 bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400" />
            <div className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-md mt-0.5">
                  <Palette size={14} className="text-white" />
                </span>
                <h2 className="text-base font-black bg-gradient-to-r from-fuchsia-700 to-violet-700 bg-clip-text text-transparent mt-1">
                  포함 혜택
                </h2>
              </div>
              <ul className="space-y-3">
                {BENEFITS.map((benefit, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-xl border border-violet-100/60 bg-gradient-to-r from-violet-50/50 to-fuchsia-50/30 px-3.5 py-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-500 mt-0.5">
                      <Check size={11} className="text-white" strokeWidth={3} />
                    </span>
                    <p className="text-sm font-semibold text-slate-700 leading-snug">{benefit}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
