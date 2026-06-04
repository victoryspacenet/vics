import { cn } from '../../lib/utils'

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  ...props
}) {
  return (
    <button
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-xl select-none touch-manipulation',
        {
          'bg-[#22282E] text-white hover:bg-[#363d46] active:scale-[0.98]': variant === 'primary',
          'bg-white text-[#22282E] border border-gray-200 hover:bg-gray-50 active:scale-[0.98]': variant === 'outline',
          'bg-gray-100 text-[#22282E] hover:bg-gray-200 active:scale-[0.98]': variant === 'ghost',
          'bg-red-500 text-white hover:bg-red-600 active:scale-[0.98]': variant === 'danger',
          'bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 text-white font-black border-0 shadow-[0_8px_28px_-6px_rgba(168,85,247,0.55)] ring-1 ring-white/35 hover:brightness-105 hover:shadow-[0_12px_36px_-6px_rgba(236,72,153,0.45)] active:scale-[0.98]':
            variant === 'mz',
          'opacity-40 pointer-events-none': disabled,
        },
        {
          /* 모바일: 최소 44px 터치 높이 · lg 이상에서 기존 컴팩트 값 */
          'min-h-11 gap-1.5 px-4 py-2.5 text-sm lg:min-h-9 lg:px-3 lg:py-1.5 lg:text-xs': size === 'sm',
          'min-h-12 gap-2 px-5 py-3 text-sm lg:min-h-10 lg:px-4 lg:py-2': size === 'md',
          'min-h-12 gap-2 px-6 py-3.5 text-base lg:min-h-11 lg:py-3': size === 'lg',
          'min-h-12 w-full gap-2 px-4 py-3.5 text-sm lg:min-h-11 lg:py-3': size === 'full',
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
