import { Link } from 'react-router-dom'
import { Logo } from '../ui/Logo'

const SITEMAP = {
  SERVICE: [
    { label: '매치업 피드', to: '/matchups' },
    { label: '실시간 투표', to: '/' },
    { label: '이벤트/챌린지', to: '/landing' },
  ],
  COMMUNITY: [
    { label: '유저 랭킹', to: '/ranking' },
    { label: '명예의 전당', to: '/ranking' },
    { label: '커뮤니티 가이드', to: '/landing' },
  ],
  SUPPORT: [
    { label: '공지사항', to: '/landing' },
    { label: '자주 묻는 질문(FAQ)', to: '/landing' },
    { label: '1:1 문의하기', to: '/landing' },
  ],
}

const SOCIAL = [
  { label: 'Instagram', icon: '📸', href: 'https://instagram.com' },
  { label: 'Youtube', icon: '📺', href: 'https://youtube.com' },
  { label: 'Discord', icon: '💬', href: 'https://discord.com' },
]

export function Footer() {
  return (
    <footer className="bg-[#1A1A1A] text-[#999999]">
      <div className="max-w-screen-lg mx-auto px-4 py-8 sm:py-10">
        {/* ① 브랜드 슬로건 (가로형) */}
        <div className="flex flex-row items-center gap-3 sm:gap-4 mb-6 pb-4 border-b border-white/10">
          <Link to="/" className="flex items-center gap-2 shrink-0 group">
            <Logo size={40} dark link={false} />
            <span className="font-black text-xl text-white tracking-tight">VictorySpace</span>
          </Link>
          <span className="text-[#999999]">|</span>
          <p className="text-[#999999] text-sm sm:text-base">
            당신의 선택이 승리를 만듭니다.
          </p>
        </div>

        {/* ② 4열 사이트맵 (가로형) */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-white text-xs font-black uppercase tracking-widest shrink-0">SERVICE</span>
            <span className="text-[#999999]/50">|</span>
            {SITEMAP.SERVICE.map((item, i) => (
              <span key={item.label} className="inline-flex items-center gap-x-3">
                <Link to={item.to} className="text-sm hover:text-white transition-colors break-words">
                  {item.label}
                </Link>
                {i < SITEMAP.SERVICE.length - 1 && <span className="text-[#999999]/50">|</span>}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-white text-xs font-black uppercase tracking-widest shrink-0">COMMUNITY</span>
            <span className="text-[#999999]/50">|</span>
            {SITEMAP.COMMUNITY.map((item, i) => (
              <span key={item.label} className="inline-flex items-center gap-x-3">
                <Link to={item.to} className="text-sm hover:text-white transition-colors break-words">
                  {item.label}
                </Link>
                {i < SITEMAP.COMMUNITY.length - 1 && <span className="text-[#999999]/50">|</span>}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-white text-xs font-black uppercase tracking-widest shrink-0">SUPPORT</span>
            <span className="text-[#999999]/50">|</span>
            {SITEMAP.SUPPORT.map((item, i) => (
              <span key={item.label} className="inline-flex items-center gap-x-3">
                <Link to={item.to} className="text-sm hover:text-white transition-colors break-words">
                  {item.label}
                </Link>
                {i < SITEMAP.SUPPORT.length - 1 && <span className="text-[#999999]/50">|</span>}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-white text-xs font-black uppercase tracking-widest shrink-0">FOLLOW US</span>
            <span className="text-[#999999]/50">|</span>
            {SOCIAL.map((item, i) => (
              <span key={item.label} className="inline-flex items-center gap-x-3">
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:text-white transition-colors"
                >
                  {item.icon} {item.label}
                </a>
                {i < SOCIAL.length - 1 && <span className="text-[#999999]/50">|</span>}
              </span>
            ))}
          </div>
        </div>

        {/* ③ 법적 고지 및 정책 */}
        <div className="space-y-2 text-xs break-words">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/privacy" className="font-bold text-white hover:text-white/80 break-words">
              개인정보처리방침
            </Link>
            <Link to="/terms" className="hover:text-white transition-colors break-words">이용약관</Link>
            <Link to="/community-policy" className="hover:text-white transition-colors break-words">커뮤니티운영정책</Link>
            <a href="mailto:contact@victoryspace.com" className="hover:text-white transition-colors break-words">광고/제휴문의</a>
          </div>
          <p className="text-[#999999]/80 leading-relaxed break-words">
            (주)빅토리스페이스 | 대표: 임성빈 | 사업자등록번호: 000-00-00000 | 서울특별시 강남구 테헤란로 123
          </p>
          <p className="text-[#999999]/60">
            Copyright © 2026 VictorySpace Inc. All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
