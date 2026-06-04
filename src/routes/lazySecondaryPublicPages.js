import { lazy } from 'react'

/** 랭킹·검색·팬덤 */
export const RankingPage = lazy(() => import('../pages/RankingPage').then((m) => ({ default: m.RankingPage })))
export const SearchPage = lazy(() => import('../pages/SearchPage').then((m) => ({ default: m.SearchPage })))
export const FandomDashboardPage = lazy(() =>
  import('../pages/FandomDashboardPage').then((m) => ({ default: m.FandomDashboardPage })),
)

/** 랜딩·플레이스홀더 */
export const LandingPage = lazy(() =>
  import('../pages/LandingPage').then((m) => ({ default: m.LandingPage })),
)
export const EventsComingSoonPage = lazy(() =>
  import('../pages/EventsComingSoonPage').then((m) => ({ default: m.EventsComingSoonPage })),
)

/** 매치업 목록 홈 */
export const HomePage = lazy(() => import('../pages/HomePage').then((m) => ({ default: m.HomePage })))

/** 정책·약관·접근 제한 */
export const TermsPage = lazy(() => import('../pages/TermsPage').then((m) => ({ default: m.TermsPage })))
export const PrivacyPage = lazy(() => import('../pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage })))
export const CommunityPolicyPage = lazy(() =>
  import('../pages/CommunityPolicyPage').then((m) => ({ default: m.CommunityPolicyPage })),
)
export const AccessRestrictedPage = lazy(() =>
  import('../pages/AccessRestrictedPage').then((m) => ({ default: m.AccessRestrictedPage })),
)

/** 가입·웰컴 (로그인은 LoginModal과 동일 모듈이라 App에서 정적 import 유지) */
export const SignupPage = lazy(() => import('../pages/SignupPage').then((m) => ({ default: m.SignupPage })))
export const WelcomePage = lazy(() =>
  import('../pages/WelcomePage').then((m) => ({ default: m.WelcomePage })),
)
