import { getFeaturedBadgeEmoji, getFeaturedBadgeMeta } from '../../lib/featuredBadges'

/** 닉네임 옆 대표 배지 이모지 (없으면 null) */
export function FeaturedBadgeSpan({ badgeId, className = '' }) {
  const emoji = getFeaturedBadgeEmoji(badgeId)
  if (!emoji) return null
  const meta = getFeaturedBadgeMeta(badgeId)
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center text-[13px] leading-none ${className}`}
      title={meta?.name ? `대표 배지: ${meta.name}` : '대표 배지'}
      aria-hidden
    >
      {emoji}
    </span>
  )
}
