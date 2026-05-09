import { getTier } from '../../lib/tiers'
import { cn } from '../../lib/utils'

/**
 * 매치업 등급(Tier) 배지
 * @param {Object} profile - { total_matchups, creator_wins, vote_total, vote_hits, hit_rate? }
 * @param {Object} rankInfo - { overallRank, totalUsers, weeklyRankChampion, weeklyRankOracle, monthlyRankChampion, monthlyRankOracle }
 * @param {string} variant - 'badge' | 'compact' | 'full'
 */
export function TierBadge({ profile, rankInfo, variant = 'badge', className }) {
  const tier = getTier(profile || {}, rankInfo || {})

  if (variant === 'compact') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold',
          tier.bg,
          tier.color,
          className
        )}
        title={tier.benefit}
      >
        <span>{tier.emoji}</span>
        <span>{tier.name}</span>
      </span>
    )
  }

  if (variant === 'full') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border',
          tier.bg,
          tier.border,
          className
        )}
      >
        <span className="text-base">{tier.emoji}</span>
        <div>
          <p className={cn('text-xs font-black', tier.color)}>{tier.name}</p>
          <p className="text-[10px] text-gray-500">{tier.benefit}</p>
        </div>
      </div>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border',
        tier.bg,
        tier.color,
        tier.border,
        className
      )}
      title={tier.benefit}
    >
      <span>{tier.emoji}</span>
      <span>{tier.name}</span>
    </span>
  )
}
