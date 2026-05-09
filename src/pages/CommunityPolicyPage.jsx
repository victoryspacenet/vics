import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Heart, MessageCircle, Shield, Sparkles, AlertTriangle, Lightbulb } from 'lucide-react'
import { Logo } from '../components/ui/Logo'

const GUIDELINES = [
  {
    icon: Heart,
    title: '서로 존중하기',
    desc: '다른 사람의 선택과 의견을 존중해요. 비방이나 혐오 표현은 삼가 주세요.',
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
    examples: [
      '부적절한 이미지·혐오 표현으로 경쟁 훼손',
      '타인의 콘텐츠 무단 도용',
    ],
  },
]

const SANCTIONS = [
  { step: 1, label: '1차', desc: '경고 및 해당 콘텐츠 삭제' },
  { step: 2, label: '2차', desc: '서비스 이용 7일 제한' },
  { step: 3, label: '3차', desc: '계정 영구 정지' },
]

export function CommunityPolicyPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const fromRestricted = location.state?.fromRestricted === true

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <Link
          to={fromRestricted ? '/restricted' : '/'}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#22282E] mb-8 transition-colors"
        >
          <ArrowLeft size={16} />
          {fromRestricted ? '접속 제한 화면으로' : '홈으로'}
        </Link>

        <div className="flex items-center gap-3 mb-10">
          <Logo size={32} dark={false} link={false} />
          <h1 className="text-2xl font-black text-[#22282E]">커뮤니티 가이드라인</h1>
        </div>

        <div className="space-y-8">
          {/* 인트로 */}
          <div className="bg-gradient-to-br from-lime-50 to-emerald-50 rounded-2xl p-6 border border-lime-100">
            <p className="text-base font-bold text-[#22282E] leading-relaxed">
              우리는 이런 문화를 만들고 싶어요! 🌱
            </p>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">
              VictorySpace는 모두가 즐겁게 경쟁하고 투표할 수 있는 공간이에요. 아래 가이드라인을 지켜 주시면, 더 따뜻하고 재미있는 커뮤니티를 함께 만들 수 있어요.
            </p>
          </div>

          {/* 가이드라인 목록 (위반 사례 포함) */}
          <div className="space-y-4">
            {GUIDELINES.map((item, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors"
              >
                <div className="flex gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-full bg-[#22282E] text-white flex items-center justify-center">
                    <item.icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-[#22282E] mb-1">{item.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
                {item.examples && item.examples.length > 0 && (
                  <div className="mt-3 pl-14">
                    <p className="text-xs font-bold text-amber-700 mb-1">⚠️ 위반 사례</p>
                    <ul className="text-xs text-gray-600 space-y-0.5">
                      {item.examples.map((ex, j) => (
                        <li key={j} className="flex gap-2">
                          <span className="text-amber-500">•</span>
                          <span>{ex}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 위반 시 조치 안내 */}
          <div className="rounded-2xl border-2 border-amber-100 bg-amber-50/50 p-6">
            <h2 className="flex items-center gap-2 text-lg font-black text-[#22282E] mb-4">
              <AlertTriangle size={20} className="text-amber-600" />
              위반 시 조치 안내
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              동일 유형 반복 위반 시 단계가 누적됩니다. 현재 단계와 다음 조치를 확인하시고, 정정당당한 참여를 부탁드려요.
            </p>
            <div className="space-y-3">
              {SANCTIONS.map((s) => (
                <div
                  key={s.step}
                  className="flex items-start gap-3 p-3 rounded-xl bg-white border border-amber-100"
                >
                  <span className="shrink-0 w-8 h-8 rounded-lg bg-amber-200 text-amber-900 text-sm font-black flex items-center justify-center">
                    {s.label}
                  </span>
                  <p className="text-sm font-bold text-[#22282E] pt-0.5">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 클린 유저 팁 */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6">
            <h2 className="flex items-center gap-2 text-lg font-black text-[#22282E] mb-3">
              <Lightbulb size={20} className="text-emerald-600" />
              클린 유저 팁
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-2">
              부적절한 콘텐츠를 발견하면{' '}
              <strong className="text-emerald-700">[신고하기]</strong>를 눌러주세요!
              <br />
              깨끗한 환경을 위해 적극적인 신고 부탁드려요 :)
            </p>
            <p className="text-xs text-gray-500">
              신고는 문의하기 → 1:1 문의하기에서 카테고리 「신고」를 선택해 접수할 수 있어요.
            </p>
          </div>

          {/* 가이드 확인 버튼 (접속 제한 화면에서 온 경우만) */}
          {fromRestricted && (
            <div className="pt-4">
              <button
                type="button"
                onClick={() => navigate('/restricted', { replace: true })}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-lime-400 via-emerald-400 to-teal-500 text-[#0f1f0f] text-sm font-black shadow-md shadow-emerald-100 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                ✅ 가이드 확인했습니다
              </button>
              <p className="text-xs text-gray-500 text-center mt-2">다시 접속 제한 화면으로 돌아갑니다.</p>
            </div>
          )}

          {/* 마무리 */}
          <div className="text-center py-6">
            <p className="text-sm text-gray-500">
              위 가이드라인을 심각하게 위반하는 경우, 이용약관에 따라 단계별 조치가 적용됩니다.
            </p>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-100 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/terms"
            className="text-sm font-black text-fuchsia-700 hover:text-fuchsia-900 underline decoration-fuchsia-300/70 underline-offset-2"
          >
            이용약관 →
          </Link>
          <Link
            to="/privacy"
            className="text-sm font-black text-fuchsia-700 hover:text-fuchsia-900 underline decoration-fuchsia-300/70 underline-offset-2"
          >
            개인정보처리방침 →
          </Link>
        </div>
      </div>
    </div>
  )
}
