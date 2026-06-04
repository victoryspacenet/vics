import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import confetti from 'canvas-confetti'
import { Trophy, Zap, Star } from 'lucide-react'
import { Logo } from '../components/ui/Logo'
import { supabase } from '../lib/supabase'
import { SIGNUP_BONUS_POINTS } from '../lib/signupRewards'

// 컨페티 색상 — 네온 브랜드 계열
const CONFETTI_COLORS = [
  '#a855f7', '#ec4899', '#f59e0b',
  '#22d3ee', '#4ade80', '#fb923c',
  '#f472b6', '#818cf8',
]

function fireConfetti() {
  const count = 220
  const defaults = { startVelocity: 30, spread: 360, ticks: 80, zIndex: 9999 }

  function shot(particleRatio, opts) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
      colors: CONFETTI_COLORS,
    })
  }

  shot(0.25, { spread: 26,  startVelocity: 55, origin: { x: 0.5, y: 0.55 } })
  shot(0.20, { spread: 60,  origin: { x: 0.5, y: 0.55 } })
  shot(0.35, { spread: 100, decay: 0.91, scalar: 0.8, origin: { x: 0.5, y: 0.55 } })
  shot(0.10, { speed: 1,    spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2, origin: { x: 0.5, y: 0.55 } })
  shot(0.10, { spread: 120, startVelocity: 45, origin: { x: 0.5, y: 0.55 } })

  // 좌우 사이드 샷
  setTimeout(() => {
    confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0, y: 0.65 }, colors: CONFETTI_COLORS, zIndex: 9999 })
    confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1, y: 0.65 }, colors: CONFETTI_COLORS, zIndex: 9999 })
  }, 300)
}

export function WelcomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state || {}
  const { nickname, avatarUrl } = state

  const [show, setShow] = useState(false)
  const [rewardVisible, setRewardVisible] = useState(false)
  const hasFired = useRef(false)

  // 닉네임 없으면 홈으로
  if (!nickname) return <Navigate to="/" replace />

  useEffect(() => {
    // 단계적 등장 애니메이션
    const t1 = setTimeout(() => setShow(true), 80)
    const t2 = setTimeout(() => setRewardVisible(true), 600)

    // 컨페티 2차 발사
    if (!hasFired.current) {
      hasFired.current = true
      fireConfetti()
      setTimeout(fireConfetti, 1800)
    }

    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  const handleStart = () => navigate('/', { replace: true })

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex flex-col items-center bg-gradient-to-b from-[#0f0c1d] via-[#1a1035] to-[#0f172a]">

      {/* 배경 글로우 블롭 */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-violet-600/20 blur-[100px]" />
        <div className="absolute bottom-[10%] left-[-10%] w-[300px] h-[300px] rounded-full bg-fuchsia-600/15 blur-[80px]" />
        <div className="absolute top-[30%] right-[-5%] w-[250px] h-[250px] rounded-full bg-cyan-500/10 blur-[70px]" />
        {/* 별 파티클 */}
        {Array.from({ length: 18 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/40 animate-pulse"
            style={{
              width: `${Math.random() * 3 + 1}px`,
              height: `${Math.random() * 3 + 1}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      {/* 상단 헤더 */}
      <div className="relative z-10 w-full max-w-sm px-5 pt-5 pb-2 flex items-center justify-center">
        <Logo size={32} dark={false} link={false} />
      </div>

      {/* 메인 컨텐츠 */}
      <div className="relative z-10 w-full max-w-sm px-5 flex flex-col items-center pt-4 pb-16">

        {/* 환영 텍스트 */}
        <div
          className="text-center mb-6 transition-all duration-700"
          style={{ opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(20px)' }}
        >
          <p className="text-sm font-bold text-violet-300/80 tracking-widest uppercase mb-1">Welcome to VICTORYSPACE</p>
          <h1 className="text-2xl font-black text-white leading-tight">
            ✨ 환영합니다,<br />
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
              {nickname}
            </span>
            님! ✨
          </h1>
        </div>

        {/* 아바타 */}
        <div
          className="mb-6 transition-all duration-700 delay-100"
          style={{ opacity: show ? 1 : 0, transform: show ? 'scale(1)' : 'scale(0.8)' }}
        >
          <div className="relative">
            {/* 글로우 링 */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 blur-md opacity-70 scale-110" />
            <div className="relative w-24 h-24 rounded-full ring-4 ring-white/20 overflow-hidden bg-gradient-to-br from-violet-600 to-fuchsia-700 flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="프로필" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-black text-white select-none">
                  {nickname?.[0]?.toUpperCase() || '?'}
                </span>
              )}
            </div>
            {/* 트로피 뱃지 */}
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/40 ring-2 ring-[#1a1035]">
              <Trophy size={14} className="text-white" />
            </div>
          </div>
        </div>

        {/* 부제 */}
        <div
          className="text-center mb-6 transition-all duration-700 delay-150"
          style={{ opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(16px)' }}
        >
          <p className="text-base font-black text-white">VICTORYSPACE의 첫걸음!</p>
          <p className="text-sm font-bold text-fuchsia-300 mt-0.5">가입 축하 선물이 도착했어요 🎁</p>
        </div>

        {/* 보상 카드 */}
        <div
          className="w-full mb-6 transition-all duration-700 delay-300"
          style={{ opacity: rewardVisible ? 1 : 0, transform: rewardVisible ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.95)' }}
        >
          <div className="relative rounded-2xl overflow-hidden">
            {/* 카드 배경 */}
            <div className="absolute inset-0 bg-gradient-to-br from-violet-600/40 via-fuchsia-600/30 to-pink-600/40 backdrop-blur-sm" />
            <div className="absolute inset-0 border border-white/15 rounded-2xl" />
            {/* 빛 줄기 */}
            <div className="absolute -top-4 -right-4 w-32 h-32 rounded-full bg-fuchsia-400/20 blur-2xl" />

            <div className="relative px-5 py-5 space-y-3">
              {/* 포인트 보상 */}
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0">
                  <Zap size={20} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-black text-white leading-snug">
                    <span className="text-white">가입 보상 포인트 💎 </span>
                    <span className="bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">
                      +{SIGNUP_BONUS_POINTS.toLocaleString('ko-KR')} P
                    </span>
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/30 text-amber-300 text-[10px] font-black">
                  지급 완료
                </span>
              </div>

              <div className="border-t border-white/10" />

              {/* 티어 보상 */}
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/30 shrink-0">
                  <Star size={20} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-white/60 mb-0.5">첫 번째 티어 획득</p>
                  <p className="text-base font-black text-white leading-none">
                    <span className="text-fuchsia-300">'🎮Player'</span>
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-fuchsia-400/20 border border-fuchsia-400/30 text-fuchsia-300 text-[10px] font-black">
                  획득
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CTA 안내 문구 */}
        <div
          className="w-full mb-3 transition-all duration-700 delay-500"
          style={{ opacity: rewardVisible ? 1 : 0, transform: rewardVisible ? 'translateY(0)' : 'translateY(16px)' }}
        >
          <p className="text-center text-xs font-bold text-white/50 mb-3">
            🔍 지금 바로 투표하고 점수 쌓기
          </p>

          {/* 시작하기 버튼 */}
          <button
            onClick={handleStart}
            className="w-full relative group"
          >
            {/* 버튼 글로우 */}
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 blur-md opacity-70 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 text-white text-base font-black tracking-tight shadow-xl
              group-hover:brightness-110 group-active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2">
              🚀 VICTORYSPACE 시작하기
            </div>
          </button>
        </div>

        {/* 하단 안내 */}
        <p
          className="text-xs text-white/30 text-center transition-all duration-700 delay-700"
          style={{ opacity: rewardVisible ? 1 : 0 }}
        >
          프로필은 나중에 수정할 수 있어요!
        </p>
      </div>
    </div>
  )
}
