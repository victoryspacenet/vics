import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Logo } from '../components/ui/Logo'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { getRestrictionInfo } from '../lib/restrictionStorage'

function formatCountdown(msLeft) {
  if (msLeft <= 0) return { done: true, text: '00시간 00분 00초' }
  const totalSec = Math.floor(msLeft / 1000)
  const hours = Math.floor(totalSec / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60
  return {
    done: false,
    text: `${String(hours).padStart(2, '0')}시간 ${String(mins).padStart(2, '0')}분 ${String(secs).padStart(2, '0')}초`,
  }
}

export function AccessRestrictedPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { openLoginModal } = useUIStore()
  const [info, setInfo] = useState(null)
  const [countdown, setCountdown] = useState({ done: false, text: '--' })
  const [detailOpen, setDetailOpen] = useState(true)

  useEffect(() => {
    const restriction = getRestrictionInfo(user?.id, profile)
    setInfo(restriction)
  }, [user?.id, profile])

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

  const handleAppeal = () => {
    if (!user) {
      openLoginModal()
      return
    }
    navigate('/inquiry/appeal')
  }

  const nickname = info?.nickname ?? profile?.nickname ?? '회원'

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center px-4 py-8 sm:py-12 max-w-lg mx-auto">
      {/* 로고 */}
      <div className="mb-8">
        <Logo size={40} dark={false} link={true} />
      </div>

      {/* 구분선 */}
      <div className="w-full max-w-sm h-px bg-gray-200 mb-8" />

      {/* 제목 */}
      <h1 className="text-xl font-black text-[#22282E] mb-6">
        🚫 서비스 이용이 제한됨
      </h1>

      <div className="w-full max-w-sm h-px bg-gray-200 mb-8" />

      {/* 메인 메시지 */}
      <div className="w-full max-w-sm text-center mb-6">
        <p className="text-base font-bold text-[#22282E] mb-2">
          {nickname}님, 잠시만 멈춰주세요!
        </p>
        <p className="text-sm text-gray-600 leading-relaxed">
          커뮤니티 가이드라인 위반으로 인해
          <br />
          현재 서비스 이용이 일시 정지되었습니다.
        </p>
      </div>

      {/* 이용 제한 상세 (토글) */}
      <div className="w-full max-w-sm mb-6">
        <button
          type="button"
          onClick={() => setDetailOpen((o) => !o)}
          className="w-full flex items-center justify-between text-left py-2 text-sm font-bold text-[#22282E] hover:text-gray-600 transition-colors"
        >
          이용 제한 상세
          <span className="text-gray-400 transform transition-transform">{detailOpen ? '▲' : '▼'}</span>
        </button>
        {detailOpen && info && (
          <div className="mt-2 px-4 py-4 rounded-xl bg-gray-50 border border-gray-100 text-sm space-y-2">
            <p><strong className="text-gray-600">사유:</strong> {info.reason}</p>
            <p><strong className="text-gray-600">대상:</strong> {info.target}</p>
            <p><strong className="text-gray-600">기간:</strong> {info.startDate} - {info.endDate}</p>
          </div>
        )}
      </div>

      {/* 해제까지 남은 시간 */}
      <div className="w-full max-w-sm mb-8">
        <p className="text-sm font-bold text-gray-600 mb-2">🔓 해제까지 남은 시간</p>
        <div className="px-5 py-4 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
          <span className="text-lg font-black text-emerald-700 tabular-nums">
            {countdown.done ? '해제됨' : countdown.text}
          </span>
        </div>
      </div>

      {/* 인용문 */}
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

      {/* 버튼들 */}
      <div className="w-full max-w-sm space-y-3">
        <button
          type="button"
          onClick={handleAppeal}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-lime-400 via-emerald-400 to-teal-500 text-[#0f1f0f] text-sm font-black shadow-md shadow-emerald-100 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          📝 이의 신청하기
        </button>
        <Link
          to="/community-policy"
          state={{ fromRestricted: true }}
          className="block w-full py-3.5 rounded-xl border-2 border-gray-200 text-gray-700 text-sm font-bold hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98] transition-all text-center"
        >
          📖 커뮤니티 가이드 확인
        </Link>
        <Link
          to="/"
          className="block w-full py-3.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-bold hover:bg-gray-200 active:scale-[0.98] transition-all text-center"
        >
          🏠 홈으로 (눈팅만 가능)
        </Link>
      </div>

      <div className="h-8" />
    </div>
  )
}
