/**
 * 자주 쓰는 lazy 라우트 청크를 미리 받아 두어 탭·하단 메뉴 전환이 빨라지게 합니다.
 * 각 `lazy()` 정의와 동일한 `import('../pages/...')` 경로를 사용합니다.
 */

const inflight = new Set()

/** @type {Record<string, () => Promise<unknown>>} */
const PREFETCH_BY_PATH = {
  '/': () => import('../pages/MainPage'),
  '/matchups': () => import('../pages/HomePage'),
  '/ranking': () => import('../pages/RankingPage'),
  '/search': () => import('../pages/SearchPage'),
  '/fandom': () => import('../pages/FandomDashboardPage'),
  '/landing': () => import('../pages/LandingPage'),
  '/mypage': () => import('../pages/MyPage'),
  '/rewards': () => import('../pages/PointRewardsPage'),
  '/notice': () => import('../pages/NoticePage'),
  '/inquiry': () => import('../pages/InquiryMainPage'),
}

/** pathname → 프리페치 (동적 세그먼트는 접두사 매칭) */
const PREFIX_ROUTES = [
  ['/feed/', () => import('../pages/MainFeedPage')],
  ['/rewards/', () => import('../routes/lazyRewardsMatchupMypage')],
  ['/matchup/', () => import('../pages/MatchupDetailPage')],
  ['/profile/', () => import('../pages/PublicProfilePage')],
  ['/notice/', () => import('../pages/NoticeDetailPage')],
  ['/inquiry/', () => import('../routes/lazyNoticeInquiryRanking')],
]

function resolvePrefetchLoader(pathname) {
  const path = String(pathname || '').split('?')[0] || '/'
  if (PREFETCH_BY_PATH[path]) return PREFETCH_BY_PATH[path]
  for (const [prefix, loader] of PREFIX_ROUTES) {
    if (path.startsWith(prefix)) return loader
  }
  return null
}

/**
 * @param {string} pathname
 */
export function prefetchRoute(pathname) {
  const loader = resolvePrefetchLoader(pathname)
  if (!loader) return
  const key = pathname
  if (inflight.has(key)) return
  inflight.add(key)
  void loader()
    .catch(() => {})
    .finally(() => inflight.delete(key))
}

/** 하단 메뉴·탭 등에서 한 번에 워밍 */
export function prefetchCommonRoutes() {
  ;['/mypage', '/ranking', '/matchups', '/rewards', '/notice'].forEach((p) => prefetchRoute(p))
}
