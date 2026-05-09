import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  className,
  headerClassName,
  titleClassName,
  bodyClassName,
  /** 최상위 fixed 래퍼 (z-index 등) */
  rootClassName,
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className={cn('fixed inset-0 z-50 flex items-center justify-center p-4', rootClassName)}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className={cn(
          'relative bg-gradient-to-b from-white via-white to-slate-50/40 rounded-2xl shadow-xl w-full max-w-[min(28rem,calc(100vw-2rem))] z-10 overflow-hidden flex flex-col max-h-[90vh]',
          className
        )}
      >
        {title && (
          <div
            className={cn(
              'flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4',
              headerClassName,
            )}
          >
            <h2 className={cn('text-base font-semibold text-[#22282E]', titleClassName)}>{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className={cn('p-6 overflow-y-auto flex-1 min-h-0', bodyClassName)}>{children}</div>
      </div>
    </div>
  )
}
