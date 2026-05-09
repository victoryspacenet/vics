import { getTier, tierAtLeast } from './tiers'

/**
 * Vip 카드 프레임 혜택 대상: 작성자가 Vip 이상 (Goat 포함).
 * `tierAtLeast`와 동일 — 상위 티어가 하위 티어 혜택을 포함합니다.
 */
export function isMatchupCreatorVipTierGlow(creatorProfile, creatorRankInfo) {
  if (!creatorProfile?.id) return false
  return tierAtLeast(getTier(creatorProfile, creatorRankInfo || {}), 'vip')
}

/** 피드·상세 카드 — Vip 이상 작성자 보라 테두리·글로우 (스케일은 화면별로 추가) */
export const VIP_MATCHUP_SURFACE_CLASS =
  'ring-2 ring-violet-400/60 ring-offset-2 ring-offset-white/95 ' +
  'shadow-[0_0_32px_rgba(139,92,246,0.3)]'
