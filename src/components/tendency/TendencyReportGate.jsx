import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import {
  fetchTendencyReportStatus,
  TENDENCY_REPORT_VOTE_THRESHOLD,
  TENDENCY_VOTE_CAST,
  TENDENCY_REPORT_ACKED,
} from '../../lib/tendencyReport'
import { TendencyReportUnlockModal } from './TendencyReportUnlockModal'

const SKIP_PREFIXES = ['/login', '/signup', '/admin', '/goodbye', '/dev', '/welcome']
const CHECK_TTL_MS = 60_000

function shouldSkipPath(pathname) {
  return SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function snoozeKey(userId) {
  return `vics:tendency-report-snooze-${userId}`
}

export function TendencyReportGate() {
  const location = useLocation()
  const navigate = useNavigate()
  const pathnameRef = useRef(location.pathname)
  pathnameRef.current = location.pathname

  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)

  const [showUnlock, setShowUnlock] = useState(false)
  const busyRef = useRef(false)
  const lastCheckAtRef = useRef(0)

  const check = useCallback(async (force = false) => {
    if (!user?.id || shouldSkipPath(pathnameRef.current)) {
      setShowUnlock(false)
      return
    }
    if (pathnameRef.current === '/report/tendency') {
      setShowUnlock(false)
      return
    }

    const now = Date.now()
    if (!force && now - lastCheckAtRef.current < CHECK_TTL_MS) return
    if (busyRef.current) return

    busyRef.current = true
    lastCheckAtRef.current = now

    try {
      const status = await fetchTendencyReportStatus()
      if (
        !status.eligible ||
        status.acknowledged ||
        status.voteCount < TENDENCY_REPORT_VOTE_THRESHOLD
      ) {
        setShowUnlock(false)
        return
      }
      if (sessionStorage.getItem(snoozeKey(user.id))) {
        setShowUnlock(false)
        return
      }
      setShowUnlock(true)
    } finally {
      busyRef.current = false
    }
  }, [user?.id])

  useEffect(() => {
    const t = window.setTimeout(() => void check(), 500)
    return () => window.clearTimeout(t)
  }, [check, user?.id])

  useEffect(() => {
    const onVote = () => void check(true)
    const onAcked = () => setShowUnlock(false)
    window.addEventListener(TENDENCY_VOTE_CAST, onVote)
    window.addEventListener(TENDENCY_REPORT_ACKED, onAcked)
    return () => {
      window.removeEventListener(TENDENCY_VOTE_CAST, onVote)
      window.removeEventListener(TENDENCY_REPORT_ACKED, onAcked)
    }
  }, [check])

  const onClose = useCallback(() => {
    if (user?.id) sessionStorage.setItem(snoozeKey(user.id), '1')
    setShowUnlock(false)
  }, [user?.id])

  const onOpenReport = useCallback(() => {
    if (user?.id) sessionStorage.removeItem(snoozeKey(user.id))
    setShowUnlock(false)
    navigate('/report/tendency')
  }, [navigate, user?.id])

  return (
    <TendencyReportUnlockModal
      open={showUnlock}
      nickname={profile?.nickname}
      onClose={onClose}
      onOpenReport={onOpenReport}
    />
  )
}
