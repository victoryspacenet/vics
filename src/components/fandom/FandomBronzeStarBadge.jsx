import { Star } from 'lucide-react'
import { fandomTierShowsBronzeStarBadge } from '../../lib/fandomTiers'
import { cn } from '../../lib/utils'

/**
 * 팬덤 브론즈(라이징 스타) — 닉네임 옆 기본 스타 배지
 * @param {{ tierId?: string | null, className?: string, size?: number }} props
 */
export function FandomBronzeStarBadge({ tierId, className, size = 14 }) {
  if (!fandomTierShowsBronzeStarBadge(tierId)) return null
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center translate-y-px', className)}
      title="팬덤 라이징 스타(브론즈)"
      aria-label="팬덤 브론즈 스타 배지"
    >
      <Star
        size={size}
        strokeWidth={2}
        className="fill-amber-400/95 stroke-amber-600/60 text-amber-500 drop-shadow-[0_0_4px_rgba(251,191,36,0.85)]"
        aria-hidden
      />
    </span>
  )
}
