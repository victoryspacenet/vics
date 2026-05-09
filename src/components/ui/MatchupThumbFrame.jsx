import { cn } from '../../lib/utils'

/**
 * 매치업 썸네일 — 움직이는 그라데이션 테두리 + 은은한 빛 스윕
 */
export function MatchupThumbFrame({ children, side = 'left', className, innerClassName }) {
  const tone = side === 'left' ? 'matchup-thumb-frame--left' : 'matchup-thumb-frame--right'

  return (
    <div
      className={cn(
        'relative rounded-xl p-[2px] matchup-thumb-frame',
        tone,
        className
      )}
    >
      <div
        className={cn(
          'relative h-full w-full min-h-0 overflow-hidden rounded-[10px] bg-gray-100',
          innerClassName
        )}
      >
        <div className="relative z-[1] h-full min-h-0">{children}</div>
        <div className="matchup-thumb-shine pointer-events-none absolute inset-0 z-[3]" aria-hidden />
      </div>
    </div>
  )
}
