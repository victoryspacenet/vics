import { cn } from '../../lib/utils'
import { Logo } from './Logo'

/** GNB와 동일한 로고 크기 매핑 (배지 직경에 맞춤) */
const LOGO_PX = {
  xs: 14,
  sm: 18,
  md: 22,
  /** GNB `Logo size={32}`와 동일 */
  lg: 32,
}

/**
 * 경쟁 중앙 표시 — GNB와 동일한 VictorySpace 로고 + 청·적 대비 그라데이션 배경
 */
export function VsBadge({
  size = 'md',
  variant = 'clash',
  animated = true,
  className,
}) {
  const sizes = {
    xs: 'min-w-[1.5rem] h-6 px-0.5 rounded-full',
    sm: 'w-8 h-8 min-w-[2rem] rounded-full',
    md: 'w-9 h-9 min-w-[2.25rem] rounded-full',
    lg: 'w-10 h-10 sm:w-12 sm:h-12 min-w-[2.5rem] sm:min-w-[3rem] rounded-full',
  }

  const ringByVariant = {
    clash:
      'ring-2 ring-white shadow-[0_4px_16px_rgba(14,165,233,0.4),0_4px_20px_rgba(244,63,94,0.32)]',
    story:
      'ring-2 ring-white/50 border border-white/35 shadow-[0_0_22px_rgba(14,165,233,0.45),0_0_18px_rgba(244,63,94,0.35)]',
    inline: 'ring-2 ring-white shadow-md shadow-slate-400/25',
    minimal: 'ring-1 ring-slate-200/90 shadow-sm',
  }

  const useFlow = animated && variant !== 'minimal'
  const useSurface = variant !== 'minimal'
  const logoDark = variant === 'story'
  const logoPx = LOGO_PX[size] ?? LOGO_PX.md

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center select-none overflow-hidden',
        useSurface && 'vs-badge-surface',
        useFlow && 'vs-badge-surface--motion',
        !useSurface && 'bg-gradient-to-r from-sky-500 via-indigo-500 to-rose-600',
        sizes[size],
        ringByVariant[variant] ?? ringByVariant.clash,
        className
      )}
      role="img"
      aria-label="VictorySpace 경쟁"
    >
      <div className="relative z-10 flex items-center justify-center p-0.5">
        <Logo
          size={logoPx}
          dark={logoDark}
          link={false}
          className="object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
        />
      </div>
      {useSurface && useFlow && (
        <span
          className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-t from-white/15 to-transparent"
          aria-hidden
        />
      )}
    </div>
  )
}
