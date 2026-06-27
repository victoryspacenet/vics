import { getFeaturedBadgeEmoji, getFeaturedBadgeMeta, getDisplayFeaturedBadgeId } from '../../lib/featuredBadges'

/**
 * @param {{
 *   badgeId?: string | null
 *   profile?: object | null
 *   rankInfo?: object
 *   commentCount?: number
 *   className?: string
 * }} props
 */
export function FeaturedBadgeSpan({ badgeId, profile, rankInfo, commentCount, className = '' }) {
  const id = profile
    ? getDisplayFeaturedBadgeId(profile, rankInfo, { commentCount })
    : badgeId

  const emoji = getFeaturedBadgeEmoji(id)
  if (!emoji) return null
  const meta = getFeaturedBadgeMeta(id)
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
