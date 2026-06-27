import { cn } from '../../lib/utils'
import { Avatar } from '../ui/Avatar'
import { UserProfileLink } from '../ui/UserProfileLink'
import { FeaturedBadgeSpan } from '../ui/FeaturedBadge'
import { TierBadge } from '../ui/TierBadge'
import { fandomTierHasDiamondListNicknameAura } from '../../lib/fandomTiers'
import { FandomBronzeStarBadge } from '../fandom/FandomBronzeStarBadge'
import { FoundingMemberBadge } from '../profile/FoundingMemberBadge'

function MatchupFeedParticipantChip({
  profile,
  rankInfo,
  size = 'main',
}) {
  if (!profile?.id && !profile?.nickname) return null

  const isFeed = size === 'feed'

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <UserProfileLink userId={profile?.id} className="inline-flex shrink-0">
        <Avatar
          src={profile?.avatar_url}
          alt={profile?.nickname}
          size="xs"
        />
      </UserProfileLink>
      <UserProfileLink
        userId={profile?.id}
        className={cn(
          'min-w-0 truncate font-medium hover:underline',
          isFeed
            ? 'text-xs text-gray-500'
            : 'text-xs font-semibold text-gray-600',
          fandomTierHasDiamondListNicknameAura(profile?.fandom_tier) &&
            'vics-fandom-diamond-nickname-aura text-slate-800',
        )}
      >
        {profile?.nickname || '사용자'}
      </UserProfileLink>
      <FandomBronzeStarBadge tierId={profile?.fandom_tier} size={isFeed ? undefined : 12} />
      <FoundingMemberBadge profile={profile} size={isFeed ? 12 : 11} />
      <FeaturedBadgeSpan
        profile={profile}
        rankInfo={rankInfo}
        className={cn('translate-y-px shrink-0', isFeed && 'text-xs')}
      />
      {isFeed && (
        <TierBadge
          profile={profile}
          rankInfo={rankInfo || {}}
          variant="compact"
          className="text-[9px]"
        />
      )}
    </div>
  )
}

/** 피드 카드 상단 — 유저 A · 유저 B */
export function MatchupFeedParticipants({
  leftProfile,
  rightProfile,
  leftRankInfo,
  rightRankInfo,
  showRight = true,
  size = 'main',
  className,
}) {
  const hasLeft = leftProfile?.id || leftProfile?.nickname
  const hasRight = showRight && (rightProfile?.id || rightProfile?.nickname)
  if (!hasLeft && !hasRight) return null

  return (
    <div className={cn('flex w-full flex-wrap items-center gap-x-2 gap-y-1', className)}>
      {hasLeft && (
        <MatchupFeedParticipantChip profile={leftProfile} rankInfo={leftRankInfo} size={size} />
      )}
      {hasRight && (
        <div
          className={cn(
            'flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1',
            hasLeft && 'ml-auto justify-end',
          )}
        >
          <MatchupFeedParticipantChip profile={rightProfile} rankInfo={rightRankInfo} size={size} />
        </div>
      )}
    </div>
  )
}
