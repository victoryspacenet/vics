import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Logo } from '../components/ui/Logo'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { fetchRestrictionDisplay } from '../lib/restrictionStorage'

function formatCountdown(msLeft) {
  if (msLeft <= 0) return { done: true, text: '제한이 해제되었습니다' }
  const totalSec = Math.floor(msLeft / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60
  if (days > 0) {
    return {
      done: false,
      text: `${days}일 ${hours}시간 ${String(mins).padStart(2, '0')}분 ${String(secs).padStart(2, '0')}초`,
    }
  }
  return {
    done: false,
    text: `${String(hours).padStart(2, '0')}시간 ${String(mins).padStart(2, '0')}분 ${String(secs).padStart(2, '0')}초`,
  }
}

export function AccessRestrictedPage() {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuthStore()
  const { openLoginModal } = useUIStore()
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState({ done: false, text: '--' })
  const [detailOpen, setDetailOpen] = useState(true)

  const loadInfo = useCallback(async () => {
    if (!user?.id) {
      setInfo(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const restriction = await fetchRestrictionDisplay(user.id, profile)
      setInfo(restriction)
    } finally {
      setLoading(false)
    }
  }, [user?.id, profile])

  useEffect(() => {
    void loadInfo()
  }, [loadInfo])

  useEffect(() => {
    if (!info?.endsAt) return
    const tick = () => {
      const msLeft = info.endsAt - Date.now()
      setCountdown(formatCountdown(msLeft))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [info?.endsAt])

  /** 카운트다운이 0이 되면 DB와 동기화 후 홈으로 */
  useEffect(() => {
    if (!user?.id || !info?.endsAt || !countdown.done) return
    let cancelled = false
    ;(async () => {
      const again = await fetchRestrictionDisplay(user.id, profile)
      if (cancelled) return
      if (!again) {
        navigate('/', { replace: true })
        return
      }
      setInfo(again)
    })()
    return () => {
      cancelled = true
    }
  }, [countdown.done, info?.endsAt, user?.id, profile, navigate])

  const handleAppeal = () => {
    if (!user) {
      openLoginModal()
      return
    }
    const q = info?.sanctionWarningId
      ? `?sanctionWarningId=${encodeURIComponent(info.sanctionWarningId)}`
      : ''
    navigate(`/inquiry/appeal${q}`)
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const nickname = info?.nickname ?? profile?.nickname ?? '회원'

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center px-4 py-8 sm:py-12 max-w-lg mx-auto">
        <div className="mb-8">
          <Logo size={40} dark={false} link={true} />
        </div>
        <h1 className="text-xl font-black text-[#22282E] mb-4">이용 제한 안내</h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          로그인 후 제한 내역을 확인할 수 있어요.
        </p>
        <button
          type="button"
          onClick={() => openLoginModal()}
          className="w-full max-w-sm py-3.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white text-sm font-black"
        >
          로그인
        </button>
        <Link to="/" className="mt-4 text-sm font-bold text-gray-500 hover:text-gray-800">
          홈으로
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center justify-center px-4">
        <div className="h-10 w-10 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-gray-500">제한 정보를 불러오는 중…</p>
      </div>
    )
  }

  if (!info) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center px-4 py-12 max-w-lg mx-auto text-center">
        <div className="mb-8">
          <Logo size={40} dark={false} link={true} />
        </div>
        <p className="text-lg font-black text-[#22282E] mb-2">현재 이용 제한이 없어요</p>
        <p className="text-sm text-gray-600 mb-8">
          제한이 해제되었거나 아직 등록된 제한이 없습니다.
        </p>
        <Link
          to="/"
          className="w-full max-w-sm py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-black text-center"
        >
          홈으로 이동
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center px-4 py-8 sm:py-12 max-w-lg mx-auto">
      <div className="mb-8">
        <Logo size={40} dark={false} link={true} />
      </div>

      <div className="w-full max-w-sm h-px bg-gray-200 mb-8" />

      <h1 className="text-xl font-black text-[#22282E] mb-6">
        서비스 이용이 제한됨
      </h1>

      <div className="w-full max-w-sm h-px bg-gray-200 mb-8" />

      <div className="w-full max-w-sm text-center mb-6">
        <p className="text-base font-bold text-[#22282E] mb-2">
          {nickname}님, 잠시만 멈춰주세요!
        </p>
        <p className="text-sm text-gray-600 leading-relaxed">
          커뮤니티 가이드라인에 따라
          <br />
          아래 항목에 대해 일시적으로 이용이 제한되었습니다.
        </p>
      </div>

      <div className="w-full max-w-sm mb-6">
        <button
          type="button"
          onClick={() => setDetailOpen((o) => !o)}
          className="w-full flex items-center justify-between text-left py-2 text-sm font-bold text-[#22282E] hover:text-gray-600 transition-colors"
        >
          이용 제한 상세
          <span className="text-gray-400 transform transition-transform">{detailOpen ? '▲' : '▼'}</span>
        </button>
        {detailOpen && (
          <div className="mt-2 px-4 py-4 rounded-xl bg-gray-50 border border-gray-100 text-sm space-y-2">
            <p><strong className="text-gray-600">사유:</strong> {info.reason}</p>
            <p><strong className="text-gray-600">제한 항목:</strong> {info.target}</p>
            <p><strong className="text-gray-600">기간:</strong> {info.startDate} — {info.endDate}</p>
          </div>
        )}
      </div>

      <div className="w-full max-w-sm mb-8">
        <p className="text-sm font-bold text-gray-600 mb-2">해제까지 남은 시간</p>
        <div className="px-5 py-4 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
          <span className="text-lg font-black text-emerald-700 tabular-nums">
            {countdown.done ? '곧 해제됩니다…' : countdown.text}
          </span>
        </div>
      </div>

      <p className="text-sm text-gray-500 text-center italic mb-2 max-w-sm">
        &quot;정정당당한 매치업 문화를 위해
        <br />
        조금만 기다려주세요!&quot;
      </p>
      <p className="text-xs text-gray-400 text-center mb-8 max-w-sm">
        혹시 억울하신가요? 저희가 실수했을 수도 있어요.
        <br />
        아래 버튼으로 알려주세요!
      </p>

      <div className="w-full max-w-sm space-y-3">
        <button
          type="button"
          onClick={handleAppeal}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-lime-400 via-emerald-400 to-teal-500 text-[#0f1f0f] text-sm font-black shadow-md shadow-emerald-100 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          이의 신청하기
        </button>
        <Link
          to="/community-policy"
          state={{ fromRestricted: true }}
          className="block w-full py-3.5 rounded-xl border-2 border-gray-200 text-gray-700 text-sm font-bold hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98] transition-all text-center"
        >
          커뮤니티 가이드 확인
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="block w-full py-3.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200 active:scale-[0.98] transition-all text-center"
        >
          로그아웃
        </button>
      </div>

      <div className="h-8" />
    </div>
  )
}
