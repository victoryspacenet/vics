import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { fetchVcardClapStats } from '../../lib/vcardClaps'
import { FANDOM_UI_WIRE, fandomUiDemoGateEnabled } from '../../lib/fandomUiDemo'
import { fetchAckedMilestones, findPendingMilestone } from '../../lib/fandomMilestones'
import { FandomMilestoneModal } from './FandomMilestoneModal'
import { FandomDiamondLegendModal } from './FandomDiamondLegendModal'

const SKIP_PREFIXES = ['/login', '/signup', '/admin', '/goodbye', '/dev']
/** 라우트 전환마다 clap stats·마일스톤 DB 조회하지 않도록 */
const MILESTONE_CHECK_TTL_MS = 90_000

function shouldSkipPath(pathname) {
  return SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function FandomMilestoneGate() {
  const location = useLocation()
  const pathnameRef = useRef(location.pathname)
  pathnameRef.current = location.pathname

  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile) // fandom_points 갱신 시 마일스톤 재평가
  const fetchProfile = useAuthStore((s) => s.fetchProfile)
  const showToast = useUIStore((s) => s.showToast)

  const [milestone, setMilestone] = useState(null)
  const busyRef = useRef(false)
  const lastCheckAtRef = useRef(0)
  const lastCheckFpRef = useRef('')
  const profileFpRef = useRef('')
  profileFpRef.current = `${profile?.fandom_points ?? ''}:${profile?.updated_at ?? ''}`

  const check = useCallback(async () => {
    if (!user?.id || shouldSkipPath(pathnameRef.current)) {
      setMilestone(null)
      return
    }
    const fp = profileFpRef.current
    const now = Date.now()
    if (
      now - lastCheckAtRef.current < MILESTONE_CHECK_TTL_MS &&
      lastCheckFpRef.current === fp
    ) {
      return
    }
    if (busyRef.current) return
    busyRef.current = true
    lastCheckAtRef.current = now
    lastCheckFpRef.current = fp
    try {
      const { total: rawTotal, error } = await fetchVcardClapStats(user.id)
      if (error) return
      let total = Number(rawTotal || 0)
      if (fandomUiDemoGateEnabled()) {
        total = Math.max(total, FANDOM_UI_WIRE.claps)
      }
      const acks = await fetchAckedMilestones(user.id)
      const pending = findPendingMilestone(total, acks)
      if (!pending) {
        setMilestone(null)
        return
      }
      const snooze = sessionStorage.getItem(`vics:fandom-snooze-${user.id}-${pending}`)
      if (snooze) {
        setMilestone(null)
        return
      }
      setMilestone(pending)
    } finally {
      busyRef.current = false
    }
  }, [user?.id])

  useEffect(() => {
    const t = window.setTimeout(() => void check(), 400)
    return () => window.clearTimeout(t)
  }, [check, profile?.updated_at, profile?.fandom_points])

  const onClose = useCallback(() => {
    if (user?.id && milestone) {
      sessionStorage.setItem(`vics:fandom-snooze-${user.id}-${milestone}`, '1')
    }
    setMilestone(null)
  }, [user?.id, milestone])

  const onClaimed = useCallback(async () => {
    if (user?.id) {
      sessionStorage.removeItem(`vics:fandom-snooze-${user.id}-${milestone}`)
      await fetchProfile(user.id, { force: true })
    }
    showToast('달성을 기록했어요! 내 팬덤에서 배지와 F-Point를 확인해 보세요 ✨', 'success')
    setMilestone(null)
  }, [user?.id, milestone, fetchProfile, showToast])

  if (milestone === 5000) {
    return (
      <FandomDiamondLegendModal
        open={milestone === 5000}
        nickname={profile?.nickname}
        onClose={onClose}
        onClaimed={onClaimed}
      />
    )
  }

  return (
    <FandomMilestoneModal
      open={Boolean(milestone)}
      milestone={milestone}
      onClose={onClose}
      onClaimed={onClaimed}
    />
  )
}
