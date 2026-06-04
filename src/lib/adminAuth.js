/**
 * 관리자·운영자 권한 체크 (GNB·라우트)
 * - env: VITE_ADMIN_EMAILS / VITE_OPERATOR_EMAILS
 * - DB: admin_operators active 행 (adminPermissionStore.load)
 */
import { useAuthStore } from '../store/authStore'
import { useAdminPermissionStore } from '../store/adminPermissionStore'
import {
  canAccessAdminFromEnv,
  isAdmin,
  isListedSuperAdmin,
  isOperator,
} from './adminEmailAllowlist'

export { isListedSuperAdmin, isAdmin, isOperator, canAccessAdminFromEnv }

/** GNB·라우트 가드 — env 등록 또는 DB active 운영자만 */
export function canAccessAdmin(user) {
  if (!user) return false
  if (canAccessAdminFromEnv(user)) return true
  const { canAccessAdmin: fromDb } = useAdminPermissionStore.getState()
  return Boolean(fromDb)
}

/** React 구독용 (권한 재조회 중에도 이미 허용된 운영자 탭 유지) */
export function useCanAccessAdmin() {
  const user = useAuthStore((s) => s.user)
  const canAccessAdminDb = useAdminPermissionStore((s) => s.canAccessAdmin)
  if (!user) return false
  if (canAccessAdminFromEnv(user)) return true
  return canAccessAdminDb
}
