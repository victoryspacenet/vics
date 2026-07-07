import { useEffect, useRef, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useUIStore } from './store/uiStore'
import { useNotificationStore } from './store/notificationStore'
import { Layout } from './components/layout/Layout'
import { Modal } from './components/ui/Modal'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import * as LazyCore from './routes/lazyCorePages'
import { ModerationRestrictionGate } from './components/layout/ModerationRestrictionGate'
import { ServerMaintenanceGate } from './components/system/ServerMaintenanceGate'
import { PushNotificationNavBridge } from './components/system/PushNotificationNavBridge'
import { GoogleAnalyticsBridge } from './components/system/GoogleAnalyticsBridge'
import { HubSpotBridge } from './components/system/HubSpotBridge'
import { ProfileLastVisitBridge } from './components/system/ProfileLastVisitBridge'
import { AdminLayout } from './components/layout/AdminLayout'
import * as LazyAdmin from './routes/lazyAdminPages'
import * as LazyExtra from './routes/lazyDevAndHeavyPages'
import * as LazyNIR from './routes/lazyNoticeInquiryRanking'
import * as LazyRMM from './routes/lazyRewardsMatchupMypage'
import * as LazySP from './routes/lazySecondaryPublicPages'
import * as LazyDrawers from './routes/lazyMatchupDrawers'
import { consumeStoredLoginReturn, getSafeReturnPath } from './lib/loginReturn'
import { RoutePageSkeleton } from './components/ui/RoutePageSkeleton'
import { prefetchCommonRoutes, prefetchRoute } from './lib/routePrefetch'
import { runWhenIdle } from './lib/runDeferred'

function RouteLoadingFallback() {
  return <RoutePageSkeleton />
}

function RouteSuspense({ Page: P }) {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <P />
    </Suspense>
  )
}

/** 전역 매치업 Drawer — 열릴 때만 lazy 청크 로드 */
function GlobalMatchupDrawers({ onCreated }) {
  const isCreateDrawerOpen = useUIStore((s) => s.isCreateDrawerOpen)
  const challengeMatchup = useUIStore((s) => s.challengeMatchup)

  if (!isCreateDrawerOpen && !challengeMatchup) return null

  return (
    <Suspense fallback={null}>
      {isCreateDrawerOpen ? <LazyDrawers.CreateMatchupDrawer onCreated={onCreated} /> : null}
      {challengeMatchup ? <LazyDrawers.ChallengeDrawer /> : null}
    </Suspense>
  )
}

/** OAuth 콜백 후 직전 페이지로 복귀 (sessionStorage) */
function PostOAuthRedirect() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const location = useLocation()
  const done = useRef(false)

  useEffect(() => {
    if (!user?.id) {
      done.current = false
      return
    }
    if (done.current) return
    if (location.pathname !== '/') return
    const stored = consumeStoredLoginReturn()
    if (!stored) return
    const target = getSafeReturnPath(stored, '')
    if (!target) return
    const here = `${location.pathname}${location.search}`
    if (target === here) return
    done.current = true
    navigate(target, { replace: true })
  }, [user?.id, location.pathname, location.search, navigate])

  return null
}

function App() {
  const { initialize, user } = useAuthStore()
  const { isLoginModalOpen, closeLoginModal, showToast, loginModalContext } = useUIStore()
  const { fetchNotifications, subscribeRealtime, reset: resetNotifications } = useNotificationStore()
  const noticePushRefresh = useUIStore((s) => s.noticePushRefresh)
  const homeRefreshRef = useRef(null)

  useEffect(() => {
    initialize()
    prefetchRoute(window.location.pathname)
    runWhenIdle(() => {
      prefetchCommonRoutes()
      LazyDrawers.prefetchMatchupDrawers()
    }, { timeoutMs: 2000 })

    // OAuth 콜백 · 이메일 인증 링크 클릭 후 URL 해시에 에러가 있는 경우 감지
    const hash = window.location.hash
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.replace('#', ''))
      const errorCode = params.get('error_code') || ''
      const errorDesc = params.get('error_description') || params.get('error') || '로그인 실패'
      const humanError = errorDesc.replace(/\+/g, ' ')
      console.error('[Auth callback] 에러:', errorCode, humanError)
      // otp_expired: 가입 확인·매직링크·비밀번호 재설정 메일의 인증 링크가 만료됐거나 이미 쓴 경우
      // (소셜 로그인 실패와는 다른 케이스라 별도 안내 + 재전송 동선 제공)
      if (errorCode === 'otp_expired') {
        showToast(
          '메일 속 인증 링크가 만료됐거나 이미 사용됐어요. 로그인 화면에서 인증 메일을 다시 받아 주세요.',
          'error',
        )
      } else {
        showToast(`소셜 로그인 실패: ${humanError}`, 'error')
      }
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  // 로그인 상태 변경 시 알림 구독 (초기 fetch는 지연 — auth·피드와 Supabase 락 경합 완화)
  useEffect(() => {
    if (!user?.id) {
      resetNotifications()
      return undefined
    }
    subscribeRealtime(user.id)
    const tid = window.setTimeout(() => {
      void fetchNotifications(user.id)
    }, 1800)
    return () => {
      window.clearTimeout(tid)
      resetNotifications()
    }
  }, [user?.id, fetchNotifications, subscribeRealtime, resetNotifications])

  useEffect(() => {
    if (!user?.id) return
    if (noticePushRefresh <= 0) return
    void fetchNotifications(user.id, { force: true })
  }, [noticePushRefresh, user?.id, fetchNotifications])

  useEffect(() => {
    const onNotif = () => {
      const uid = useAuthStore.getState().user?.id
      if (uid) void useNotificationStore.getState().fetchNotifications(uid, { force: true })
    }
    window.addEventListener('vics:notifications:updated', onNotif)
    return () => window.removeEventListener('vics:notifications:updated', onNotif)
  }, [])

  useEffect(() => {
    const onTierMilestone = (e) => {
      const tg = Number(e.detail?.total_granted)
      if (tg > 0) {
        showToast(`매치업 등급 달성 보너스 ${tg.toLocaleString('ko-KR')}P가 지급됐어요!`, 'success')
      }
    }
    window.addEventListener('vics:matchup-tier-milestone-bonus', onTierMilestone)
    return () => window.removeEventListener('vics:matchup-tier-milestone-bonus', onTierMilestone)
  }, [showToast])

  // 절전/복귀 후 알림·홈 갱신 (Realtime 미사용 — 폴링은 subscribeRealtime 내부)
  useEffect(() => {
    let reconnectTimer = null
    const reconnect = () => {
      if (!user?.id) return
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null
        void fetchNotifications(user.id)
        homeRefreshRef.current?.()
      }, 800)
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') reconnect()
    }

    const onOnline = () => reconnect()

    const onPageShow = (e) => {
      if (e.persisted) reconnect()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [user?.id, fetchNotifications])

  return (
    <BrowserRouter>
      <GoogleAnalyticsBridge />
      <HubSpotBridge />
      <ProfileLastVisitBridge />
      <PushNotificationNavBridge />
      <PostOAuthRedirect />
      <ModerationRestrictionGate />
      <ServerMaintenanceGate>
      <Layout>
        <Routes>
          <Route path="/"              element={<RouteSuspense Page={LazyCore.MainPage} />} />
          <Route path="/explore"       element={<Navigate to="/feed/best" replace />} />
          <Route path="/feed/:variant" element={<RouteSuspense Page={LazyCore.MainFeedPage} />} />
          <Route path="/matchups" element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <LazySP.HomePage refreshRef={homeRefreshRef} />
            </Suspense>
          } />
          <Route path="/landing" element={<RouteSuspense Page={LazySP.LandingPage} />} />
          <Route path="/events" element={<RouteSuspense Page={LazySP.EventsComingSoonPage} />} />
          <Route path="/matchup/:id" element={<RouteSuspense Page={LazyRMM.MatchupDetailPage} />} />
          <Route path="/matchup/share/:id" element={<RouteSuspense Page={LazyRMM.MatchupDetailPage} />} />
          <Route path="/ranking" element={<RouteSuspense Page={LazySP.RankingPage} />} />
          <Route path="/ranking/share" element={<RouteSuspense Page={LazySP.RankingPage} />} />
          <Route path="/search" element={<RouteSuspense Page={LazySP.SearchPage} />} />
          <Route path="/rewards" element={<RouteSuspense Page={LazyRMM.PointRewardsPage} />} />
          <Route path="/rewards/main-spotlight" element={<RouteSuspense Page={LazyRMM.MainSpotlight1hPage} />} />
          <Route path="/rewards/banner-highlight" element={<RouteSuspense Page={LazyRMM.BannerHighlightBoostPage} />} />
          <Route path="/rewards/vote-stats" element={<RouteSuspense Page={LazyRMM.VoteStatsUnlockPage} />} />
          <Route path="/rewards/v-card/cheer" element={<RouteSuspense Page={LazyRMM.VictoryReportCheerPage} />} />
          <Route path="/rewards/v-card" element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <LazyExtra.VictoryReportPage />
            </Suspense>
          } />
          <Route path="/fandom" element={<RouteSuspense Page={LazySP.FandomDashboardPage} />} />
          <Route path="/dev/fandom-milestone" element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <LazyExtra.DevFandomMilestonePreviewPage />
            </Suspense>
          } />
          <Route path="/dev/tendency-report" element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <LazyExtra.DevTendencyReportPreviewPage />
            </Suspense>
          } />
          <Route path="/dev/fandom-bronze-badge" element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <LazyExtra.DevFandomBronzeBadgePreviewPage />
            </Suspense>
          } />
          <Route path="/dev/diamond-legend" element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <LazyExtra.DevDiamondLegendPreviewPage />
            </Suspense>
          } />
          <Route path="/dev/legend-feed-banner" element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <LazyExtra.DevLegendFeedBannerPage />
            </Suspense>
          } />
          <Route path="/rewards/profile-public" element={<RouteSuspense Page={LazyRMM.ProfilePublicRewardPage} />} />
          <Route path="/rewards/neon-profile-theme" element={<RouteSuspense Page={LazyRMM.NeonProfileThemePage} />} />
          <Route path="/hall-of-fame" element={<RouteSuspense Page={LazySP.EventsComingSoonPage} />} />
          <Route path="/profile/:userId" element={<RouteSuspense Page={LazyRMM.PublicProfilePage} />} />
          <Route path="/mypage" element={<RouteSuspense Page={LazyRMM.MyPage} />} />
          <Route path="/report/tendency/s/:shareId" element={<RouteSuspense Page={LazyRMM.TendencyReportPage} />} />
          <Route path="/report/tendency" element={<RouteSuspense Page={LazyRMM.TendencyReportPage} />} />
          <Route path="/signup" element={<RouteSuspense Page={LazySP.SignupPage} />} />
          <Route path="/welcome" element={<RouteSuspense Page={LazySP.WelcomePage} />} />
          <Route path="/login" element={<RouteSuspense Page={LazyCore.LoginPage} />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/mypage/edit" element={<RouteSuspense Page={LazyRMM.ProfileEditPage} />} />
          <Route path="/mypage/edit/image" element={<RouteSuspense Page={LazyRMM.ProfileImageEditPage} />} />
          <Route path="/mypage/delete" element={<RouteSuspense Page={LazyRMM.DeleteAccountPage} />} />
          <Route path="/goodbye" element={<RouteSuspense Page={LazyRMM.DeletedPage} />} />
          <Route path="/mypage/ranking-gallery" element={<RouteSuspense Page={LazyNIR.RankingGalleryPage} />} />
          <Route path="/privacy" element={<RouteSuspense Page={LazySP.PrivacyPage} />} />
          <Route path="/terms" element={<RouteSuspense Page={LazySP.TermsPage} />} />
          <Route path="/community-policy" element={<RouteSuspense Page={LazySP.CommunityPolicyPage} />} />
          <Route path="/restricted" element={<RouteSuspense Page={LazySP.AccessRestrictedPage} />} />
          <Route path="/notice" element={<RouteSuspense Page={LazyNIR.NoticePage} />} />
          <Route path="/notice/deletion/:id?" element={<RouteSuspense Page={LazyNIR.ContentDeletionNoticePage} />} />
          <Route path="/notice/:id" element={<RouteSuspense Page={LazyNIR.NoticeDetailPage} />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<LazyAdmin.AdminDashboardPage />} />
            <Route path="settings" element={<LazyAdmin.AdminSettingsPage />} />
            <Route path="settings/permissions" element={<LazyAdmin.AdminPermissionGroupPage />} />
            <Route path="settings/2fa" element={<LazyAdmin.AdminTwoFactorPage />} />
            <Route path="settings/server-maintenance" element={<LazyAdmin.AdminServerMaintenancePage />} />
            <Route path="settings/autobot" element={<LazyAdmin.AdminAutoBotPage />} />
            <Route path="settings/banned-words" element={<LazyAdmin.AdminBannedWordsPage />} />
            <Route path="settings/messenger" element={<LazyAdmin.AdminMessengerPage />} />
            <Route path="settings/system-push" element={<LazyAdmin.AdminSystemPushPage />} />
            <Route path="settings/api-keys" element={<LazyAdmin.AdminApiKeysPage />} />
            <Route path="settings/operators/security-log" element={<LazyAdmin.AdminOperatorSecurityLogPage />} />
            <Route path="settings/operators/new" element={<LazyAdmin.AdminOperatorNewPage />} />
            <Route path="settings/operators/:id/delete" element={<LazyAdmin.AdminOperatorDeletePage />} />
            <Route path="settings/operators/:id" element={<LazyAdmin.AdminOperatorEditPage />} />
            <Route path="settings/operators" element={<LazyAdmin.AdminOperatorAccountPage />} />
            <Route path="matchups/:id" element={<LazyAdmin.AdminMatchupDetailPage />} />
            <Route path="matchups" element={<LazyAdmin.AdminMatchupsPage />} />
            <Route path="users/:id" element={<LazyAdmin.AdminUserDetailPage />} />
            <Route path="users" element={<LazyAdmin.AdminUsersPage />} />
            <Route path="categories" element={<LazyAdmin.AdminCategoriesPage />} />
            <Route path="inquiry/hot-faq" element={<LazyAdmin.InquiryHotFaqAdminPage />} />
            <Route path="inquiry/category-faq" element={<LazyAdmin.InquiryCategoryFaqAdminPage />} />
            <Route path="inquiry" element={<LazyAdmin.InquiryAdminListPage />} />
            <Route path="inquiry/complete" element={<LazyAdmin.InquiryAdminCompletePage />} />
            <Route path="inquiry/:id" element={<LazyAdmin.InquiryAdminDetailPage />} />
            <Route path="appeals" element={<LazyAdmin.AdminAppealListPage />} />
            <Route path="appeals/:id" element={<LazyAdmin.AdminAppealDetailPage />} />
            <Route path="notice/list" element={<LazyAdmin.NoticeAdminListPage />} />
            <Route path="notice/new" element={<LazyAdmin.NoticeAdminPage />} />
            <Route path="notice/edit/:id" element={<LazyAdmin.NoticeEditPage />} />
            <Route path="notice/popup" element={<LazyAdmin.PopupNoticeAdminPage />} />
            <Route path="notice/popup/list" element={<LazyAdmin.PopupNoticeListPage />} />
            <Route path="notice/popup/complete" element={<LazyAdmin.PopupNoticeCompletePage />} />
            <Route path="notice/popup/:id/stats" element={<LazyAdmin.PopupNoticeStatsPage />} />
            <Route path="notice/popup/:id" element={<LazyAdmin.PopupNoticeDetailPage />} />
            <Route path="notice/complete" element={<LazyAdmin.NoticePublishCompletePage />} />
          </Route>
          <Route path="/inquiry" element={<RouteSuspense Page={LazyNIR.InquiryMainPage} />} />
          <Route path="/inquiry/search" element={<RouteSuspense Page={LazyNIR.InquirySearchPage} />} />
          <Route path="/inquiry/category/:slug/help/:helpId" element={<RouteSuspense Page={LazyNIR.InquiryCategoryHelpDetailPage} />} />
          <Route path="/inquiry/category/:slug" element={<RouteSuspense Page={LazyNIR.InquiryCategoryPage} />} />
          <Route path="/inquiry/form" element={<RouteSuspense Page={LazyNIR.InquiryFormPage} />} />
          <Route path="/inquiry/appeal/complete" element={<RouteSuspense Page={LazyNIR.AppealCompletePage} />} />
          <Route path="/inquiry/appeal/result/:receiptId" element={<RouteSuspense Page={LazyNIR.AppealResultPage} />} />
          <Route path="/inquiry/appeal/result" element={<RouteSuspense Page={LazyNIR.AppealResultPage} />} />
          <Route path="/appeal-result/:receiptId" element={<RouteSuspense Page={LazyNIR.AppealResultPage} />} />
          <Route path="/inquiry/appeal/:receiptId" element={<RouteSuspense Page={LazyNIR.AppealDetailPage} />} />
          <Route path="/inquiry/appeal" element={<RouteSuspense Page={LazyNIR.AppealFormPage} />} />
          <Route path="/inquiry/faq/:id" element={<RouteSuspense Page={LazyNIR.InquiryFaqDetailPage} />} />
          <Route path="/inquiry/complete" element={<RouteSuspense Page={LazyNIR.InquiryCompletePage} />} />
          <Route path="/inquiry/history" element={<RouteSuspense Page={LazyNIR.InquiryHistoryPage} />} />
          <Route path="/inquiry/history/:receiptId" element={<RouteSuspense Page={LazyNIR.InquiryHistoryDetailPage} />} />
        </Routes>
      </Layout>

      <GlobalMatchupDrawers onCreated={() => homeRefreshRef.current?.()} />

      {/* 전역 로그인 모달 — 열릴 때만 청크 로드 */}
      {isLoginModalOpen ? (
        <Modal
          isOpen
          onClose={closeLoginModal}
          title={false}
          className="max-w-[min(22rem,calc(100vw-2rem))] overflow-visible border border-white/70 bg-transparent shadow-2xl shadow-fuchsia-500/20"
          bodyClassName="p-0 overflow-y-auto overflow-x-hidden"
        >
          <Suspense fallback={null}>
            <LazyCore.LoginModal onClose={closeLoginModal} />
          </Suspense>
        </Modal>
      ) : null}
      </ServerMaintenanceGate>
    </BrowserRouter>
  )
}

export default App
