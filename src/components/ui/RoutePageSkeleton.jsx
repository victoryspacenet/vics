import { cn } from '../../lib/utils'
import { LAYOUT_CONTENT_MAX_WIDTH_CLASS } from '../../lib/layoutShellClasses'

/**
 * lazy 라우트 Suspense fallback — 빈 화면보다 스켈레톤이 전환 체감이 빠릅니다.
 */
export function RoutePageSkeleton({ className }) {
  return (
    <div
      className={cn('mx-auto w-full min-w-0 animate-pulse space-y-4 py-2', LAYOUT_CONTENT_MAX_WIDTH_CLASS, className)}
      aria-hidden
    >
      <div className="h-8 w-40 rounded-lg bg-slate-200/80" />
      <div className="h-36 rounded-2xl bg-slate-200/70" />
      <div className="h-24 rounded-2xl bg-slate-200/60" />
      <div className="h-24 rounded-2xl bg-slate-200/50" />
    </div>
  )
}
