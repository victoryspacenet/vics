/**
 * onAuthStateChange 세션 캐시 — 업로드·API 직전 getSession() 락 경합 완화
 */

/** @type {import('@supabase/supabase-js').Session | null} */
let cachedSession = null

/** @type {Promise<import('@supabase/supabase-js').Session | null> | null} */
let resolveSessionFlight = null

const SESSION_GET_TIMEOUT_MS = 25_000
const SESSION_REFRESH_TIMEOUT_MS = 20_000
/** 업로드에 쓸 최소 잔여 유효 시간 */
const MIN_TOKEN_TTL_MS = 30_000
/** 만료 임박 시 선제 갱신 */
const REFRESH_BEFORE_MS = 120_000

/**
 * @param {import('@supabase/supabase-js').Session | null} session
 */
export function setAuthSessionCache(session) {
  cachedSession = session ?? null
}

export function clearAuthSessionCache() {
  cachedSession = null
  resolveSessionFlight = null
}

export function getAuthSessionCache() {
  return cachedSession
}

/**
 * @param {import('@supabase/supabase-js').Session | null | undefined} session
 * @param {number} [minTtlMs]
 */
export function isAuthSessionUsable(session, minTtlMs = MIN_TOKEN_TTL_MS) {
  if (!session?.access_token) return false
  const expMs = (session.expires_at ?? 0) * 1000
  if (!expMs) return true
  return expMs - Date.now() > minTtlMs
}

function sessionNeedsRefresh(session) {
  if (!session?.access_token) return true
  const expMs = (session.expires_at ?? 0) * 1000
  if (!expMs) return false
  return expMs - Date.now() < REFRESH_BEFORE_MS
}

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} message
 */
function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

/**
 * 업로드·Edge API용 세션 — 캐시 우선, getSession은 최후 수단
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<import('@supabase/supabase-js').Session | null>}
 */
export async function resolveSessionForUpload(supabase) {
  if (resolveSessionFlight) return resolveSessionFlight

  resolveSessionFlight = (async () => {
    try {
      let session = cachedSession

      if (session && isAuthSessionUsable(session) && !sessionNeedsRefresh(session)) {
        return session
      }

      if (session && sessionNeedsRefresh(session)) {
        try {
          const { data, error } = await withTimeout(
            supabase.auth.refreshSession(),
            SESSION_REFRESH_TIMEOUT_MS,
            '로그인 갱신 시간이 초과했어요. 페이지를 새로고침한 뒤 다시 시도해 주세요.',
          )
          if (!error && data?.session?.access_token) {
            cachedSession = data.session
            return data.session
          }
        } catch (refreshErr) {
          if (session?.access_token && isAuthSessionUsable(session, 5_000)) {
            return session
          }
          throw refreshErr
        }
      }

      const { data, error } = await withTimeout(
        supabase.auth.getSession(),
        SESSION_GET_TIMEOUT_MS,
        '로그인 확인 시간이 초과했어요. 페이지를 새로고침한 뒤 다시 시도해 주세요.',
      )
      if (error) throw error
      session = data?.session ?? null
      if (session?.access_token) cachedSession = session
      return session
    } finally {
      resolveSessionFlight = null
    }
  })()

  return resolveSessionFlight
}
