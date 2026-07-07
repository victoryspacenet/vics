/** 유저 관리 목록 ↔ 상세 — 페이지·필터 URL 유지 */
export const ADMIN_USERS_LIST_PATH = '/admin/users'

const LIST_RETURN_STORAGE_KEY = 'vics:adminUsers:listReturnTo'

/**
 * @param {URLSearchParams} searchParams
 */
export function readAdminUsersListState(searchParams) {
  const pageRaw = parseInt(searchParams.get('page') || '1', 10)
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1
  return {
    page,
    statusFilter: searchParams.get('status') || 'all',
    sortBy: searchParams.get('sort') || '',
    searchQ: searchParams.get('q') || '',
  }
}

/**
 * @param {import('react-router-dom').SetURLSearchParams} setSearchParams
 * @param {Record<string, string | number | null | undefined>} patch
 * @param {{ replace?: boolean }} [opts]
 */
export function patchAdminUsersSearchParams(setSearchParams, patch, opts = {}) {
  const replace = opts.replace !== false
  setSearchParams(
    (prev) => {
      const next = new URLSearchParams(prev)
      for (const [key, value] of Object.entries(patch)) {
        if (
          value == null ||
          value === '' ||
          (key === 'status' && value === 'all') ||
          (key === 'page' && Number(value) <= 1)
        ) {
          next.delete(key)
        } else {
          next.set(key, String(value))
        }
      }
      return next
    },
    { replace },
  )
}

/**
 * @param {string} pathname
 * @param {string} search
 */
export function adminUsersListReturnTo(pathname, search) {
  return `${pathname || ADMIN_USERS_LIST_PATH}${search || ''}`
}

/**
 * @param {string | null | undefined} path
 */
export function rememberAdminUsersListReturnTo(path) {
  if (typeof path !== 'string' || !path.startsWith(ADMIN_USERS_LIST_PATH)) return
  try {
    sessionStorage.setItem(LIST_RETURN_STORAGE_KEY, path)
  } catch {
    /* ignore */
  }
}

/**
 * @param {string | null | undefined} candidate
 */
export function resolveAdminUsersListReturnTo(candidate) {
  if (typeof candidate === 'string' && candidate.startsWith(ADMIN_USERS_LIST_PATH)) {
    return candidate
  }
  try {
    const stored = sessionStorage.getItem(LIST_RETURN_STORAGE_KEY)
    if (typeof stored === 'string' && stored.startsWith(ADMIN_USERS_LIST_PATH)) {
      return stored
    }
  } catch {
    /* ignore */
  }
  return ADMIN_USERS_LIST_PATH
}

/**
 * @param {string} userId
 * @param {string} listReturnTo
 */
export function rememberAdminUsersDetailEntry(userId, listReturnTo) {
  rememberAdminUsersListReturnTo(listReturnTo)
  try {
    sessionStorage.setItem(`vics:adminUsers:detailFrom:${userId}`, listReturnTo)
  } catch {
    /* ignore */
  }
}

/**
 * @param {string | null | undefined} userId
 * @param {string | null | undefined} locationStateReturnTo
 */
export function resolveAdminUsersDetailReturnTo(userId, locationStateReturnTo) {
  const fromState = resolveAdminUsersListReturnTo(locationStateReturnTo)
  if (fromState !== ADMIN_USERS_LIST_PATH) return fromState

  if (userId) {
    try {
      const perUser = sessionStorage.getItem(`vics:adminUsers:detailFrom:${userId}`)
      if (typeof perUser === 'string' && perUser.startsWith(ADMIN_USERS_LIST_PATH)) {
        return perUser
      }
    } catch {
      /* ignore */
    }
  }

  return fromState
}
