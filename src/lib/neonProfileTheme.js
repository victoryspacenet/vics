import { supabase } from './supabase'
import { cn } from './utils'

/** Point Reward「네온 프로필 테마」가격 (리워드 카드와 동일) */
export const NEON_PROFILE_THEME_COST = 3500

/** 서버·클라이언트 공통 허용 테마 id */
export const NEON_THEME_IDS = ['classic', 'magenta_pulse', 'violet_drift', 'sunset_arc', 'cyber_mint']

/**
 * @typedef {object} NeonThemeDef
 * @property {string} id
 * @property {string} label
 * @property {string} subtitle
 * @property {string} previewWrap — 미리보기 카드 배경
 * @property {string} pageWrap — 마이페이지 최외곽 (PAGE_BG 대체)
 * @property {string} headerCard — 프로필 헤더 카드 추가 ring/shadow
 * @property {string} avatarRing — 아바타 링
 * @property {string} pointsAccent — 레벨 블록 포인트 숫자
 */

/** @type {NeonThemeDef[]} */
export const NEON_PROFILE_THEMES = [
  {
    id: 'classic',
    label: '클래식 파스텔',
    subtitle: '기본 MZ 톤 (구매 후에도 선택 가능)',
    previewWrap: 'bg-gradient-to-br from-rose-100/95 via-fuchsia-100/50 to-cyan-100/60',
    pageWrap:
      'bg-gradient-to-br from-rose-50/98 via-fuchsia-50/35 to-cyan-50/50',
    headerCard: 'border-pink-100/50 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)]',
    avatarRing: 'ring-4 ring-fuchsia-400/45 ring-offset-2 ring-offset-rose-50/80',
    pointsAccent: 'text-[#22282E]',
  },
  {
    id: 'magenta_pulse',
    label: '마젠타 펄스',
    subtitle: '핑크·시안 네온 글로우',
    previewWrap: 'bg-gradient-to-br from-fuchsia-600 via-pink-500 to-cyan-400',
    pageWrap:
      'bg-gradient-to-br from-fuchsia-950/95 via-purple-950/90 to-slate-950 min-h-[200px]',
    headerCard:
      'border-fuchsia-500/40 bg-gradient-to-br from-fuchsia-950/50 via-slate-900/40 to-cyan-950/30 shadow-[0_0_40px_-8px_rgba(236,72,153,0.45)]',
    avatarRing: 'ring-2 ring-fuchsia-400 shadow-[0_0_28px_rgba(244,114,182,0.75)] ring-offset-slate-900/80',
    pointsAccent: 'text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-300 to-cyan-300 font-black',
  },
  {
    id: 'violet_drift',
    label: '바이올렛 드리프트',
    subtitle: '딥 바이올렛·라임 악센트',
    previewWrap: 'bg-gradient-to-br from-violet-700 via-indigo-800 to-lime-400',
    pageWrap: 'bg-gradient-to-br from-indigo-950 via-violet-950 to-slate-950',
    headerCard:
      'border-violet-400/35 bg-gradient-to-br from-violet-950/55 to-indigo-950/40 shadow-[0_0_36px_-6px_rgba(167,139,250,0.4)]',
    avatarRing: 'ring-2 ring-lime-300/90 shadow-[0_0_24px_rgba(190,242,100,0.55)] ring-offset-violet-950/80',
    pointsAccent: 'text-lime-200',
  },
  {
    id: 'sunset_arc',
    label: '선셋 아크',
    subtitle: '오렌지·로즈 골든 아워',
    previewWrap: 'bg-gradient-to-br from-orange-500 via-rose-500 to-amber-300',
    pageWrap: 'bg-gradient-to-br from-orange-950/95 via-rose-950 to-amber-950/90',
    headerCard:
      'border-orange-400/40 bg-gradient-to-br from-orange-950/45 to-rose-950/35 shadow-[0_0_32px_-8px_rgba(251,146,60,0.45)]',
    avatarRing: 'ring-2 ring-amber-300 shadow-[0_0_26px_rgba(251,191,36,0.55)] ring-offset-rose-950/70',
    pointsAccent: 'text-amber-200',
  },
  {
    id: 'cyber_mint',
    label: '사이버 민트',
    subtitle: '틸·에메랄드 사이버펑크',
    previewWrap: 'bg-gradient-to-br from-teal-500 via-emerald-600 to-cyan-300',
    pageWrap: 'bg-gradient-to-br from-teal-950 via-emerald-950 to-slate-950',
    headerCard:
      'border-teal-400/40 bg-gradient-to-br from-teal-950/50 to-emerald-950/40 shadow-[0_0_34px_-6px_rgba(45,212,191,0.4)]',
    avatarRing: 'ring-2 ring-cyan-300 shadow-[0_0_26px_rgba(34,211,238,0.5)] ring-offset-teal-950/80',
    pointsAccent: 'text-cyan-200',
  },
]

/** @param {string} id */
export function getNeonThemeDef(id) {
  return NEON_PROFILE_THEMES.find((t) => t.id === id) || NEON_PROFILE_THEMES[0]
}

const MYPAGE_SECTION_CARD =
  'rounded-2xl border border-pink-100/50 bg-white/92 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px]'

/**
 * 마이페이지용 — 구매·선택 상태에 따라 셸 클래스
 * @param {object | null | undefined} profile
 */
export function getMyPageNeonShell(profile) {
  const unlocked = isNeonProfileThemeUnlocked(profile)
  if (!unlocked) {
    const c = NEON_PROFILE_THEMES[0]
    return {
      unlocked: false,
      themeId: 'classic',
      pageWrap: c.pageWrap,
      headerSection: cn(MYPAGE_SECTION_CARD, 'p-6 mb-6'),
      avatarRing: c.avatarRing,
      pointsAccent: c.pointsAccent,
      nicknameClass: 'text-[#22282E]',
      subtextClass: 'text-fuchsia-700/55',
      bioClass: 'text-fuchsia-900/55',
    }
  }
  const raw = profile?.neon_profile_theme_id
  const id = NEON_THEME_IDS.includes(raw) ? raw : 'classic'
  const t = getNeonThemeDef(id)
  const dark = id !== 'classic'
  return {
    unlocked: true,
    themeId: id,
    pageWrap: t.pageWrap,
    headerSection: dark
      ? cn('rounded-2xl border p-6 mb-6 backdrop-blur-[2px]', t.headerCard)
      : cn(MYPAGE_SECTION_CARD, 'p-6 mb-6'),
    avatarRing: t.avatarRing,
    pointsAccent: t.pointsAccent,
    nicknameClass: dark ? 'text-white' : 'text-[#22282E]',
    subtextClass: dark ? 'text-violet-200/80' : 'text-fuchsia-700/55',
    bioClass: dark ? 'text-slate-300/90' : 'text-fuchsia-900/55',
  }
}

/** 결제 시점부터 부여된 만료 시각(보통 +4개월) 전까지 네온 테마·전환 UI 활성 */
export function isNeonProfileThemeUnlocked(profile) {
  if (!profile?.neon_profile_theme_unlocked_at) return false
  const exp = profile.neon_profile_theme_expires_at
  if (!exp) return false
  const t = new Date(exp).getTime()
  if (Number.isNaN(t)) return false
  return t > Date.now()
}

/** 구매 이력은 있으나 4개월 이용 기간이 끝난 상태 */
export function isNeonProfileThemeBenefitExpired(profile) {
  if (!profile?.neon_profile_theme_unlocked_at) return false
  const exp = profile.neon_profile_theme_expires_at
  if (!exp) return true
  const t = new Date(exp).getTime()
  if (Number.isNaN(t)) return true
  return t <= Date.now()
}

/**
 * @returns {Promise<
 *   | { ok: true; pointsSpent: number; themeId: string; expiresAt: string | null }
 *   | { ok: false; error: string }
 * >}
 */
export async function purchaseNeonProfileThemeUnlockRpc() {
  const { data: raw, error } = await supabase.rpc('purchase_neon_profile_theme_unlock')

  if (error) {
    return { ok: false, error: error.message || '구매 요청에 실패했어요' }
  }

  let data = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch {
      return { ok: false, error: '응답이 올바르지 않아요' }
    }
  }

  if (data == null || typeof data !== 'object') {
    return { ok: false, error: '응답이 올바르지 않아요' }
  }

  if (data.ok === false) {
    return { ok: false, error: typeof data.error === 'string' ? data.error : '구매에 실패했어요' }
  }

  return {
    ok: true,
    pointsSpent: Number(data.points_spent ?? NEON_PROFILE_THEME_COST),
    themeId: typeof data.theme_id === 'string' ? data.theme_id : 'magenta_pulse',
    expiresAt: typeof data.expires_at === 'string' ? data.expires_at : data.expires_at ?? null,
  }
}

/**
 * @param {string} themeId
 * @returns {Promise<{ ok: true; themeId: string } | { ok: false; error: string }>}
 */
export async function setNeonProfileThemeRpc(themeId) {
  const { data: raw, error } = await supabase.rpc('set_neon_profile_theme', {
    p_theme_id: themeId,
  })

  if (error) {
    return { ok: false, error: error.message || '테마 변경에 실패했어요' }
  }

  let data = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch {
      return { ok: false, error: '응답이 올바르지 않아요' }
    }
  }

  if (data == null || typeof data !== 'object') {
    return { ok: false, error: '응답이 올바르지 않아요' }
  }

  if (data.ok === false) {
    return { ok: false, error: typeof data.error === 'string' ? data.error : '테마 변경에 실패했어요' }
  }

  return {
    ok: true,
    themeId: typeof data.theme_id === 'string' ? data.theme_id : themeId,
  }
}
