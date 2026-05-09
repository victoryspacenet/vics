/**
 * 이원화 랭킹 트랙 배지
 * - The Champion (생성자): TOP 랭커 프로필 테두리
 * - The Oracle (투표자): 전설의 안목 배지
 */
import { cn } from '../../lib/utils'

const TRACK_CFG = {
  creator: {
    top3Ring: 'ring-2 ring-amber-400 ring-offset-2',
    badge: '챔피언',
    badgeClass: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-900',
  },
  voter: {
    top3Ring: 'ring-2 ring-violet-400 ring-offset-2',
    badge: '전설의 안목',
    badgeClass: 'bg-gradient-to-r from-violet-500 to-purple-600 text-white',
  },
}

export function RankTrackBadge({ track, rank, showBadge = true, className }) {
  const cfg = TRACK_CFG[track]
  if (!cfg || rank > 3) return null

  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black',
        cfg.badgeClass,
        className
      )}
    >
      {showBadge && cfg.badge}
    </span>
  )
}

export function getCreatorRingClass(rank) {
  if (rank > 3) return ''
  return TRACK_CFG.creator.top3Ring
}

export function getVoterRingClass(rank) {
  if (rank > 3) return ''
  return TRACK_CFG.voter.top3Ring
}
