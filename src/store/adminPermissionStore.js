import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { canAccessAdminFromEnv, isAdmin, isListedSuperAdmin } from '../lib/adminEmailAllowlist'
import { fetchAdminOperatorForUser, resolveOperatorGranular } from '../lib/adminOperatorSession'
import { ADMIN_GRANULAR_MENU_KEYS } from '../lib/adminRouteMenuMap'

const OPS = ['r', 'w', 'd', 'e']

/** granular JSON을 항상 4메뉴×4권한 부울로 정규화 */
export function normalizeOperatorGranular(raw) {
  const out = {}
  for (const k of ADMIN_GRANULAR_MENU_KEYS) {
    out[k] = {}
    for (const o of OPS) {
      out[k][o] = Boolean(raw?.[k]?.[o])
    }
  }
  return out
}

function allFalseGranular() {
  return normalizeOperatorGranular({})
}

const idleState = {
  loading: true,
  bypass: false,
  granular: null,
  suspended: false,
  noOperatorRecord: false,
  canAccessAdmin: false,
}

export const useAdminPermissionStore = create((set, get) => ({
  ...idleState,

  reset: () => set({ ...idleState, loading: false }),

  /**
   * 로그인 유저 이메일로 admin_operators 행을 찾아 granular 적용.
   * - env 슈퍼/운영자: bypass 또는 접근 허용
   * - DB active 운영자만 canAccessAdmin + granular
   * - 행 없음·일반 유저: GNB·/admin 차단
   */
  async load(user) {
    if (!user?.email) {
      set({ ...idleState, loading: false })
      return
    }
    if (canAccessAdminFromEnv(user)) {
      set({
        loading: false,
        bypass: isListedSuperAdmin(user) || isAdmin(user),
        granular: null,
        suspended: false,
        noOperatorRecord: false,
        canAccessAdmin: true,
      })
      return
    }

    set({ loading: true, bypass: false, suspended: false, noOperatorRecord: false })
    const { row: data, error } = await fetchAdminOperatorForUser(user)

    if (error) {
      console.warn('[adminPermissionStore] load:', error.message)
      set({
        loading: false,
        bypass: false,
        granular: allFalseGranular(),
        suspended: false,
        noOperatorRecord: true,
        canAccessAdmin: false,
      })
      return
    }

    if (!data) {
      set({
        loading: false,
        bypass: false,
        granular: allFalseGranular(),
        suspended: false,
        noOperatorRecord: true,
        canAccessAdmin: false,
      })
      return
    }

    if (data.status !== 'active') {
      set({
        loading: false,
        bypass: false,
        granular: allFalseGranular(),
        suspended: true,
        noOperatorRecord: false,
        canAccessAdmin: false,
      })
      return
    }

    const presetGranular = resolveOperatorGranular(data)
    const isMaster = String(data.permission || '').trim() === 'Master'
    set({
      loading: false,
      bypass: isMaster,
      granular: normalizeOperatorGranular(presetGranular),
      suspended: false,
      noOperatorRecord: false,
      canAccessAdmin: true,
    })
  },

  /** 해당 메뉴 화면 조회(R) */
  allowsMenuRead(menuKey) {
    const { loading, bypass, suspended, granular, canAccessAdmin: allowed } = get()
    if (!allowed) return false
    if (loading) return true
    if (bypass) return true
    if (suspended) return false
    return Boolean(granular?.[menuKey]?.r)
  },

  /** R/W/D/E 중 하나 */
  allowsAction(menuKey, op) {
    const { loading, bypass, suspended, granular, canAccessAdmin: allowed } = get()
    if (!allowed) return false
    if (loading) return true
    if (bypass) return true
    if (suspended) return false
    return Boolean(granular?.[menuKey]?.[op])
  },
}))
