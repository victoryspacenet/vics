import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import {
  fetchTendencyReportStatus,
  markTendencyReportPopupSeen,
  TENDENCY_REPORT_POPUP_SEEN,
  TENDENCY_REPORT_VOTE_THRESHOLD,
  TENDENCY_VOTE_CAST,
  TENDENCY_REPORT_ACKED,
} from '../../lib/tendencyReport'
import { TendencyReportUnlockModal } from './TendencyReportUnlockModal'

const SKIP_PREFIXES = ['/login', '/signup', '/admin', '/goodbye', '/dev', '/welcome']

function shouldSkipPath(pathname) {
  return SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function isTendencyReportPath(pathname) {
  return pathname === '/report/tendency' || pathname.startsWith('/report/tendency/s/')
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
  const popupHandledRef = useRef(false)
  const lastUserIdRef = useRef(null)

  const evaluateUnlock = useCallback(async (reason) => {
    const userId = user?.id
    if (!userId || popupHandledRef.current || busyRef.current) return
    if (shouldSkipPath(pathnameRef.current) || isTendencyReportPath(pathnameRef.current)) return

    busyRef.current = true
    try {
      const status = await fetchTendencyReportStatus()
      if (
        status.popupSeen ||
        !status.eligible ||
        status.acknowledged ||
        status.voteCount < TENDENCY_REPORT_VOTE_THRESHOLD
      ) {
        if (status.popupSeen || status.acknowledged) popupHandledRef.current = true
        return
      }

      if (reason === 'vote' && status.voteCount !== TENDENCY_REPORT_VOTE_THRESHOLD) {
        return
      }

      const marked = await markTendencyReportPopupSeen()
      if (!marked.ok) {
        if (import.meta.env.DEV) {
          console.warn('[TendencyReportGate] popup seen save failed:', marked.error)
        }
        return
      }

      popupHandledRef.current = true
      setShowUnlock(true)
    } finally {
      busyRef.current = false
    }
  }, [user?.id])

  useEffect(() => {
    if (user?.id !== lastUserIdRef.current) {
      lastUserIdRef.current = user?.id ?? null
      popupHandledRef.current = false
      setShowUnlock(false)
    }
    if (!user?.id) return undefined

    const t = window.setTimeout(() => void evaluateUnlock('login'), 500)
    return () => window.clearTimeout(t)
  }, [evaluateUnlock, user?.id])

  useEffect(() => {
    const onVote = () => void evaluateUnlock('vote')
    const onAcked = () => {
      popupHandledRef.current = true
      setShowUnlock(false)
    }
    const onPopupSeen = () => {
      popupHandledRef.current = true
      setShowUnlock(false)
    }
    window.addEventListener(TENDENCY_VOTE_CAST, onVote)
    window.addEventListener(TENDENCY_REPORT_ACKED, onAcked)
    window.addEventListener(TENDENCY_REPORT_POPUP_SEEN, onPopupSeen)
    return () => {
      window.removeEventListener(TENDENCY_VOTE_CAST, onVote)
      window.removeEventListener(TENDENCY_REPORT_ACKED, onAcked)
      window.removeEventListener(TENDENCY_REPORT_POPUP_SEEN, onPopupSeen)
    }
  }, [evaluateUnlock])

  const onClose = useCallback(() => {
    popupHandledRef.current = true
    setShowUnlock(false)
  }, [])

  const onOpenReport = useCallback(() => {
    popupHandledRef.current = true
    setShowUnlock(false)
    navigate('/report/tendency')
  }, [navigate])

  return (
    <TendencyReportUnlockModal
      open={showUnlock}
      nickname={profile?.nickname}
      onClose={onClose}
      onOpenReport={onOpenReport}
    />
  )
}
