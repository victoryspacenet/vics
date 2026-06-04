import { cn } from '../../lib/utils'

/**
 * @param {{ compact?: boolean; staticLcp?: boolean }} props
 * `staticLcp`: 첫 뷰포트용 — 전면 pulse 없이 정적 블록 (메인 캐러셀·피드 스켈레톤 LCP 부담 감소)
 */
export function MainCardSkeleton({ compact, staticLcp = false }) {
  const pulse = staticLcp ? '' : 'animate-pulse'
  const bar = staticLcp ? 'bg-slate-200/50' : 'bg-gray-200/80'
  const tile = staticLcp ? 'bg-slate-200/40' : 'bg-gray-100'

  return (
    <div
      className={cn(
        'rounded-2xl border border-gray-200/70 bg-gradient-to-br from-slate-50 to-slate-200/60 p-4 shadow-sm',
        compact && 'min-w-0 w-full shrink-0',
        pulse,
      )}
    >
      <div className={cn('mb-3 h-4 w-3/4 rounded', bar)} />
      <div className="grid grid-cols-2 gap-2">
        <div className={cn('aspect-square rounded-xl', tile)} />
        <div className={cn('aspect-square rounded-xl', tile)} />
      </div>
      <div className={cn('mt-3 h-3 w-20 rounded', bar)} />
    </div>
  )
}
