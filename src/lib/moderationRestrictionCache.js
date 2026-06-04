import { hasActiveModerationRestriction } from './restrictionStorage'

const TTL_MS = 2 * 60 * 1000

/** @type {{ userId: string | null; at: number; restricted: boolean | null }} */
let cache = { userId: null, at: 0, restricted: null }

export function invalidateModerationRestrictionCache(userId) {
  if (!userId || cache.userId === userId) {
    cache = { userId: null, at: 0, restricted: null }
  }
}

/**
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function getCachedActiveModerationRestriction(userId) {
  if (!userId) return false
  const now = Date.now()
  if (cache.userId === userId && cache.restricted != null && now - cache.at < TTL_MS) {
    return cache.restricted
  }
  const restricted = await hasActiveModerationRestriction(userId)
  cache = { userId, at: now, restricted }
  return restricted
}

if (typeof window !== 'undefined') {
  window.addEventListener('vics:restriction:updated', () => {
    cache = { userId: null, at: 0, restricted: null }
  })
}
