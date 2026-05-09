/**
 * 관리자 URL → 운영자 상세권한(granular) 메뉴 키
 * MENU_ITEMS / admin_operators.granular 키와 동일해야 함.
 */

export const ADMIN_GRANULAR_MENU_KEYS = ['dashboard', 'matchups', 'users', 'settings']

/**
 * @param {string} pathname location.pathname
 * @returns {'dashboard'|'matchups'|'users'|'settings'|null}
 */
export function menuKeyFromAdminPath(pathname) {
  if (!pathname || !pathname.startsWith('/admin')) return null
  if (pathname.startsWith('/admin/dashboard')) return 'dashboard'
  if (pathname.startsWith('/admin/matchups') || pathname.startsWith('/admin/categories')) return 'matchups'
  if (
    pathname.startsWith('/admin/users') ||
    pathname.startsWith('/admin/appeals') ||
    pathname.startsWith('/admin/inquiry')
  ) {
    return 'users'
  }
  if (pathname.startsWith('/admin/notice') || pathname.startsWith('/admin/settings')) return 'settings'
  return null
}
