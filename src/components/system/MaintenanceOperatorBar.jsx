import { Link } from 'react-router-dom'
import { LayoutDashboard, LogIn } from 'lucide-react'
import { useCanAccessAdmin } from '../../lib/adminAuth'
import { useAuthStore } from '../../store/authStore'
import { useAdminPermissionStore } from '../../store/adminPermissionStore'
import { EmergencyMaintenanceControl } from '../admin/EmergencyMaintenanceControl'
import { cn } from '../../lib/utils'

/**
 * 점검 전체 화면에서도 운영자가 /admin 이동·점검 해제 가능하도록
 */
export function MaintenanceOperatorBar({ className }) {
  const { user, loading: authLoading } = useAuthStore()
  const permLoading = useAdminPermissionStore((s) => s.loading)
  const canAdmin = useCanAccessAdmin()

  if (authLoading) return null

  if (!user) {
    return (
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-[210] border-t border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur-md',
          className,
        )}
      >
        <p className="text-center text-xs text-white/60">
          운영자이신가요?{' '}
          <Link to="/login" className="inline-flex items-center gap-1 font-bold text-emerald-300 hover:text-emerald-200">
            <LogIn size={14} />
            로그인
          </Link>
          후 주소창에 <span className="font-mono text-white/80">/admin</span> 으로 이동하세요.
        </p>
      </div>
    )
  }

  if (!canAdmin && permLoading) {
    return (
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-[210] border-t border-white/10 bg-slate-950/95 px-4 py-3 text-center text-xs text-white/50',
          className,
        )}
      >
        운영자 권한 확인 중…
      </div>
    )
  }

  if (!canAdmin) return null

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[210] border-t border-emerald-500/25 bg-slate-950/95 px-4 py-3 backdrop-blur-md',
        className,
      )}
    >
      <div className="mx-auto flex max-w-lg flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-center sm:text-left">
          <p className="text-xs font-black text-emerald-200">운영자 전용</p>
          <p className="mt-0.5 text-[11px] leading-snug text-white/55">
            일반 화면은 점검 중입니다.{' '}
            <span className="text-white/75">/admin</span> 에서는 사이드바·헤더로 계속 이용할 수 있어요.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end shrink-0">
          <Link
            to="/admin/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-100 hover:bg-emerald-500/25"
          >
            <LayoutDashboard size={14} />
            관리자 콘솔
          </Link>
          <EmergencyMaintenanceControl compact surface="dark" />
        </div>
      </div>
    </div>
  )
}
