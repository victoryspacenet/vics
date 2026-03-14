import { cn } from '../../lib/utils'

export function Avatar({ src, alt, size = 'md', className }) {
  const sizes = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl',
  }

  const initial = alt?.[0]?.toUpperCase() || '?'

  return (
    <div
      className={cn(
        'rounded-full overflow-hidden bg-gray-100 flex items-center justify-center font-medium text-gray-500 shrink-0',
        sizes[size],
        className
      )}
    >
      {src ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  )
}
