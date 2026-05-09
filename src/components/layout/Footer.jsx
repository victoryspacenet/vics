import { Link } from 'react-router-dom'
import { Logo } from '../ui/Logo'
import { useAuthStore } from '../../store/authStore'
import { canAccessAdmin } from '../../lib/adminAuth'

const SITEMAP = {
  SERVICE: [
    { label: '매치업 피드', to: '/matchups' },
    { label: '실시간 투표', to: '/' },
    { label: '이벤트/챌린지', to: '/events' },
  ],
  COMMUNITY: [
    { label: '유저 랭킹', to: '/ranking' },
    { label: '명예의 전당', to: '/hall-of-fame' },
    { label: '커뮤니티 가이드', to: '/community-policy' },
  ],
  SUPPORT: [
    { label: '공지사항', to: '/notice' },
    { label: '자주 묻는 질문(FAQ) & 1:1 문의하기', to: '/inquiry' },
  ],
}

const SOCIAL = [
  { label: 'Instagram', icon: '📸', href: 'https://instagram.com' },
  { label: 'Youtube', icon: '📺', href: 'https://youtube.com' },
  { label: '틱톡', icon: '🎵', href: 'https://www.tiktok.com' },
]

export function Footer() {
  const { user } = useAuthStore()
  const supportLinks = [
    ...SITEMAP.SUPPORT,
    ...(canAccessAdmin(user) ? [{ label: '관리자', to: '/admin/dashboard' }] : []),
  ]

  return (
    <footer className="bg-gradient-to-b from-[#1e1e1e] via-[#1A1A1A] to-[#111111] text-[#999999] max-lg:pb-[calc(4.25rem+env(safe-area-inset-bottom,0px)+0.75rem)]">
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

        {/* ② 사이트맵 + INFORMATION (행 간격 동일: gap-3) */}
        <div className="flex flex-col gap-3">
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
            {supportLinks.map((item, i) => (
              <span key={item.label} className="inline-flex items-center gap-x-3">
                <Link to={item.to} className="text-sm hover:text-white transition-colors break-words">
                  {item.label}
                </Link>
                {i < supportLinks.length - 1 && <span className="text-[#999999]/50">|</span>}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-white text-xs font-black uppercase tracking-widest shrink-0">WITH US</span>
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-white text-xs font-black uppercase tracking-widest shrink-0">INFORMATION</span>
            <span className="text-[#999999]/50">|</span>
            <Link to="/privacy" className="text-sm hover:text-white transition-colors break-words">
              개인정보처리방침
            </Link>
            <span className="text-[#999999]/50">|</span>
            <Link to="/terms" className="text-sm hover:text-white transition-colors break-words">
              이용약관
            </Link>
            <span className="text-[#999999]/50">|</span>
            <Link
              to="/events?from=partner"
              className="text-sm hover:text-white transition-colors break-words"
            >
              광고/제휴문의
            </Link>
          </div>
        </div>

        {/* ③ 사업자·저작권 */}
        <div className="mt-3 space-y-2 text-xs break-words">
          <p className="text-[#999999]/60">
            Copyright © 2026 VictorySpace Inc. All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
