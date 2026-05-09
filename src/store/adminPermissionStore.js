import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { isListedSuperAdmin } from '../lib/adminAuth'
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
}

export const useAdminPermissionStore = create((set, get) => ({
  ...idleState,

  reset: () => set({ ...idleState }),

  /**
   * 로그인 유저 이메일로 admin_operators 행을 찾아 granular 적용.
   * - isListedSuperAdmin: 전체 허용(bypass)
   * - 행 없음: 기존 동작 유지(전체 허용, noOperatorRecord)
   * - status !== active: 전부 거부 + suspended
   */
  async load(user) {
    if (!user?.email) {
      set({ ...idleState, loading: false })
      return
    }
    if (isListedSuperAdmin(user)) {
      set({
        loading: false,
        bypass: true,
        granular: null,
        suspended: false,
        noOperatorRecord: false,
      })
      return
    }

    set({ loading: true, bypass: false, suspended: false, noOperatorRecord: false })
    const email = user.email.trim().toLowerCase()
    const { data, error } = await supabase
      .from('admin_operators')
      .select('granular, status')
      .eq('email', email)
      .maybeSingle()

    if (error) {
      console.warn('[adminPermissionStore] load:', error.message)
      set({
        loading: false,
        bypass: true,
        granular: null,
        suspended: false,
        noOperatorRecord: true,
      })
      return
    }

    if (!data) {
      set({
        loading: false,
        bypass: true,
        granular: null,
        suspended: false,
        noOperatorRecord: true,
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
      })
      return
    }

    set({
      loading: false,
      bypass: false,
      granular: normalizeOperatorGranular(data.granular),
      suspended: false,
      noOperatorRecord: false,
    })
  },

  /** 해당 메뉴 화면 조회(R) */
  allowsMenuRead(menuKey) {
    const { loading, bypass, noOperatorRecord, suspended, granular } = get()
    if (loading) return true
    if (bypass || noOperatorRecord) return true
    if (suspended) return false
    return Boolean(granular?.[menuKey]?.r)
  },

  /** R/W/D/E 중 하나 */
  allowsAction(menuKey, op) {
    const { loading, bypass, noOperatorRecord, suspended, granular } = get()
    if (loading) return true
    if (bypass || noOperatorRecord) return true
    if (suspended) return false
    return Boolean(granular?.[menuKey]?.[op])
  },
}))
