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
          // 가운데 정렬: 화면 오른쪽에만 붙어 잘리는 느낌 완화 (left+right+mx-auto)
          'fixed inset-y-0 left-0 right-0 mx-auto h-full max-h-dvh bg-white z-50 shadow-2xl transition-transform duration-300 ease-out flex flex-col',
          'w-full max-w-[min(32rem,calc(100vw-1rem))] sm:max-w-lg overflow-x-hidden',
          // 닫힘: 패널 폭과 무관하게 화면 밖으로 (translate-x-full은 가운데 배치 시 덜 밀림)
          isOpen ? 'translate-x-0' : 'translate-x-[100vw]',
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
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">{children}</div>
      </div>
    </>
  )
}
