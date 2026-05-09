import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Logo } from '../components/ui/Logo'

export function DeletedPage() {
  const navigate = useNavigate()
  const [info, setInfo]       = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // 탈퇴 직전에 저장해둔 데이터 읽기
    try {
      const raw = sessionStorage.getItem('vics_goodbye')
      if (raw) {
        setInfo(JSON.parse(raw))
        sessionStorage.removeItem('vics_goodbye')
      }
    } catch { /* 무시 */ }

    // 입장 애니메이션 트리거
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [])

  // 가입 후 경과 일수 계산
  const daysWithUs = info?.createdAt
    ? Math.max(1, Math.floor((Date.now() - new Date(info.createdAt).getTime()) / 86400000))
    : null

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center justify-center px-6 py-12 max-w-screen-sm mx-auto">

      {/* 로고 */}
      <div className={`mb-10 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <Logo size={48} dark={false} link={false} />
      </div>

      {/* 작별 아이콘 */}
      <div
        className={`transition-all duration-700 delay-100 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)' }}
      >
        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-inner mb-6">
          <span className="text-6xl select-none" role="img" aria-label="작별">👋</span>
        </div>
      </div>

      {/* 헤드라인 */}
      <div className={`text-center mb-6 transition-all duration-700 delay-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <h1 className="text-2xl font-black text-[#22282E] mb-2">
          탈퇴가 완료되었습니다
        </h1>
        <p className="text-base text-gray-500 font-medium leading-relaxed">
          {info?.nickname ? (
            <><span className="font-black text-[#22282E]">{info.nickname}</span>님의</>
          ) : '당신의'}{' '}
          안목이 그리울 거예요. 💙
        </p>
      </div>

      {/* 구분선 */}
      <div className={`w-full max-w-xs h-px bg-gray-100 mb-6 transition-all duration-700 delay-300 ${visible ? 'opacity-100' : 'opacity-0'}`} />

      {/* 함께한 기간 카드 */}
      {daysWithUs && (
        <div className={`w-full max-w-xs bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-4 text-center transition-all duration-700 delay-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <p className="text-3xl font-black text-[#22282E] mb-1">
            {daysWithUs.toLocaleString()}일
          </p>
          <p className="text-sm text-gray-500">
            님과 함께한 기간 동안의 모든 기록이<br />
            안전하게 정리되었습니다.
          </p>
        </div>
      )}

      {/* 안내 사항 */}
      <div className={`w-full max-w-xs bg-gray-50 rounded-2xl border border-gray-100 px-5 py-4 mb-8 space-y-3 transition-all duration-700 delay-[400ms] ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-1">📢 안내 사항</p>

        <div className="flex items-start gap-2.5">
          <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            계정 정보 및 포인트는 <span className="font-bold text-gray-700">즉시 소멸</span>되며,
            개인 데이터는 <span className="font-bold text-gray-700">7일 이내</span>에 완전히 삭제됩니다.
          </p>
        </div>

        <div className="flex items-start gap-2.5">
          <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            관계 법령에 따라 일부 거래 기록은 최대
            <span className="font-bold text-gray-700"> 5년간 보관</span>될 수 있습니다.
          </p>
        </div>

        <div className="flex items-start gap-2.5">
          <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            동일 이메일로 재가입은
            <span className="font-bold text-gray-700"> 탈퇴 시점으로부터 7일 후</span>부터 가능합니다.
          </p>
        </div>
      </div>

      {/* 재가입 유도 */}
      <div className={`text-center transition-all duration-700 delay-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <p className="text-xs text-gray-400 mb-2">혹시 실수로 탈퇴하셨나요?</p>
        <Link
          to="/signup"
          className="text-sm font-black text-[#22282E] underline underline-offset-4 hover:text-violet-600 transition-colors"
        >
          ✨ 다시 가입하기
        </Link>
      </div>

      {/* 홈으로 */}
      <div className={`mt-8 w-full max-w-xs transition-all duration-700 delay-[600ms] ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <button
          onClick={() => navigate('/')}
          className="w-full py-3.5 rounded-2xl text-sm font-black bg-gradient-to-r from-lime-400 to-emerald-400 text-[#0f1f0f] shadow-md shadow-emerald-100 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all"
        >
          홈으로 돌아가기
        </button>
      </div>

      {/* 하단 여백 */}
      <div className="h-12" />
    </div>
  )
}
