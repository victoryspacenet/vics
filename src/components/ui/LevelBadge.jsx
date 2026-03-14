import { getLevel, getLevelProgress } from '../../lib/utils'
import { cn } from '../../lib/utils'

/**
 * LevelBadge - 인라인 레벨 뱃지
 * variant: 'badge' (기본) | 'card' (큰 카드형, MyPage 등)
 */
export function LevelBadge({ points = 0, variant = 'badge', className }) {
  const level = getLevel(points)

  if (variant === 'badge') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full',
          level.bg,
          level.color,
          className
        )}
      >
        <span>{level.emoji}</span>
        <span>Lv.{level.level}</span>
        <span className="font-medium">{level.name}</span>
      </span>
    )
  }

  if (variant === 'card') {
    const { current, next, progress } = getLevelProgress(points)
    return (
      <div className={cn('bg-gray-50 rounded-xl p-4 space-y-3', className)}>
        {/* 레벨 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{current.emoji}</span>
            <div>
              <p className={cn('text-sm font-black', current.color)}>
                Lv.{current.level} {current.name}
              </p>
              <p className="text-xs text-gray-400">{points.toLocaleString()} pt</p>
            </div>
          </div>
          {next && (
            <div className="text-right">
              <p className="text-xs text-gray-400">다음 레벨</p>
              <p className="text-xs font-semibold text-gray-500">
                {next.emoji} {next.name} ({next.min.toLocaleString()}pt)
              </p>
            </div>
          )}
        </div>

        {/* 진행바 */}
        {next ? (
          <div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', current.color.replace('text-', 'bg-'))}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-right text-xs text-gray-400 mt-1">{progress}%</p>
          </div>
        ) : (
          <div>
            <div className="h-2 bg-yellow-200 rounded-full overflow-hidden">
              <div className="h-full w-full bg-yellow-400 rounded-full" />
            </div>
            <p className="text-right text-xs text-yellow-600 mt-1 font-semibold">MAX</p>
          </div>
        )}
      </div>
    )
  }

  return null
}
