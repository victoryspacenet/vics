/**
 * 랭킹 캐시 - 하루 1번 업데이트
 * 24시간 TTL, 동일 쿼리는 캐시된 데이터 사용
 */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24시간
const cache = new Map()

export function getCachedRanking(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  return entry
}

export function setCachedRanking(key, data) {
  cache.set(key, { data, fetchedAt: Date.now() })
}

export function clearRankingCache() {
  cache.clear()
}
