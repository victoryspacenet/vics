import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { getCachedActiveModerationRestriction } from '../../lib/moderationRestrictionCache'

/** 제재 중에도 접근 허용할 경로 (이의 신청·약관·관리자 등) */
export function isModerationRestrictionExemptPath(pathname) {
  if (pathname === '/restricted' || pathname.startsWith('/restricted/')) return true
  if (pathname === '/login' || pathname === '/signup' || pathname === '/welcome') return true
  if (pathname === '/forgot-password' || pathname === '/reset-password') return true
  if (pathname === '/community-policy' || pathname === '/privacy' || pathname === '/terms') return true
  if (pathname.startsWith('/goodbye')) return true
  if (pathname.startsWith('/inquiry/appeal')) return true
  if (pathname.startsWith('/appeal-result')) return true
  if (pathname.startsWith('/admin')) return true
  return false
}

/**
 * 활성 이용 제한이 있으면 `/restricted` 로 보냄 (예외 경로 제외).
 */
export function ModerationRestrictionGate() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading } = useAuthStore()
  const [checking, setChecking] = useState(true)
  const [restricted, setRestricted] = useState(false)
  const seqRef = useRef(0)

  useEffect(() => {
    if (!user?.id) {
      setRestricted(false)
      setChecking(false)
      return
    }
    const seq = ++seqRef.current
    setChecking(true)
    let cancelled = false
    ;(async () => {
      try {
        const r = await getCachedActiveModerationRestriction(user.id)
        if (cancelled || seq !== seqRef.current) return
        setRestricted(r)
      } finally {
        if (!cancelled && seq === seqRef.current) setChecking(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  useEffect(() => {
    if (loading || checking) return
    if (!user?.id || !restricted) return
    if (isModerationRestrictionExemptPath(location.pathname)) return
    navigate('/restricted', { replace: true })
  }, [loading, checking, user?.id, restricted, location.pathname, navigate])

  return null
}
