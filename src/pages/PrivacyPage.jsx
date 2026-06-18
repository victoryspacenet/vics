import { Link } from 'react-router-dom'
import { ChevronLeft, ShieldCheck } from 'lucide-react'
import { Logo } from '../components/ui/Logo'
import { cn } from '../lib/utils'

const PAGE_BG = 'bg-gradient-to-br from-rose-50/98 via-fuchsia-50/35 to-cyan-50/50'
const HEADER_GLASS =
  'bg-gradient-to-b from-white/90 via-rose-50/40 to-fuchsia-50/20 backdrop-blur-md border-b border-pink-100/55'

const numBadge =
  'flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white text-xs font-black shadow-md shadow-fuchsia-300/35 mt-0.5'
const sectionTitle =
  'text-sm font-black bg-gradient-to-r from-fuchsia-800 to-pink-700 bg-clip-text text-transparent mb-2'
const bodyText = 'text-sm text-fuchsia-900/80 leading-relaxed'
const listClass =
  'mt-2 space-y-1.5 pl-1'
const listItem =
  'flex gap-2 text-sm text-fuchsia-900/80 leading-relaxed'
const bullet =
  'mt-1.5 w-1.5 h-1.5 rounded-full bg-gradient-to-br from-fuchsia-400 to-pink-400 shrink-0'

export function PrivacyPage() {
  return (
    <div className={cn('min-h-screen relative overflow-hidden', PAGE_BG)}>
      {/* 앰비언트 배경 */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-gradient-radial from-fuchsia-300/20 to-transparent blur-3xl" />
        <div className="absolute top-1/3 -right-24 w-72 h-72 rounded-full bg-gradient-radial from-pink-300/15 to-transparent blur-3xl" />
        <div className="absolute bottom-24 left-1/4 w-64 h-64 rounded-full bg-gradient-radial from-rose-300/12 to-transparent blur-3xl" />
      </div>

      <div className="max-w-2xl mx-auto relative z-10">
        {/* 스티키 헤더 */}
        <div className={cn('sticky top-0 z-10 px-4 py-3 flex items-center gap-2.5', HEADER_GLASS)}>
          <Link
            to="/"
            className="flex items-center gap-1 pl-2 pr-3 py-2 -ml-1 rounded-xl bg-gradient-to-r from-fuchsia-50 to-pink-50 border border-pink-200/60 hover:from-fuchsia-100 hover:to-pink-100 transition-all shrink-0 shadow-sm"
          >
            <ChevronLeft size={16} className="text-fuchsia-700" />
            <span className="text-xs font-bold text-fuchsia-700">홈으로</span>
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-500 shadow-md shadow-fuchsia-300/40">
              <ShieldCheck size={13} className="text-white" />
            </span>
            <h1 className="text-base font-black bg-gradient-to-r from-fuchsia-700 via-pink-600 to-rose-600 bg-clip-text text-transparent tracking-tight">개인정보처리방침</h1>
          </div>
        </div>

        <div className="px-4 py-6 space-y-5">
          {/* 타이틀 카드 */}
          <div className="rounded-2xl overflow-hidden border border-fuchsia-200/50 bg-white/90 shadow-[0_4px_28px_-10px_rgba(192,38,211,0.18)] backdrop-blur-sm">
            <div className="h-1.5 bg-gradient-to-r from-fuchsia-500 via-pink-500 to-rose-400" />
            <div className="flex items-center gap-4 px-6 py-5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-fuchsia-100 to-pink-100 border border-pink-200/50 flex items-center justify-center shadow-sm shrink-0">
                <Logo size={26} dark={false} link={false} />
              </div>
              <div>
                <p className="text-[10px] font-black bg-gradient-to-r from-fuchsia-600 to-pink-600 bg-clip-text text-transparent uppercase tracking-widest mb-0.5">VictorySpace</p>
                <p className="text-xl font-black text-fuchsia-950 tracking-tight">개인정보처리방침</p>
                <p className="text-xs text-fuchsia-600/60 mt-0.5">시행일: 2026년 6월 5일</p>
              </div>
            </div>
          </div>

          {/* 본문 카드 */}
          <div className="rounded-2xl overflow-hidden border border-pink-100/70 bg-white/92 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px]">
            <div className="h-1 bg-gradient-to-r from-fuchsia-500 via-pink-500 to-rose-400" />
            <div className="divide-y divide-pink-50/80">

              {/* 1. 수집 목적 */}
              <div className="group px-6 py-5 hover:bg-fuchsia-50/30 transition-colors">
                <div className="flex items-start gap-3">
                  <span className={numBadge}>1</span>
                  <div className="flex-1 min-w-0">
                    <h2 className={sectionTitle}>수집 목적</h2>
                    <p className={bodyText}>회사는 다음의 목적으로 개인정보를 수집·이용합니다.</p>
                    <ul className={listClass}>
                      {['서비스 제공(회원가입, 로그인, 경쟁 생성·투표, 랭킹 등)', '서비스 개선 및 신규 서비스 개발', '고객 문의 응대 및 분쟁 해결', '법령에 따른 의무 이행'].map((t, i) => (
                        <li key={i} className={listItem}>
                          <span className={bullet} />
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* 2. 수집 항목 */}
              <div className="group px-6 py-5 hover:bg-fuchsia-50/30 transition-colors">
                <div className="flex items-start gap-3">
                  <span className={numBadge}>2</span>
                  <div className="flex-1 min-w-0">
                    <h2 className={sectionTitle}>수집 항목</h2>
                    <p className={bodyText}>회사는 서비스 제공에 필요한 최소한의 정보만 수집합니다.</p>
                    <ul className={listClass}>
                      <li className={listItem}>
                        <span className={bullet} />
                        <span><strong className="text-fuchsia-900 font-bold">필수:</strong> 이메일, 닉네임, 성별, 나이, 프로필 이미지(선택 시)</span>
                      </li>
                      <li className={listItem}>
                        <span className={bullet} />
                        <span><strong className="text-fuchsia-900 font-bold">소셜 로그인 시:</strong> 해당 서비스에서 제공하는 식별자, 이메일, 프로필 사진 등</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 3. 보유 기간 */}
              <div className="group px-6 py-5 hover:bg-fuchsia-50/30 transition-colors">
                <div className="flex items-start gap-3">
                  <span className={numBadge}>3</span>
                  <div className="flex-1 min-w-0">
                    <h2 className={sectionTitle}>보유 기간</h2>
                    <p className={bodyText}>회사는 회원 탈퇴 시 개인정보를 즉시 삭제합니다. 단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.</p>
                    <ul className={listClass}>
                      {['계약 또는 청약철회 등에 관한 기록: 5년', '소비자 불만 또는 분쟁처리에 관한 기록: 3년', '웹사이트 방문 기록: 3개월'].map((t, i) => (
                        <li key={i} className={listItem}>
                          <span className={bullet} />
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* 4. 제3자 제공 */}
              <div className="group px-6 py-5 hover:bg-fuchsia-50/30 transition-colors">
                <div className="flex items-start gap-3">
                  <span className={numBadge}>4</span>
                  <div className="flex-1 min-w-0">
                    <h2 className={sectionTitle}>제3자 제공</h2>
                    <p className={bodyText}>회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만, 다음의 경우에는 예외로 합니다.</p>
                    <ul className={listClass}>
                      <li className={listItem}>
                        <span className={bullet} />
                        <span><strong className="text-fuchsia-900 font-bold">소셜 로그인:</strong> Google, Kakao, GitHub 등 로그인 제공업체에 인증을 위해 필요한 정보가 전달됩니다.</span>
                      </li>
                      <li className={listItem}>
                        <span className={bullet} />
                        <span><strong className="text-fuchsia-900 font-bold">서비스 인프라:</strong> Supabase 등 클라우드 서비스 제공업체를 통해 데이터가 저장·처리됩니다.</span>
                      </li>
                      <li className={listItem}>
                        <span className={bullet} />
                        <span><strong className="text-fuchsia-900 font-bold">법령:</strong> 법원, 수사기관 등이 법적 절차에 따라 요청하는 경우</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 5. 이용자 권리 */}
              <div className="group px-6 py-5 hover:bg-fuchsia-50/30 transition-colors">
                <div className="flex items-start gap-3">
                  <span className={numBadge}>5</span>
                  <div className="flex-1 min-w-0">
                    <h2 className={sectionTitle}>이용자 권리</h2>
                    <p className={bodyText}>
                      이용자는 언제든지 자신의 개인정보를 조회·수정·삭제할 수 있으며, 회원 탈퇴를 통해 수집된 정보의 삭제를 요청할 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* 6. 문의 */}
              <div className="group px-6 py-5 hover:bg-fuchsia-50/30 transition-colors">
                <div className="flex items-start gap-3">
                  <span className={numBadge}>6</span>
                  <div className="flex-1 min-w-0">
                    <h2 className={sectionTitle}>문의</h2>
                    <p className={bodyText}>
                      개인정보 처리에 관한 문의는{' '}
                      <a
                        href="https://mail.google.com/mail/?view=cm&fs=1&to=udtxg1311@gmail.com&su=VICS%20%EA%B0%9C%EC%9D%B8%EC%A0%95%EB%B3%B4%20%EB%AC%B8%EC%9D%98"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-black text-fuchsia-700 hover:text-fuchsia-900 underline decoration-fuchsia-300/80 underline-offset-2"
                      >
                        udtxg1311@gmail.com
                      </a>
                      으로 연락해 주세요.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* 푸터 링크 */}
          <div className="rounded-2xl overflow-hidden border border-pink-100/60 bg-white/80 shadow-sm">
            <div className="h-0.5 bg-gradient-to-r from-fuchsia-400 via-pink-400 to-rose-400" />
            <div className="px-5 py-4 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/terms"
                className="inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-fuchsia-200/60 bg-white/80 text-sm font-black text-fuchsia-700 hover:bg-fuchsia-50 hover:border-fuchsia-300/70 transition-all shadow-sm"
              >
                이용약관 →
              </Link>
              <Link
                to="/community-policy"
                className="inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-fuchsia-200/60 bg-white/80 text-sm font-black text-fuchsia-700 hover:bg-fuchsia-50 hover:border-fuchsia-300/70 transition-all shadow-sm"
              >
                커뮤니티 가이드라인 →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
