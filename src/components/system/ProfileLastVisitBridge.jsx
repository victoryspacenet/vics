import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { touchProfileLastVisit, PROFILE_LAST_VISIT_TOUCH_MS } from '../../lib/profileLastVisit'

/**
 * 로그인 유지 중에도 최종 방문 시각 갱신
 * - 화면(라우트) 이동
 * - 탭 포커스·다시 보이기
 * - 포그라운드 체류 중 주기적 하트비트 (스로틀과 동일 간격)
 */
export function ProfileLastVisitBridge() {
  const userId = useAuthStore((s) => s.user?.id)
  const location = useLocation()

  useEffect(() => {
    if (!userId) return
    void touchProfileLastVisit(userId)
  }, [userId, location.pathname, location.search])

  useEffect(() => {
    if (!userId) return

    const touch = () => {
      void touchProfileLastVisit(userId)
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') touch()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', touch)

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') touch()
    }, PROFILE_LAST_VISIT_TOUCH_MS)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', touch)
      window.clearInterval(interval)
    }
  }, [userId])

  return null
}
