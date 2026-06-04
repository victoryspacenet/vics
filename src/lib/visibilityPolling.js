/**
 * 탭이 보일 때만 주기적으로 콜백 실행 (Supabase Realtime 대체·I/O 절감)
 * @param {{ onTick: () => void; intervalMs: number; runImmediately?: boolean }} opts
 * @returns {() => void} cleanup
 */
export function startVisibilityPolling({ onTick, intervalMs, runImmediately = true }) {
  if (typeof window === 'undefined') return () => {}

  const tick = () => {
    if (document.visibilityState !== 'visible') return
    onTick()
  }

  if (runImmediately) tick()

  const id = window.setInterval(tick, intervalMs)
  const onVisible = () => {
    if (document.visibilityState === 'visible') tick()
  }
  document.addEventListener('visibilitychange', onVisible)

  return () => {
    window.clearInterval(id)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
