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
        'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-xl select-none',
        {
          'bg-[#22282E] text-white hover:bg-[#363d46] active:scale-[0.98]': variant === 'primary',
          'bg-white text-[#22282E] border border-gray-200 hover:bg-gray-50 active:scale-[0.98]': variant === 'outline',
          'bg-gray-100 text-[#22282E] hover:bg-gray-200 active:scale-[0.98]': variant === 'ghost',
          'bg-red-500 text-white hover:bg-red-600 active:scale-[0.98]': variant === 'danger',
          'opacity-40 pointer-events-none': disabled,
        },
        {
          'px-3 py-1.5 text-xs gap-1.5': size === 'sm',
          'px-4 py-2 text-sm gap-2': size === 'md',
          'px-6 py-3 text-base gap-2': size === 'lg',
          'w-full px-4 py-3 text-sm gap-2': size === 'full',
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
