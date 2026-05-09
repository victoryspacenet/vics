import { useMemo } from 'react'
import { useAdminPermissionStore } from '../store/adminPermissionStore'

/**
 * 운영자 상세권한 — 특정 메뉴 키에 대한 R/W/D/E (로딩 중에는 true로 두어 깜빡임 최소화)
 * @param {'dashboard'|'matchups'|'users'|'settings'} menuKey
 */
export function useAdminGranularForMenu(menuKey) {
  const loading = useAdminPermissionStore((s) => s.loading)
  const bypass = useAdminPermissionStore((s) => s.bypass)
  const noOperatorRecord = useAdminPermissionStore((s) => s.noOperatorRecord)
  const suspended = useAdminPermissionStore((s) => s.suspended)
  const granular = useAdminPermissionStore((s) => s.granular)

  return useMemo(() => {
    const open = loading || bypass || noOperatorRecord
    if (open) {
      return {
        loading,
        canRead: true,
        canWrite: true,
        canDelete: true,
        canExport: true,
      }
    }
    if (suspended) {
      return {
        loading,
        canRead: false,
        canWrite: false,
        canDelete: false,
        canExport: false,
      }
    }
    const g = granular?.[menuKey] || {}
    return {
      loading,
      canRead: Boolean(g.r),
      canWrite: Boolean(g.w),
      canDelete: Boolean(g.d),
      canExport: Boolean(g.e),
    }
  }, [loading, bypass, noOperatorRecord, suspended, granular, menuKey])
}
