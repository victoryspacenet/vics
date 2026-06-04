const SESSION_KEY = 'vics:tier-milestone-grant:v1'

/** 로그인 세션당 티어 마일스톤 RPC 1회 (Supabase I/O 절감) */
export function shouldRunTierMilestoneGrant(userId) {
  if (!userId || typeof sessionStorage === 'undefined') return true
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return true
    const parsed = JSON.parse(raw)
    return parsed?.userId !== userId
  } catch {
    return true
  }
}

export function markTierMilestoneGrantRan(userId) {
  if (!userId || typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ userId, at: Date.now() }))
  } catch {
    void 0
  }
}

export function clearTierMilestoneGrantThrottle() {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    void 0
  }
}
