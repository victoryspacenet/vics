import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { cn } from '../../lib/utils'

export function Toast() {
  const { toast } = useUIStore()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (toast) {
      setVisible(true)
    } else {
      setVisible(false)
    }
  }, [toast])

  if (!toast) return null

  const icons = {
    success: <CheckCircle size={16} className="text-green-500 shrink-0" />,
    error: <XCircle size={16} className="text-red-500 shrink-0" />,
    info: <Info size={16} className="text-blue-500 shrink-0" />,
  }

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-[110000] transition-all duration-300',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      )}
    >
      <div className="flex items-center gap-2 bg-[#22282E] text-white px-4 py-3 rounded-xl shadow-lg text-sm min-w-[200px] max-w-[320px]">
        {icons[toast.type] || icons.info}
        <span className="flex-1">{toast.message}</span>
      </div>
    </div>
  )
}
