import { useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { canAccessAdminFromEnv, useCanAccessAdmin } from '../../lib/adminAuth'
import { useAuthStore } from '../../store/authStore'
import { useAdminPermissionStore } from '../../store/adminPermissionStore'
import { selectServerMaintenanceActive, useServerMaintenanceStore } from '../../store/serverMaintenanceStore'
import { ServerMaintenanceScreen } from './ServerMaintenanceScreen'
import { runWhenIdle } from '../../lib/runDeferred'

/**
 * 서버 점검·다운 시 전체 화면 안내 (운영자 /admin 은 통과)
 */
export function ServerMaintenanceGate({ children }) {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const permLoading = useAdminPermissionStore((s) => s.loading)
  const showAdminNav = useCanAccessAdmin()
  const ready = useServerMaintenanceStore((s) => s.ready)
  const isActive = useServerMaintenanceStore(selectServerMaintenanceActive)
  const setForceDemo = useServerMaintenanceStore((s) => s.setForceDemo)

  const maintenanceDemo = import.meta.env.DEV && searchParams.get('maintenanceDemo') === '1'
  const onAdminPath = location.pathname.startsWith('/admin')
  /** /admin + 로그인 운영자는 점검 화면 대신 AdminLayout(헤더·사이드바) 유지 */
  const adminBypass =
    onAdminPath &&
    Boolean(user) &&
    (canAccessAdminFromEnv(user) || showAdminNav || permLoading)

  useEffect(() => {
    setForceDemo(maintenanceDemo)
  }, [maintenanceDemo, setForceDemo])

  useEffect(() => {
    // 설정만 먼저 조회해 앱을 즉시 표시 — 헬스 프로브는 유휴 시 백그라운드
    void useServerMaintenanceStore.getState().refresh({ probe: false, force: true })
    useServerMaintenanceStore.getState().startPolling()
    runWhenIdle(() => {
      void useServerMaintenanceStore.getState().refresh({ probe: true })
    }, { timeoutMs: 4000 })
    return () => useServerMaintenanceStore.getState().stopPolling()
  }, [])

  if (!ready && !maintenanceDemo) {
    return children
  }

  if (isActive && !adminBypass) {
    return <ServerMaintenanceScreen />
  }

  return children
}
