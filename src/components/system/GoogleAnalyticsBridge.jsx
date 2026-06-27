import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { initGoogleAnalytics, trackGoogleAnalyticsPageView } from '../../lib/googleAnalytics'

/** React Router SPA — 화면 전환마다 GA4 page_view */
export function GoogleAnalyticsBridge() {
  const location = useLocation()

  useEffect(() => {
    const path = `${location.pathname}${location.search}`
    void initGoogleAnalytics().then((ok) => {
      if (ok) trackGoogleAnalyticsPageView(path)
    })
  }, [location.pathname, location.search])

  return null
}
