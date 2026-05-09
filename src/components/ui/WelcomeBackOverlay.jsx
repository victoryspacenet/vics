import { useEffect, useRef } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import {
  getPendingWelcomeBack,
  ensureRestrictionLiftPush,
} from '../../lib/restrictionLiftStorage'
import { addDemoEndedRestriction } from '../../lib/warnSanctionStorage'
import { WelcomeBackModal } from './WelcomeBackModal'

const AUTO_SHOWN_KEY = 'vics_welcome_back_auto_shown'

export function WelcomeBackOverlay() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, profile } = useAuthStore()
  const {
    welcomeBackOpen,
    welcomeBackData,
    openWelcomeBackModal,
    closeWelcomeBackModal,
  } = useUIStore()
  // 데모: ?welcomeBackDemo=1 로 방문 시 해제된 제한 시드 후 팝업 테스트
  useEffect(() => {
    if (!user?.id || searchParams.get('welcomeBackDemo') !== '1') return
    void addDemoEndedRestriction(user.id)
    try { sessionStorage.removeItem(AUTO_SHOWN_KEY) } catch { /* ignore */ }
    setSearchParams({}, { replace: true })
  }, [user?.id, searchParams, setSearchParams])

  // 앱 첫 진입 시: 제한 해제 후 펜딩이 있으면 팝업 표시
  useEffect(() => {
    if (!user?.id || !profile) return
    const isAdmin = location.pathname.startsWith('/admin')
    const isRestricted = location.pathname.startsWith('/restricted')
    if (isAdmin || isRestricted) return

    let cancelled = false
    ;(async () => {
      const pending = await getPendingWelcomeBack(user.id, profile)
      if (cancelled || !pending) return
      if (welcomeBackOpen) return

      try {
        const autoShown = sessionStorage.getItem(AUTO_SHOWN_KEY)
        if (autoShown === String(pending.endsAt)) return
        sessionStorage.setItem(AUTO_SHOWN_KEY, String(pending.endsAt))
      } catch {
        // ignore
      }

      await ensureRestrictionLiftPush(user.id, pending)
      if (cancelled) return
      openWelcomeBackModal({
        nickname: pending.nickname,
        avatarUrl: pending.avatarUrl,
        userId: user.id,
        endsAt: pending.endsAt,
      })
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id, profile, location.pathname, welcomeBackOpen, openWelcomeBackModal])

  const handleClose = () => {
    closeWelcomeBackModal()
  }

  return (
    <WelcomeBackModal
      isOpen={welcomeBackOpen}
      onClose={handleClose}
      nickname={welcomeBackData?.nickname}
      avatarUrl={welcomeBackData?.avatarUrl}
      userId={welcomeBackData?.userId}
      endsAt={welcomeBackData?.endsAt}
    />
  )
}
