import { Crown } from 'lucide-react'
import { cn } from '../../lib/utils'
import { formatFoundingMemberTitle, getFoundingMemberNumber } from '../../lib/foundingMember'

/**
 * @param {{
 *   profile?: { founding_member_number?: number | null } | null
 *   foundingMemberNumber?: number | null
 *   variant?: 'icon' | 'pill'
 *   className?: string
 *   size?: number
 * }} props
 */
export function FoundingMemberBadge({
  profile,
  foundingMemberNumber,
  variant = 'icon',
  className,
  size = 14,
}) {
  const n =
    foundingMemberNumber != null
      ? getFoundingMemberNumber({ founding_member_number: foundingMemberNumber })
      : getFoundingMemberNumber(profile)

  if (n == null) return null

  const title = formatFoundingMemberTitle(n)

  if (variant === 'pill') {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300/70',
          'bg-gradient-to-r from-amber-100/95 via-yellow-50 to-amber-100/90',
          'px-2 py-0.5 text-[10px] font-black tracking-tight text-amber-950 shadow-sm',
          className,
        )}
        title={title}
        aria-label={title}
      >
        <Crown size={11} className="text-amber-600" strokeWidth={2.4} aria-hidden />
        창립 #{n.toLocaleString('ko-KR')}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center translate-y-px rounded-full',
        'border border-amber-300/55 bg-gradient-to-br from-amber-100 to-yellow-50',
        'p-0.5 shadow-[0_0_6px_rgba(251,191,36,0.35)]',
        className,
      )}
      title={title}
      aria-label={title}
    >
      <Crown
        size={size}
        strokeWidth={2.3}
        className="text-amber-600 drop-shadow-[0_0_3px_rgba(245,158,11,0.45)]"
        aria-hidden
      />
    </span>
  )
}
