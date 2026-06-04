import { cn } from '../../lib/utils'

/** 피드 카드(`MainMatchupCard`) 레이아웃에 맞춘 스켈레톤 — CLS 완화·LCP(첫 프레임)용 */
const VARIANT_SURFACE = {
  best:
    'border-amber-200/85 ring-1 ring-amber-100/55 shadow-md shadow-amber-200/30 bg-gradient-to-br from-slate-50 via-amber-50/30 to-orange-50/40',
  hot:
    'border-fuchsia-200/80 ring-1 ring-violet-100/50 shadow-md shadow-fuchsia-200/25 bg-gradient-to-br from-slate-50 via-violet-50/30 to-fuchsia-50/35',
  new:
    'border-emerald-200/80 ring-1 ring-teal-100/50 shadow-md shadow-emerald-200/28 bg-gradient-to-br from-slate-50 via-emerald-50/28 to-cyan-50/32',
}

/**
 * @param {{ variant?: 'best' | 'hot' | 'new'; staticLcp?: boolean; className?: string }} props
 * - `staticLcp`: 첫 뷰포트용 — 전체 `pulse` 대신 정적 블록으로 LCP·모션 부담 감소
 */
export function MainFeedCardSkeleton({ variant = 'best', staticLcp = false, className }) {
  const pulse = staticLcp ? '' : 'animate-pulse'
  const block = staticLcp ? 'bg-slate-200/45' : 'bg-slate-200/55'

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-2xl border transition-colors',
        VARIANT_SURFACE[variant] ?? VARIANT_SURFACE.best,
        className,
      )}
      aria-hidden
    >
      <div className="relative p-4">
        <div className={cn('mb-3 flex items-start justify-between gap-2 pr-14', pulse)}>
          <div className={cn('h-4 flex-1 rounded-md', block, 'max-w-[85%]')} />
        </div>
        <div className={cn('mb-3 flex items-center gap-2', pulse)}>
          <div className={cn('h-6 w-6 shrink-0 rounded-full', block)} />
          <div className={cn('h-3 w-28 rounded', block)} />
        </div>
        <div className={cn('relative grid grid-cols-2 gap-2', pulse)}>
          <div className={cn('aspect-square w-full rounded-xl', block)} />
          <div className={cn('aspect-square w-full rounded-xl', block)} />
          <div
            className={cn(
              'pointer-events-none absolute left-1/2 top-1/2 z-10 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full',
              block,
              'opacity-90 ring-2 ring-white/80',
            )}
            aria-hidden
          />
        </div>
        <div className={cn('mt-3 flex items-center justify-between gap-3', pulse)}>
          <div className={cn('h-3 w-16 rounded', block)} />
          <div className={cn('h-3 w-24 rounded', block)} />
        </div>
      </div>
    </div>
  )
}
