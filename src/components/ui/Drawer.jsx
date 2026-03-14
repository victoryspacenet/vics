import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

export function Drawer({ isOpen, onClose, title, children, className }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          'fixed right-0 top-0 h-full bg-white z-50 shadow-2xl transition-transform duration-300 ease-out flex flex-col',
          'w-full max-w-[min(32rem,100vw)] sm:max-w-lg', // className prop으로 override 가능
          isOpen ? 'translate-x-0' : 'translate-x-full',
          className
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-[#22282E]">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </>
  )
}
