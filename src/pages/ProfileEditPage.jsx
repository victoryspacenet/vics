import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Check, X, Loader2, ChevronRight,
  LogOut, Trash2, Shield, Award, Pencil, Lock,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { checkNicknameTaken } from '../lib/nicknameTakenApi'
import { safeMediaUrl, parseBannedWordError, parseNicknameSeasonLimitError } from '../lib/sanitize'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { cn } from '../lib/utils'
import { ACTIVITY_BADGES, isActivityBadgeEarned } from '../lib/featuredBadges'
import { getTier, tierAtLeast, TIER_MIN_HOLD_POINTS } from '../lib/tiers'
import { fandomTierHasGoldProfileGlow, fandomTierHasSilverProfileGlow, fandomTierFromClaps } from '../lib/fandomTiers'
import { FANDOM_POINTS_PER_CLAP } from '../lib/fandomPoints'
import { FandomGoldExclusiveEmojiBar } from '../components/fandom/FandomGoldExclusiveEmojiBar'

/** MZ 파스텔 — 마이페이지와 동일 계열 */
const PAGE_BG =
  'bg-gradient-to-br from-rose-50/98 via-fuchsia-50/35 to-cyan-50/50'
const SECTION_CARD =
  'rounded-2xl border border-pink-100/50 bg-white/92 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px]'
const HEADER_GLASS =
  'bg-gradient-to-b from-white/90 via-rose-50/40 to-fuchsia-50/20 backdrop-blur-md border-b border-pink-100/55'

const ALL_BADGES = [...ACTIVITY_BADGES]

// ── 확인 모달 ────────────────────────────────────────────────────────
function ConfirmModal({ open, title, desc, confirmLabel, danger, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 z-50 bg-fuchsia-950/25 backdrop-blur-sm" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div
          className="rounded-3xl p-6 w-full max-w-sm shadow-2xl shadow-pink-200/40 animate-fade-in-up border border-pink-100/60
            bg-gradient-to-br from-white via-rose-50/50 to-fuchsia-50/40 ring-2 ring-white/80"
        >
          <p className="text-base font-black text-fuchsia-950 text-center mb-2">{title}</p>
          <p className="text-sm text-fuchsia-800/60 text-center leading-relaxed mb-6">{desc}</p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 border border-pink-200/80 rounded-2xl text-sm font-bold text-fuchsia-800/80 hover:bg-pink-50/90 transition-colors"
            >
              취소
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 py-3 rounded-2xl text-sm font-black transition-all ${
                danger
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white hover:brightness-105 shadow-md shadow-fuchsia-300/40'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── 배지 선택 Bottom Sheet ────────────────────────────────────────────
function BadgeSheet({
  open,
  onClose,
  selected,
  onSelect,
  showToast,
  profile,
  commentCount,
  canPickFeaturedBadge,
}) {
  if (!open) return null
  const extras = { commentCount: commentCount ?? 0 }
  const tierLocked = !canPickFeaturedBadge
  return (
    <>
      <div className="fixed inset-0 z-40 bg-fuchsia-950/20 backdrop-blur-sm" aria-hidden />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 max-w-screen-sm mx-auto"
        style={{ animation: 'fade-in-up 0.3s cubic-bezier(0.16,1,0.3,1) both' }}
      >
        <div
          className="rounded-t-3xl px-4 pt-3 pb-8 max-h-[75vh] flex flex-col border-t border-pink-100/60
            bg-gradient-to-b from-white/98 via-rose-50/60 to-fuchsia-50/50 shadow-[0_-8px_40px_-12px_rgba(244,114,182,0.35)]"
        >
          <div className="w-10 h-1 bg-pink-200/80 rounded-full mx-auto mb-4 flex-shrink-0" />
          <div className="mb-1 flex flex-shrink-0 items-center gap-2">
            <div className="h-9 w-9 shrink-0" aria-hidden />
            <p className="min-w-0 flex-1 text-center text-sm font-black text-fuchsia-950">🏆 대표 배지 선택</p>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-pink-200/80 bg-white text-fuchsia-900/55 shadow-sm transition hover:bg-pink-50/90 hover:text-fuchsia-900"
            >
              <X size={18} strokeWidth={2.25} />
            </button>
          </div>
          <p className="text-xs text-fuchsia-700/55 text-center mb-4 flex-shrink-0">
            랭킹, 매치업 카드에 닉네임 옆에 노출됩니다
          </p>

          {tierLocked && (
            <div className="mb-3 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 text-center text-[11px] font-semibold text-amber-950/90 leading-snug">
              Star(⭐) 등급 이상부터 활동 대표 배지를 설정할 수 있어요.
            </div>
          )}

          <div className="overflow-y-auto flex-1">
            <p className="text-[11px] font-black text-pink-400 uppercase tracking-wider px-1 mb-2">활동 배지</p>
            <div className="grid grid-cols-4 gap-2">
              {ACTIVITY_BADGES.map((badge) => {
                const earned = profile ? isActivityBadgeEarned(badge.id, profile, extras) : false
                return (
                  <BadgeTile
                    key={badge.id}
                    badge={badge}
                    isSelected={selected === badge.id}
                    earned={earned}
                    tierLocked={tierLocked}
                    onSelect={() => {
                      onSelect(badge.id)
                      onClose()
                      showToast(`${badge.emoji} ${badge.name}을(를) 대표 배지로 선택했어요`, 'success')
                    }}
                    onLocked={() => showToast('아직 획득하지 않은 배지예요', 'info')}
                    onTierLocked={() =>
                      showToast('Star(⭐) 등급 이상부터 대표 배지로 설정할 수 있어요', 'info')
                    }
                  />
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                if (tierLocked) {
                  showToast('Star(⭐) 등급 이상부터 대표 배지를 해제·변경할 수 있어요', 'info')
                  return
                }
                onSelect(null)
                onClose()
              }}
              className={`w-full mt-3 py-3 rounded-2xl text-sm font-bold transition-colors ${
                tierLocked
                  ? 'cursor-not-allowed border border-pink-200 bg-neutral-100 text-gray-400'
                  : selected === null
                    ? 'bg-gradient-to-r from-fuchsia-100 to-pink-100 text-fuchsia-950 border-2 border-fuchsia-400/60'
                    : 'bg-white text-fuchsia-900 border-2 border-fuchsia-300 shadow-sm hover:bg-fuchsia-50 hover:border-fuchsia-400'
              }`}
            >
              배지 표시 안 함
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function BadgeTile({ badge, isSelected, earned, tierLocked, onSelect, onLocked, onTierLocked }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (tierLocked) {
          onTierLocked?.()
          return
        }
        if (earned) onSelect()
        else onLocked?.()
      }}
      className={cn(
        'relative flex flex-col items-center gap-1 p-2.5 rounded-2xl border-2 transition-all',
        (!earned || tierLocked) && 'cursor-not-allowed opacity-[0.58] grayscale-[0.25]',
        earned && isSelected && !tierLocked &&
          'border-fuchsia-500 bg-gradient-to-br from-pink-50 to-fuchsia-50 shadow-md shadow-pink-200/40 scale-105',
        earned && !isSelected && !tierLocked &&
          'border-transparent bg-white/70 hover:border-pink-200/80 hover:bg-rose-50/60',
        !earned && isSelected &&
          'border-amber-400/80 bg-amber-50/90 shadow-sm',
        !earned && !isSelected && 'border-transparent bg-neutral-100/95',
      )}
    >
      {(!earned || tierLocked) && (
        <span
          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-fuchsia-950/12 text-fuchsia-900/75"
          aria-hidden
        >
          <Lock className="h-2.5 w-2.5" strokeWidth={2.5} />
        </span>
      )}
      <span className="text-2xl">{badge.emoji}</span>
      <span className="text-[10px] font-black text-fuchsia-950 text-center leading-tight">{badge.name}</span>
      {isSelected && earned && !tierLocked && (
        <div className="h-0.5 w-3 rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500" />
      )}
    </button>
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────
export function ProfileEditPage() {
  const navigate = useNavigate()
  const { user, profile, fetchProfile, updateProfile, setProfile, signOut } = useAuthStore()
  const { showToast } = useUIStore()

  const [nickname,      setNickname]      = useState('')
  const [bio,           setBio]           = useState('')
  const [featuredBadge, setFeaturedBadge] = useState(null)
  const [nicknameStatus, setNicknameStatus] = useState('idle')
  const [saving,        setSaving]        = useState(false)
  const [badgeSheet,    setBadgeSheet]    = useState(false)
  const [logoutModal,   setLogoutModal]   = useState(false)
  const [commentCount,  setCommentCount]  = useState(0)
  const [currentSeasonNumber, setCurrentSeasonNumber] = useState(null)

  const nickCheckTimer = useRef(null)
  /** profile이 fetch될 때마다 동기화하면 저장 전 로컬 배지/입력이 덮어씌워짐 → 마운트당 1회만 서버값 주입 */
  const profileFormSyncedRef = useRef(false)
  const bioTextareaRef = useRef(null)

  // 팬덤 티어는 fandom_points 역산 (profile.fandom_tier 스테일 방지)
  const myFandomTier = useMemo(() => {
    const claps = Math.floor((profile?.fandom_points ?? 0) / FANDOM_POINTS_PER_CLAP)
    return fandomTierFromClaps(claps)
  }, [profile?.fandom_points])

  const goldProfileGlow = useMemo(
    () => fandomTierHasGoldProfileGlow(profile?.fandom_tier),
    [profile?.fandom_tier],
  )
  const silverProfileGlow = useMemo(
    () => fandomTierHasSilverProfileGlow(profile?.fandom_tier),
    [profile?.fandom_tier],
  )

  const matchupTier = useMemo(() => getTier(profile || {}, {}), [profile])
  const canPickFeaturedBadge = tierAtLeast(matchupTier, 'star')

  const nickLockedThisSeason = useMemo(() => {
    if (currentSeasonNumber == null || !profile?.id) return false
    const n = Number(profile.nickname_changed_season_number)
    if (!Number.isFinite(n)) return false
    return n === currentSeasonNumber
  }, [profile?.id, profile?.nickname_changed_season_number, currentSeasonNumber])

  /** Star 미만이면 서버 대표 배지 값으로만 유지 (변경·저장 불가) */
  useEffect(() => {
    if (!profile) return
    if (!tierAtLeast(getTier(profile, {}), 'star')) {
      setFeaturedBadge(profile.featured_badge ?? null)
    }
  }, [profile])

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      const { count, error } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
      if (!cancelled && !error) setCommentCount(count ?? 0)
    })()
    return () => { cancelled = true }
  }, [user?.id])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('seasons')
        .select('number')
        .order('number', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled || error) return
      if (data?.number != null && Number.isFinite(Number(data.number))) {
        setCurrentSeasonNumber(Number(data.number))
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }
  }, [user, navigate])

  useEffect(() => {
    if (!profile?.id || profileFormSyncedRef.current) return
    profileFormSyncedRef.current = true
    setNickname([...(profile.nickname || '')].slice(0, 12).join(''))
    setBio([...(profile.bio || '')].slice(0, 30).join(''))
    setFeaturedBadge(profile.featured_badge ?? null)
  }, [profile])

  useEffect(() => {
    return () => {
      profileFormSyncedRef.current = false
    }
  }, [])

  // 닉네임 중복 검사 (디바운스 600ms)
  const handleNicknameChange = (val) => {
    const capped = [...val].slice(0, 12).join('')
    setNickname(capped)
    clearTimeout(nickCheckTimer.current)
    const trimmed = capped.trim()
    if (!trimmed || trimmed.length < 2) { setNicknameStatus('idle'); return }
    if (trimmed === profile?.nickname)  { setNicknameStatus('same'); return }
    setNicknameStatus('checking')
    nickCheckTimer.current = setTimeout(async () => {
      const { taken, error } = await checkNicknameTaken(trimmed)
      if (error) {
        setNicknameStatus('idle')
        showToast('닉네임 확인에 실패했어요. 잠시 후 다시 시도해 주세요.', 'error')
        return
      }
      setNicknameStatus(taken ? 'dup' : 'ok')
    }, 600)
  }

  const handleBioChange = (val) => {
    setBio([...val].slice(0, 30).join(''))
  }

  // 변경 여부 감지
  const hasChanges = () => {
    const trimmed = nickname.trim()
    const nextBadge = featuredBadge ?? null
    const prevBadge = profile?.featured_badge ?? null
    const badgeChanged = nextBadge !== prevBadge
    const badgeSavable = badgeChanged && canPickFeaturedBadge
    const nickChanged = trimmed !== (profile?.nickname || '')
    const nickAttemptBlocked = nickLockedThisSeason && nickChanged
    const effectiveNickChanged = nickChanged && !nickAttemptBlocked
    const bioChanged = (bio || '') !== (profile?.bio || '')
    const textChanged = effectiveNickChanged || bioChanged

    // 대표 배지만 바꾼 경우: 닉네임 중복 검사 중이어도 저장 가능해야 함 (Star 이상만)
    if (badgeSavable && !textChanged) return true

    if (!nickAttemptBlocked && (nicknameStatus === 'dup' || nicknameStatus === 'checking')) return false
    if (!nickAttemptBlocked && (trimmed.length < 2 || trimmed.length > 12)) return false
    return badgeSavable || textChanged
  }

  // 저장
  const handleSave = async () => {
    if (!hasChanges() || saving || !user?.id) return
    setSaving(true)
    try {
      const trimmed = nickname.trim()
      const nextBadge = featuredBadge ?? null
      const prevBadge = profile?.featured_badge ?? null
      const badgeChanged = nextBadge !== prevBadge
      const nickChanged = trimmed !== (profile?.nickname || '')
      const bioChanged = (bio || '') !== (profile?.bio || '')
      const textChanged = nickChanged || bioChanged
      const nicknameForSave = nickLockedThisSeason ? (profile?.nickname || '').trim() : trimmed

      if (badgeChanged && !canPickFeaturedBadge) {
        showToast('Star(⭐) 등급 이상부터 대표 배지를 변경할 수 있어요', 'error')
        return
      }

      // 대표 배지만 변경: featured_badge 컬럼만 PATCH (닉네임/금칙어 트리거와 분리, 통계 불일치로 저장 막히는 일 방지)
      if (badgeChanged && !textChanged) {
        const { data, error } = await supabase
          .from('profiles')
          .update({
            featured_badge: nextBadge,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
          .select('*')
          .single()

        if (error) {
          const bannedMsg = parseBannedWordError(error)
          showToast(
            bannedMsg || error.message || '대표 배지 저장에 실패했어요',
            'error',
          )
          return
        }
        if (data) setProfile(data)
        showToast('대표 배지가 저장되었습니다! ✓', 'success')
        navigate('/mypage')
        void fetchProfile(user.id)
        return
      }

      const { data, error } = await updateProfile({
        nickname: nicknameForSave,
        bio: bio.trim() || null,
        featured_badge: canPickFeaturedBadge ? nextBadge : prevBadge,
      })
      if (error) {
        const seasonMsg = parseNicknameSeasonLimitError(error)
        const bannedMsg = parseBannedWordError(error)
        showToast(seasonMsg || bannedMsg || error.message || '저장에 실패했어요. 다시 시도해주세요', 'error')
        return
      }
      if (!data) {
        showToast('저장 결과를 확인할 수 없어요. 다시 시도해주세요', 'error')
        return
      }
      showToast('프로필이 업데이트되었습니다! ✓', 'success')
      navigate('/mypage')
      void fetchProfile(user.id)
    } catch {
      showToast('저장 중 오류가 발생했어요', 'error')
    } finally {
      setSaving(false)
    }
  }

  // 로그아웃
  const handleLogout = async () => {
    setLogoutModal(false)
    await signOut()
    navigate('/')
    showToast('로그아웃 되었습니다', 'success')
  }

  const nicknameHint = {
    idle:     null,
    checking: { text: '중복 확인 중…',             color: 'text-fuchsia-600/70' },
    ok:       { text: '✓ 사용 가능한 닉네임이에요', color: 'text-emerald-500' },
    dup:      { text: '✗ 이미 사용 중인 닉네임이에요', color: 'text-red-500' },
    same:     { text: '현재 닉네임과 동일해요',     color: 'text-fuchsia-600/65' },
  }[nicknameStatus]

  const selectedBadgeObj = featuredBadge ? ALL_BADGES.find((b) => b.id === featuredBadge) : null

  return (
    <div className={cn('max-w-screen-sm mx-auto min-h-screen', PAGE_BG)}>

      {/* ── 상단 바 ── */}
      <div className={cn('sticky top-0 z-30 flex items-center justify-between h-14 px-4', HEADER_GLASS)}>
        <button
          onClick={() => navigate('/mypage')}
          className="p-2 -ml-2 rounded-xl hover:bg-pink-100/60 transition-colors"
        >
          <ArrowLeft size={20} className="text-fuchsia-900" />
        </button>
        <h1 className="text-base font-black text-fuchsia-950">프로필 편집</h1>
        <button
          onClick={handleSave}
          disabled={!hasChanges() || saving}
          className={`px-4 py-1.5 text-sm font-black rounded-full transition-all ${
            hasChanges() && !saving
              ? 'bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white hover:brightness-105 active:scale-95 shadow-md shadow-fuchsia-300/35'
              : 'bg-fuchsia-100/60 text-fuchsia-400/80 cursor-not-allowed'
          }`}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : '완료'}
        </button>
      </div>

      <div className="px-4 py-4 space-y-3 pb-8">

        {/* ── 아바타 영역 → 사진 수정 페이지로 이동 ── */}
        <div
          className={cn(
            `${SECTION_CARD} p-5 flex flex-col items-center gap-3`,
            goldProfileGlow && 'vics-fandom-gold-profile-header',
            silverProfileGlow && 'vics-fandom-silver-profile-header',
          )}
        >
          <div
            className="relative w-fit max-w-full cursor-pointer group"
            onClick={() => navigate('/mypage/edit/image')}
          >
            {goldProfileGlow ? (
              <div className="vics-fandom-gold-avatar-wrap">
                <div className="relative h-20 w-20 overflow-hidden rounded-full bg-amber-100/80">
                  {profile?.avatar_url
                    ? <img src={safeMediaUrl(profile.avatar_url)} alt="아바타" className="h-full w-full object-cover" />
                    : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-200 to-amber-500">
                        <span className="text-3xl font-black text-amber-900">
                          {profile?.nickname?.[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                  }
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Pencil size={20} className="text-white" />
                  </div>
                </div>
              </div>
            ) : silverProfileGlow ? (
              <div className="vics-fandom-silver-avatar-wrap">
                <div className="relative h-20 w-20 overflow-hidden rounded-full bg-slate-100/70">
                  {profile?.avatar_url
                    ? <img src={safeMediaUrl(profile.avatar_url)} alt="아바타" className="h-full w-full object-cover" />
                    : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300">
                        <span className="text-3xl font-black text-slate-600">
                          {profile?.nickname?.[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                  }
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Pencil size={20} className="text-white" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative h-20 w-20 overflow-hidden rounded-full ring-4 ring-fuchsia-300/50 ring-offset-2 ring-offset-rose-50/80">
                {profile?.avatar_url
                  ? <img src={safeMediaUrl(profile.avatar_url)} alt="아바타" className="h-full w-full object-cover" />
                  : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-pink-100 to-fuchsia-200">
                      <span className="text-3xl font-black text-fuchsia-700">
                        {profile?.nickname?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                }
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Pencil size={20} className="text-white" />
                </div>
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-7 h-7 bg-gradient-to-br from-fuchsia-600 to-pink-500 rounded-full flex items-center justify-center shadow-md shadow-fuchsia-300/50">
              <Pencil size={13} className="text-white" />
            </div>
          </div>
          <p className="text-xs text-fuchsia-700/55">사진을 탭하면 이미지 수정 화면으로 이동해요</p>
        </div>

        {/* ── 닉네임 수정 ── */}
        <div className={`${SECTION_CARD} overflow-hidden`}>
          <div className="flex items-center gap-2 px-5 pt-4 pb-2">
            <Pencil size={14} className="text-fuchsia-500" />
            <span className="text-sm font-black text-fuchsia-950">닉네임 수정</span>
          </div>
          <div className="px-4 pb-4">
            {nickLockedThisSeason && (
              <p className="mb-2 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-[11px] font-semibold leading-snug text-amber-950/90">
                이번 시즌에는 닉네임을 이미 변경했어요. 시즌이 바뀌면 다시 변경할 수 있어요.
              </p>
            )}
            <div className="relative">
              <input
                type="text"
                value={nickname}
                onChange={(e) => handleNicknameChange(e.target.value)}
                readOnly={nickLockedThisSeason}
                maxLength={12}
                placeholder="닉네임 입력 (2~12자)"
                className={`w-full px-4 py-3 pr-16 border rounded-xl text-sm outline-none transition-colors bg-white/80 ${
                  nickLockedThisSeason
                    ? 'cursor-not-allowed border-amber-200/80 bg-amber-50/50 text-fuchsia-900/70'
                    : nicknameStatus === 'dup'
                    ? 'border-red-300 bg-red-50 focus:border-red-400'
                    : nicknameStatus === 'ok'
                    ? 'border-emerald-300 bg-emerald-50 focus:border-emerald-400'
                    : 'border-pink-200/80 focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200/50'
                }`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {nicknameStatus === 'checking' && <Loader2 size={14} className="text-fuchsia-400 animate-spin" />}
                {nicknameStatus === 'ok'       && <Check   size={14} className="text-emerald-500" />}
                {nicknameStatus === 'dup'      && <X       size={14} className="text-red-500" />}
                <span className="text-xs text-fuchsia-700/45 tabular-nums">{nickname.length}/12</span>
              </div>
            </div>
            {nicknameHint && (
              <p className={`text-xs mt-1.5 px-1 ${nicknameHint.color}`}>{nicknameHint.text}</p>
            )}
          </div>
        </div>

        {/* ── 한 줄 소개 ── */}
        <div className={`${SECTION_CARD} overflow-hidden`}>
          <div className="flex items-center gap-2 px-5 pt-4 pb-2">
            <span className="text-sm">💬</span>
            <span className="text-sm font-black text-fuchsia-950">한 줄 소개</span>
          </div>
          <div className="space-y-2 px-4 pb-4">
            <div className="relative">
              <textarea
                ref={bioTextareaRef}
                value={bio}
                onChange={(e) => handleBioChange(e.target.value)}
                maxLength={30}
                rows={2}
                placeholder="나를 표현하는 한 마디..."
                className="w-full px-4 py-3 border border-pink-200/80 rounded-xl text-sm outline-none bg-white/80 focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200/45 transition-colors resize-none placeholder:text-fuchsia-300/80"
              />
              <span className="absolute right-3 bottom-3 text-[10px] text-fuchsia-700/45 tabular-nums">
                {bio.length}/30
              </span>
            </div>
            <FandomGoldExclusiveEmojiBar
              tierId={myFandomTier}
              textareaRef={bioTextareaRef}
              value={bio}
              onChange={handleBioChange}
              maxLength={30}
              onTooLong={() => showToast('한 줄 소개는 30자까지 입력할 수 있어요', 'error')}
            />
          </div>
        </div>

        {/* ── 대표 배지 설정 ── */}
        <div className={`${SECTION_CARD} overflow-hidden`}>
          <div className="flex items-center gap-2 px-5 pt-4 pb-2">
            <Award size={14} className="text-amber-500" />
            <span className="text-sm font-black text-fuchsia-950">대표 배지 설정</span>
          </div>
          <button
            type="button"
            onClick={() => setBadgeSheet(true)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-pink-50/50 transition-colors border-t border-pink-100/50"
          >
            <div className="flex items-center gap-3">
              {selectedBadgeObj
                ? <>
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-50 to-orange-50 rounded-full flex items-center justify-center text-xl flex-shrink-0 border border-amber-100/60">
                      {selectedBadgeObj.emoji}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-fuchsia-950">{selectedBadgeObj.name}</p>
                      <p className="text-xs text-fuchsia-700/55">{selectedBadgeObj.desc}</p>
                    </div>
                  </>
                : <>
                    <div className="w-10 h-10 bg-fuchsia-50 rounded-full flex items-center justify-center flex-shrink-0 border border-pink-100/60">
                      <Award size={18} className="text-fuchsia-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-fuchsia-800/70">배지 선택하기</p>
                      <p className="text-xs text-fuchsia-700/50">획득한 배지 중 노출할 것을 선택해요</p>
                    </div>
                  </>
              }
            </div>
            <ChevronRight size={16} className="text-fuchsia-400 flex-shrink-0" />
          </button>
          {!canPickFeaturedBadge && (
            <p className="px-5 pb-2 text-[10px] text-amber-900/85 leading-relaxed">
              Star(⭐) 이상부터 활동 대표 배지를 고를 수 있어요. (매치업 생성 10회 및 투표 20회, 보유 P{' '}
              {TIER_MIN_HOLD_POINTS.star.toLocaleString('ko-KR')} 이상)
            </p>
          )}
        </div>

        {/* ── 계정 이메일 ── */}
        <div className={`${SECTION_CARD} px-5 py-4`}>
          <div className="flex items-center gap-2 mb-2">
            <Shield size={14} className="text-sky-500" />
            <span className="text-sm font-black text-fuchsia-950">계정 이메일</span>
          </div>
          <p className="text-sm text-fuchsia-900/70 pl-1">{user?.email}</p>
          {user?.app_metadata?.provider !== 'email' && (
            <p className="text-xs text-fuchsia-700/50 mt-1 pl-1">소셜 로그인 계정은 이메일을 변경할 수 없어요</p>
          )}
        </div>

        {/* ── 로그아웃 / 회원탈퇴 ── */}
        <div className={`${SECTION_CARD} overflow-hidden`}>
          <button
            onClick={() => setLogoutModal(true)}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-rose-50/50 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-100 to-pink-100 flex items-center justify-center border border-pink-200/50">
              <LogOut size={15} className="text-rose-500" />
            </div>
            <span className="text-sm font-bold text-fuchsia-900/85">로그아웃</span>
          </button>
          <div className="h-px bg-pink-100/60 mx-4" />
          <button
            onClick={() => navigate('/mypage/delete')}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-red-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <Trash2 size={15} className="text-red-500" />
            </div>
            <span className="text-sm font-bold text-red-500">회원 탈퇴</span>
            <ChevronRight size={14} className="text-red-300 ml-auto" />
          </button>
        </div>

        <p className="text-[10px] text-fuchsia-300/80 text-center py-2">VICS v1.0.0</p>
      </div>

      <BadgeSheet
        open={badgeSheet}
        onClose={() => setBadgeSheet(false)}
        selected={featuredBadge}
        onSelect={setFeaturedBadge}
        showToast={showToast}
        profile={profile}
        commentCount={commentCount}
        canPickFeaturedBadge={canPickFeaturedBadge}
      />
      <ConfirmModal open={logoutModal} title="로그아웃 하시겠어요?"
        desc="로그아웃 후에도 언제든지 다시 로그인할 수 있어요."
        confirmLabel="로그아웃" onConfirm={handleLogout} onCancel={() => setLogoutModal(false)} />
    </div>
  )
}
