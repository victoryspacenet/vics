import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, ChevronLeft, Heart, Lightbulb, MessageCircle, ScrollText, Shield, Sparkles } from 'lucide-react'
import { Logo } from '../components/ui/Logo'

const GUIDELINES = [
  {
    icon: Heart,
    title: '서로 존중하기',
    desc: '다른 사람의 선택과 의견을 존중해요. 비방이나 혐오 표현은 삼가 주세요.',
    accent: 'from-rose-500 to-pink-500',
    shadow: 'shadow-rose-300/40',
    bar: 'from-rose-400 to-pink-500',
    examples: [
      '상대 선택을 비난하는 발언 ("그거 골랐다고? 눈이 없네")',
      '외모·성별·인종 등 혐오 표현',
      '특정 유저를 지속적으로 비난하거나 집단으로 공격',
    ],
  },
  {
    icon: MessageCircle,
    title: '주제에 맞게 참여하기',
    desc: '경쟁 주제와 관련 없는 내용을 반복 업로드하거나, 의도적으로 주제를 이탈하는 행위는 자제해 주세요.',
    accent: 'from-violet-500 to-fuchsia-500',
    shadow: 'shadow-violet-300/40',
    bar: 'from-violet-400 to-fuchsia-500',
    examples: [
      '"피자 vs 치킨" 경쟁에 신발 사진 올리기',
      '광고·홍보·스팸 콘텐츠 반복 업로드',
      '주제와 무관한 사진·텍스트로 경쟁 의도를 훼손',
    ],
  },
  {
    icon: Shield,
    title: '정당한 투표하기',
    desc: '매크로, 대리 투표, 다중 계정 등 부정한 방법으로 투표하지 않아요. 모두가 공정하게 즐길 수 있도록 해요.',
    accent: 'from-blue-500 to-indigo-500',
    shadow: 'shadow-blue-300/40',
    bar: 'from-blue-400 to-indigo-500',
    examples: [
      '봇·매크로로 자동 투표',
      '친구에게 "나 대신 이쪽에 투표해줘" 요청',
      '여러 계정으로 같은 경쟁에 반복 투표',
    ],
  },
  {
    icon: Sparkles,
    title: '재미있게 즐기기',
    desc: '다양한 경쟁에 참여하고, 새로운 관점을 발견해 보세요. 우리는 함께 더 좋은 커뮤니티를 만들어요.',
    accent: 'from-amber-500 to-orange-500',
    shadow: 'shadow-amber-300/40',
    bar: 'from-amber-400 to-orange-500',
    examples: [
      '부적절한 이미지·혐오 표현으로 경쟁 훼손',
      '타인의 콘텐츠 무단 도용',
    ],
  },
]

const SANCTIONS = [
  { step: 1, label: '1차', desc: '경고 및 해당 콘텐츠 삭제', color: 'from-yellow-400 to-amber-500', text: 'text-amber-950' },
  { step: 2, label: '2차', desc: '서비스 이용 7일 제한', color: 'from-orange-500 to-rose-500', text: 'text-white' },
  { step: 3, label: '3차', desc: '계정 영구 정지', color: 'from-rose-600 to-red-600', text: 'text-white' },
]

export function CommunityPolicyPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const fromRestricted = location.state?.fromRestricted === true

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-rose-50/98 via-fuchsia-50/35 to-cyan-50/50">
      {/* 앰비언트 배경 */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-gradient-radial from-fuchsia-300/20 to-transparent blur-3xl" />
        <div className="absolute top-1/3 -right-24 w-72 h-72 rounded-full bg-gradient-radial from-pink-300/15 to-transparent blur-3xl" />
        <div className="absolute bottom-24 left-1/4 w-64 h-64 rounded-full bg-gradient-radial from-rose-300/12 to-transparent blur-3xl" />
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12 relative z-10">
        {/* 뒤로가기 */}
        <Link
          to={fromRestricted ? '/restricted' : '/'}
          className="inline-flex items-center gap-1 pl-2 pr-3 py-2 mb-8 rounded-xl bg-gradient-to-r from-fuchsia-50 to-pink-50 border border-pink-200/60 hover:from-fuchsia-100 hover:to-pink-100 transition-all shadow-sm"
        >
          <ChevronLeft size={16} className="text-fuchsia-700" />
          <span className="text-xs font-bold text-fuchsia-700">
            {fromRestricted ? '접속 제한 화면으로' : '홈으로'}
          </span>
        </Link>

        {/* 헤더 */}
        <div className="rounded-2xl overflow-hidden border border-fuchsia-200/50 bg-white/90 shadow-[0_4px_28px_-10px_rgba(192,38,211,0.2)] backdrop-blur-sm mb-8">
          <div className="h-1.5 bg-gradient-to-r from-fuchsia-500 via-pink-500 to-rose-400" />
          <div className="flex items-center gap-4 p-6">
            <Logo size={36} dark={false} link={false} />
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-fuchsia-500 to-pink-500 shadow-sm">
                  <ScrollText size={12} className="text-white" />
                </span>
                <span className="text-[10px] font-black bg-gradient-to-r from-fuchsia-600 to-pink-600 bg-clip-text text-transparent uppercase tracking-widest">커뮤니티</span>
              </div>
              <h1 className="text-xl font-black bg-gradient-to-r from-fuchsia-700 via-pink-600 to-rose-600 bg-clip-text text-transparent tracking-tight">커뮤니티 가이드라인</h1>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* 인트로 배너 */}
          <div className="rounded-2xl overflow-hidden border border-emerald-200/60 shadow-sm">
            <div className="h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />
            <div className="bg-gradient-to-br from-emerald-50/90 via-teal-50/70 to-cyan-50/50 p-5">
              <p className="text-base font-black text-emerald-900 leading-relaxed mb-1.5">
                우리는 이런 문화를 만들고 싶어요! 🌱
              </p>
              <p className="text-sm text-emerald-800/75 leading-relaxed">
                VictorySpace는 모두가 즐겁게 경쟁하고 투표할 수 있는 공간이에요. 아래 가이드라인을 지켜 주시면, 더 따뜻하고 재미있는 커뮤니티를 함께 만들 수 있어요.
              </p>
            </div>
          </div>

          {/* 가이드라인 목록 */}
          <div className="space-y-3">
            {GUIDELINES.map((item, i) => (
              <div
                key={i}
                className="relative rounded-2xl overflow-hidden border border-pink-100/70 bg-white/92 shadow-[0_4px_20px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px] hover:shadow-[0_8px_28px_-10px_rgba(192,38,211,0.22)] hover:-translate-y-0.5 transition-all duration-200"
              >
                {/* 좌측 액센트 바 */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${item.bar} rounded-l-2xl`} />
                <div className="p-4 pl-5">
                  <div className="flex gap-3 items-start">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${item.accent} shadow-md ${item.shadow}`}>
                      <item.icon size={18} className="text-white" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-fuchsia-950 mb-1">{item.title}</h3>
                      <p className="text-sm text-fuchsia-900/75 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                  {item.examples && item.examples.length > 0 && (
                    <div className="mt-3 ml-12 rounded-xl bg-gradient-to-br from-amber-50/80 to-orange-50/60 border border-amber-200/50 px-3.5 py-2.5">
                      <p className="text-xs font-black text-amber-700 mb-1.5">⚠️ 위반 사례</p>
                      <ul className="text-xs text-amber-900/75 space-y-1">
                        {item.examples.map((ex, j) => (
                          <li key={j} className="flex gap-2">
                            <span className="text-amber-500 shrink-0">•</span>
                            <span>{ex}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 위반 시 조치 안내 */}
          <div className="rounded-2xl overflow-hidden border border-amber-200/60 shadow-sm">
            <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400" />
            <div className="bg-gradient-to-br from-amber-50/90 via-orange-50/60 to-rose-50/40 p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-md shadow-amber-300/40">
                  <AlertTriangle size={16} className="text-white" />
                </span>
                <h2 className="text-base font-black bg-gradient-to-r from-amber-700 to-orange-700 bg-clip-text text-transparent">위반 시 조치 안내</h2>
              </div>
              <p className="text-sm text-amber-900/75 mb-4 leading-relaxed">
                동일 유형 반복 위반 시 단계가 누적됩니다. 정정당당한 참여를 부탁드려요.
              </p>
              <div className="space-y-2.5">
                {SANCTIONS.map((s) => (
                  <div
                    key={s.step}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/80 border border-amber-100/80 shadow-sm"
                  >
                    <span className={`shrink-0 px-2.5 py-1.5 rounded-lg bg-gradient-to-br ${s.color} ${s.text} text-xs font-black shadow-sm`}>
                      {s.label}
                    </span>
                    <p className="text-sm font-bold text-fuchsia-950">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 클린 유저 팁 */}
          <div className="rounded-2xl overflow-hidden border border-emerald-200/60 shadow-sm">
            <div className="h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />
            <div className="bg-gradient-to-br from-emerald-50/90 via-teal-50/60 to-cyan-50/40 p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-md shadow-emerald-300/40">
                  <Lightbulb size={16} className="text-white" />
                </span>
                <h2 className="text-base font-black bg-gradient-to-r from-emerald-700 to-teal-700 bg-clip-text text-transparent">클린 유저 팁</h2>
              </div>
              <p className="text-sm text-emerald-900/80 leading-relaxed mb-2">
                부적절한 콘텐츠를 발견하면{' '}
                <strong className="text-emerald-700 font-black">[신고하기]</strong>를 눌러주세요!
                <br />
                깨끗한 환경을 위해 적극적인 신고 부탁드려요 :)
              </p>
              <p className="text-xs text-emerald-800/60 mt-2 bg-emerald-100/60 rounded-lg px-3 py-2">
                신고는 문의하기 → 1:1 문의하기에서 카테고리 「신고」를 선택해 접수할 수 있어요.
              </p>
            </div>
          </div>

          {/* 가이드 확인 버튼 (접속 제한 화면에서 온 경우만) */}
          {fromRestricted && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate('/restricted', { replace: true })}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white text-sm font-black shadow-[0_4px_18px_-4px_rgba(16,185,129,0.5)] hover:shadow-[0_4px_24px_-4px_rgba(16,185,129,0.65)] hover:-translate-y-0.5 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                ✅ 가이드 확인했습니다
              </button>
              <p className="text-xs text-fuchsia-700/55 text-center mt-2">다시 접속 제한 화면으로 돌아갑니다.</p>
            </div>
          )}

          {/* 마무리 */}
          <div className="text-center py-4">
            <p className="text-xs text-fuchsia-700/50">
              위 가이드라인을 심각하게 위반하는 경우, 이용약관에 따라 단계별 조치가 적용됩니다.
            </p>
          </div>
        </div>

        {/* 푸터 링크 */}
        <div className="mt-10 pt-6 border-t border-pink-100/60 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/terms"
            className="inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-fuchsia-200/60 bg-white/80 text-sm font-black text-fuchsia-700 hover:bg-fuchsia-50 hover:border-fuchsia-300/70 transition-all shadow-sm"
          >
            이용약관 →
          </Link>
          <Link
            to="/privacy"
            className="inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-fuchsia-200/60 bg-white/80 text-sm font-black text-fuchsia-700 hover:bg-fuchsia-50 hover:border-fuchsia-300/70 transition-all shadow-sm"
          >
            개인정보처리방침 →
          </Link>
        </div>
      </div>
    </div>
  )
}
