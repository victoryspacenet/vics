/**
 * 브라우저가 유휴일 때 실행해 메인 스레드·페인트를 먼저 진행합니다.
 * @param {() => void} fn
 * @param {{ timeoutMs?: number }} [opts]
 */
export function runWhenIdle(fn, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 2000
  const run = () => {
    try {
      fn()
    } catch (e) {
      console.warn('[runWhenIdle]', e)
    }
  }
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: timeoutMs })
  } else {
    setTimeout(run, 0)
  }
}
