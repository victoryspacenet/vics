import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { initHubSpot, trackHubSpotPageView, identifyHubSpotUser } from '../../lib/hubspot'

/** HubSpot 추적 + SPA pageview + (선택) 로그인 이메일 identify */
export function HubSpotBridge() {
  const location = useLocation()
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    const path = `${location.pathname}${location.search}`
    void initHubSpot().then((ok) => {
      if (ok) trackHubSpotPageView(path)
    })
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!user?.email) return
    void initHubSpot().then((ok) => {
      if (ok) identifyHubSpotUser(user.email)
    })
  }, [user?.email])

  return null
}
