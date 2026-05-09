import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '../components/ui/Logo'
import { cn } from '../lib/utils'

/** MZ 파스텔 — 약관·정책 계열 */
const PAGE_BG =
  'bg-gradient-to-br from-rose-50/98 via-fuchsia-50/35 to-cyan-50/50'
const SECTION_CARD =
  'rounded-2xl border border-pink-100/60 bg-white/92 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px]'

const bodyText = 'text-fuchsia-900/88'
const headingClass = 'text-base font-black text-fuchsia-950 mb-3'

export function PrivacyPage() {
  return (
    <div className={cn('min-h-screen', PAGE_BG)}>
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-bold text-fuchsia-700 hover:text-fuchsia-900 mb-8 transition-colors"
        >
          <ArrowLeft size={16} className="shrink-0" />
          홈으로
        </Link>

        <div
          className={cn(
            SECTION_CARD,
            'p-6 sm:p-8 mb-8 border-pink-100/70 bg-gradient-to-br from-white/95 via-rose-50/30 to-fuchsia-50/20'
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-fuchsia-100 to-cyan-100 border border-pink-200/50 flex items-center justify-center shadow-sm">
              <Logo size={28} dark={false} link={false} />
            </div>
            <h1 className="text-2xl font-black text-fuchsia-950 tracking-tight">개인정보처리방침</h1>
          </div>
        </div>

        <div className={cn(SECTION_CARD, 'p-6 sm:p-8 border-pink-100/70')}>
          <div className="max-w-none text-sm leading-relaxed space-y-8">
            <p className="text-xs font-black text-fuchsia-500 uppercase tracking-wider">
              시행일: 2026년 1월 1일
            </p>

            <section>
              <h2 className={headingClass}>1. 수집 목적</h2>
              <p className={bodyText}>
                회사는 다음의 목적으로 개인정보를 수집·이용합니다.
              </p>
              <ul className={cn('list-disc pl-5 mt-2 space-y-1 marker:text-fuchsia-400', bodyText)}>
                <li>서비스 제공(회원가입, 로그인, 경쟁 생성·투표, 랭킹 등)</li>
                <li>서비스 개선 및 신규 서비스 개발</li>
                <li>고객 문의 응대 및 분쟁 해결</li>
                <li>법령에 따른 의무 이행</li>
              </ul>
            </section>

            <section>
              <h2 className={headingClass}>2. 수집 항목</h2>
              <p className={bodyText}>
                회사는 서비스 제공에 필요한 최소한의 정보만 수집합니다.
              </p>
              <ul className={cn('list-disc pl-5 mt-2 space-y-1 marker:text-fuchsia-400', bodyText)}>
                <li><strong className="text-fuchsia-950 font-bold">필수:</strong> 이메일, 닉네임, 성별, 나이, 프로필 이미지(선택 시)</li>
                <li><strong className="text-fuchsia-950 font-bold">소셜 로그인 시:</strong> 해당 서비스에서 제공하는 식별자, 이메일, 프로필 사진 등</li>
              </ul>
            </section>

            <section>
              <h2 className={headingClass}>3. 보유 기간</h2>
              <p className={bodyText}>
                회사는 회원 탈퇴 시 개인정보를 즉시 삭제합니다. 단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.
              </p>
              <ul className={cn('list-disc pl-5 mt-2 space-y-1 marker:text-fuchsia-400', bodyText)}>
                <li>계약 또는 청약철회 등에 관한 기록: 5년</li>
                <li>소비자 불만 또는 분쟁처리에 관한 기록: 3년</li>
                <li>웹사이트 방문 기록: 3개월</li>
              </ul>
            </section>

            <section>
              <h2 className={headingClass}>4. 제3자 제공</h2>
              <p className={bodyText}>
                회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만, 다음의 경우에는 예외로 합니다.
              </p>
              <ul className={cn('list-disc pl-5 mt-2 space-y-1 marker:text-fuchsia-400', bodyText)}>
                <li><strong className="text-fuchsia-950 font-bold">소셜 로그인:</strong> Google, Kakao, GitHub 등 로그인 제공업체에 인증을 위해 필요한 정보가 전달됩니다.</li>
                <li><strong className="text-fuchsia-950 font-bold">서비스 인프라:</strong> Supabase 등 클라우드 서비스 제공업체를 통해 데이터가 저장·처리됩니다.</li>
                <li><strong className="text-fuchsia-950 font-bold">법령:</strong> 법원, 수사기관 등이 법적 절차에 따라 요청하는 경우</li>
              </ul>
            </section>

            <section>
              <h2 className={headingClass}>5. 이용자 권리</h2>
              <p className={bodyText}>
                이용자는 언제든지 자신의 개인정보를 조회·수정·삭제할 수 있으며, 회원 탈퇴를 통해 수집된 정보의 삭제를 요청할 수 있습니다.
              </p>
            </section>

            <section>
              <h2 className={headingClass}>6. 문의</h2>
              <p className={bodyText}>
                개인정보 처리에 관한 문의는{' '}
                <a
                  href="https://mail.google.com/mail/?view=cm&fs=1&to=udtxg1311@gmail.com&su=VICS%20%EA%B0%9C%EC%9D%B8%EC%A0%95%EB%B3%B4%20%EB%AC%B8%EC%9D%98"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-fuchsia-700 hover:text-fuchsia-900 underline decoration-fuchsia-300/80 underline-offset-2"
                >
                  udtxg1311@gmail.com
                </a>
                으로 연락해 주세요.
              </p>
            </section>
          </div>
        </div>

        <div
          className={cn(
            SECTION_CARD,
            'mt-8 p-5 flex flex-wrap items-center justify-center gap-3 border-pink-100/70'
          )}
        >
          <Link
            to="/terms"
            className="text-sm font-black text-fuchsia-700 hover:text-fuchsia-900 underline decoration-fuchsia-300/70 underline-offset-2"
          >
            이용약관 보기 →
          </Link>
          <Link
            to="/community-policy"
            className="text-sm font-black text-fuchsia-700 hover:text-fuchsia-900 underline decoration-fuchsia-300/70 underline-offset-2"
          >
            커뮤니티 가이드라인 →
          </Link>
        </div>
      </div>
    </div>
  )
}
