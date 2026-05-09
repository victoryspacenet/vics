import { fandomPointsFromClaps } from './fandomPoints'

/**
 * 팬덤 등급 — V-Card 누적 Claps 기준 (기획표와 동일)
 * DB `profiles.fandom_tier` 캐시와 동기화 (트리거 + 마일스톤 RPC)
 */

/** @typedef {'none'|'bronze'|'silver'|'gold'|'diamond'} FandomTierId */

export const FANDOM_CLAP_MILESTONES = [100, 500, 1000, 5000]

/** 높은 마일스톤부터 팝업 우선순위 */
export const FANDOM_MILESTONE_DESC = [5000, 1000, 500, 100]

export const FANDOM_TIERS = [
  {
    id: /** @type {FandomTierId} */ ('diamond'),
    minClaps: 5000,
    name: '언터처블 레전드',
    badgeLabel: '💎',
    perks: '닉네임에 다이아몬드 오라 · 레전더리 다크 UI (리워드에서 설정)',
  },
  {
    id: 'gold',
    minClaps: 1000,
    name: '빅토리 아이콘',
    badgeLabel: '🥇',
    perks: '전용 이모지 · 프로필 테두리 골드 글로우',
  },
  {
    id: 'silver',
    minClaps: 500,
    name: '크라우드 페이버릿',
    badgeLabel: '🥈',
    perks: '프로필 테두리 실버 글로우',
  },
  {
    id: 'bronze',
    minClaps: 100,
    name: '라이징 스타',
    badgeLabel: '🥉',
    perks: '이름 옆 기본 스타 배지',
  },
]

/**
 * @param {number} totalClaps
 * @returns {FandomTierId}
 */
export function fandomTierFromClaps(totalClaps) {
  const n = Number(totalClaps || 0)
  if (n >= 5000) return 'diamond'
  if (n >= 1000) return 'gold'
  if (n >= 500) return 'silver'
  if (n >= 100) return 'bronze'
  return 'none'
}

/**
 * @param {string | null | undefined} tierId
 */
export function fandomTierHasGoldCommentAura(tierId) {
  return tierId === 'gold' || tierId === 'diamond'
}

/**
 * 골드·다이아 팬덤 — 댓글 등 입력창에 노출되는 전용 이모지 퀵픽 (골드 혜택, 다이아는 상위 등급으로 동일 제공)
 */
export function fandomTierHasGoldExclusiveEmojis(tierId) {
  return tierId === 'gold' || tierId === 'diamond'
}

/** 한 글자씩 탭하면 커서 위치에 삽입 (유니코드 이모지 문자열) */
export const FANDOM_GOLD_EXCLUSIVE_EMOJIS = [
  '🏆', '👑', '🥇', '✨', '🔥', '⚡', '💎', '🌟', '💫', '🎯', '⭐', '🤩',
]

/**
 * 다이아 팬덤 — 메인·피드 매치업 카드 등 리스트에서 작성자 닉네임 오라
 * @param {string | null | undefined} tierId profiles.fandom_tier
 */
export function fandomTierHasDiamondListNicknameAura(tierId) {
  return tierId === 'diamond'
}

/** 브론즈 팬덤 — 리스트·댓글 등 닉네임 옆 기본 스타(별) 배지 */
export function fandomTierShowsBronzeStarBadge(tierId) {
  return tierId === 'bronze'
}

/** 실버 팬덤 — 마이페이지·프로필 편집 등 프로필 아바타·헤더 카드 실버 글로우 */
export function fandomTierHasSilverProfileGlow(tierId) {
  return tierId === 'silver'
}

/** 골드 팬덤 — 마이페이지·프로필 편집 등 프로필 아바타·헤더 카드 골드 글로우 */
export function fandomTierHasGoldProfileGlow(tierId) {
  return tierId === 'gold'
}

/**
 * @param {string | null | undefined} tierId
 */
export function getFandomTierMeta(tierId) {
  if (!tierId || tierId === 'none') return null
  return FANDOM_TIERS.find((t) => t.id === tierId) || null
}

/**
 * 마일스톤 모달용 카피 (추가 FP 지급 없음 — Clap당 5점은 받을 때마다 자동 적립)
 * @param {number} milestone
 */
export function getFandomMilestoneRewardCopy(milestone) {
  const m = Number(milestone) || 0
  const accruedFp = fandomPointsFromClaps(m)
  const tier = fandomTierFromClaps(milestone)
  const meta = getFandomTierMeta(tier === 'none' ? 'bronze' : tier)
  return {
    /** 이 Clap 수까지 규정상 누적된 F-Point (안내용) */
    accruedFp,
    tierLabel: meta?.name ?? '팬덤',
    badge: meta?.badgeLabel ?? '✨',
  }
}
