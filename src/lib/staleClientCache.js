const FLAG = 'vics:stale-client-recovered'

export function hasAttemptedStaleClientRecovery() {
  try {
    return sessionStorage.getItem(FLAG) === '1'
  } catch {
    return false
  }
}

export function markStaleClientRecoveryAttempted() {
  try {
    sessionStorage.setItem(FLAG, '1')
  } catch {
    /* ignore */
  }
}

export async function recoverStaleClientCache() {
  if (typeof window === 'undefined') return false
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((reg) => reg.unregister()))
    }
    if (window.caches?.keys) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
    return true
  } catch (error) {
    console.warn('[staleClientCache]', error)
    return false
  }
}

export function reloadAfterStaleClientRecovery() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.set('_vics_reload', String(Date.now()))
  window.location.replace(url.toString())
}
