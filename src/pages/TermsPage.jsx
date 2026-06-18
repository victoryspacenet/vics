import { Link } from 'react-router-dom'
import { ChevronLeft, FileText } from 'lucide-react'
import { Logo } from '../components/ui/Logo'
import { cn } from '../lib/utils'

const PAGE_BG = 'bg-gradient-to-br from-rose-50/98 via-fuchsia-50/35 to-cyan-50/50'
const HEADER_GLASS =
  'bg-gradient-to-b from-white/90 via-rose-50/40 to-fuchsia-50/20 backdrop-blur-md border-b border-pink-100/55'

const SECTIONS = [
  {
    num: 1,
    title: '제1조 (목적)',
    body: '본 약관은 VictorySpace(이하 "회사")가 제공하는 경쟁·투표 서비스(이하 "서비스")의 이용 조건 및 절차, 회사와 이용자 간의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.',
  },
  {
    num: 2,
    title: '제2조 (서비스의 내용)',
    body: '회사는 사용자가 다양한 주제에 대해 경쟁을 생성하고, 다른 사용자들이 투표에 참여할 수 있는 플랫폼을 제공합니다. 서비스 내 랭킹, 포인트, 배지 등은 서비스 운영 목적으로 제공됩니다.',
  },
  {
    num: 3,
    title: '제3조 (콘텐츠 저작권 및 책임)',
    body: '사용자가 업로드한 게시물(이미지, 영상, 텍스트 등)에 대한 저작권은 사용자 본인에게 있습니다. 다만, 회사는 서비스 홍보 및 운영 목적으로 해당 게시물을 활용할 수 있습니다. 타인의 저작권 및 초상권을 침해하여 발생하는 모든 법적 책임은 업로드한 사용자 본인에게 있습니다.',
  },
  {
    num: 4,
    title: '제4조 (부정행위 및 서비스 이용 제한)',
    body: '매크로, 대리 투표, 주제 이탈 게시물 반복 업로드 등 플랫폼의 정상적인 운영을 방해하는 행위 적발 시, 회사는 사전 통보 없이 해당 계정을 정지하거나 랭킹 보상을 회수할 수 있습니다.',
  },
  {
    num: 5,
    title: '제5조 (경쟁 결과에 대한 면책)',
    body: '본 서비스의 투표 결과는 사용자의 주관적인 평가에 기반하며, 회사는 경쟁의 결과가 특정 개인이나 제품의 객관적인 가치를 증명한다고 보장하지 않습니다.',
  },
  {
    num: 6,
    title: '제6조 (약관의 변경)',
    body: '회사는 필요한 경우 관련 법령을 위반하지 않는 범위에서 본 약관을 변경할 수 있으며, 변경 시 서비스 내 공지 또는 이메일 등으로 안내합니다.',
  },
]

export function TermsPage() {
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
              <FileText size={13} className="text-white" />
            </span>
            <h1 className="text-base font-black bg-gradient-to-r from-fuchsia-700 via-pink-600 to-rose-600 bg-clip-text text-transparent tracking-tight">이용약관</h1>
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
                <p className="text-xl font-black text-fuchsia-950 tracking-tight">이용약관</p>
                <p className="text-xs text-fuchsia-600/60 mt-0.5">시행일: 2026년 6월 5일</p>
              </div>
            </div>
          </div>

          {/* 본문 섹션들 */}
          <div className="rounded-2xl overflow-hidden border border-pink-100/70 bg-white/92 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px]">
            <div className="h-1 bg-gradient-to-r from-fuchsia-500 via-pink-500 to-rose-400" />
            <div className="divide-y divide-pink-50/80">
              {SECTIONS.map((s) => (
                <div key={s.num} className="group px-6 py-5 hover:bg-fuchsia-50/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white text-xs font-black shadow-md shadow-fuchsia-300/35 mt-0.5">
                      {s.num}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-sm font-black bg-gradient-to-r from-fuchsia-800 to-pink-700 bg-clip-text text-transparent mb-2">
                        {s.title}
                      </h2>
                      <p className="text-sm text-fuchsia-900/80 leading-relaxed">
                        {s.body}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 푸터 링크 */}
          <div className="rounded-2xl overflow-hidden border border-pink-100/60 bg-white/80 shadow-sm">
            <div className="h-0.5 bg-gradient-to-r from-fuchsia-400 via-pink-400 to-rose-400" />
            <div className="px-5 py-4 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/privacy"
                className="inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-fuchsia-200/60 bg-white/80 text-sm font-black text-fuchsia-700 hover:bg-fuchsia-50 hover:border-fuchsia-300/70 transition-all shadow-sm"
              >
                개인정보처리방침 →
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
