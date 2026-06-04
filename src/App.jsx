import { useEffect, useRef, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useUIStore } from './store/uiStore'
import { useNotificationStore } from './store/notificationStore'
import { Layout } from './components/layout/Layout'
import { Modal } from './components/ui/Modal'
import { CreateMatchupDrawer } from './components/matchup/CreateMatchupDrawer'
import { ChallengeDrawer } from './components/matchup/ChallengeDrawer'
import { LoginModal, LoginPage } from './pages/LoginPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { MainPage } from './pages/MainPage'
import { MainFeedPage } from './pages/MainFeedPage'
import { ModerationRestrictionGate } from './components/layout/ModerationRestrictionGate'
import { ServerMaintenanceGate } from './components/system/ServerMaintenanceGate'
import { PushNotificationNavBridge } from './components/system/PushNotificationNavBridge'
import { AdminLayout } from './components/layout/AdminLayout'
import * as LazyAdmin from './routes/lazyAdminPages'
import * as LazyExtra from './routes/lazyDevAndHeavyPages'
import * as LazyNIR from './routes/lazyNoticeInquiryRanking'
import * as LazyRMM from './routes/lazyRewardsMatchupMypage'
import * as LazySP from './routes/lazySecondaryPublicPages'
import { consumeStoredLoginReturn, getSafeReturnPath } from './lib/loginReturn'
import { RoutePageSkeleton } from './components/ui/RoutePageSkeleton'
import { prefetchCommonRoutes } from './lib/routePrefetch'
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
    runWhenIdle(() => prefetchCommonRoutes(), { timeoutMs: 2000 })

    // OAuth 콜백 후 URL 해시에 에러가 있는 경우 감지
    const hash = window.location.hash
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.replace('#', ''))
      const errorDesc = params.get('error_description') || params.get('error') || '로그인 실패'
      const humanError = errorDesc.replace(/\+/g, ' ')
      console.error('[OAuth callback] 에러:', humanError)
      showToast(`소셜 로그인 실패: ${humanError}`, 'error')
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  // 로그인 상태 변경 시 알림 구독 관리
  useEffect(() => {
    if (user?.id) {
      fetchNotifications(user.id)
      subscribeRealtime(user.id)
    } else {
      resetNotifications()
    }
    return () => {
      // 컴포넌트 언마운트 시 구독 해제 불필요 (앱 전체 생명주기)
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    if (noticePushRefresh <= 0) return
    void fetchNotifications(user.id)
  }, [noticePushRefresh, user?.id, fetchNotifications])

  useEffect(() => {
    const onNotif = () => {
      const uid = useAuthStore.getState().user?.id
      if (uid) void useNotificationStore.getState().fetchNotifications(uid)
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
    const reconnect = () => {
      if (!user?.id) return
      fetchNotifications(user.id)
      homeRefreshRef.current?.()
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') setTimeout(reconnect, 100)
    }

    const onOnline = () => setTimeout(reconnect, 200)

    const onPageShow = (e) => {
      if (e.persisted) setTimeout(reconnect, 100) // bfcache에서 복원 시
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [user?.id])

  return (
    <BrowserRouter>
      <PushNotificationNavBridge />
      <PostOAuthRedirect />
      <ModerationRestrictionGate />
      <ServerMaintenanceGate>
      <Layout>
        <Routes>
          <Route path="/"              element={<MainPage />} />
          <Route path="/explore"       element={<Navigate to="/feed/best" replace />} />
          <Route path="/feed/:variant" element={<MainFeedPage />} />
          <Route path="/matchups" element={
            <Suspense fallback={<RouteLoadingFallback />}>
              <LazySP.HomePage refreshRef={homeRefreshRef} />
            </Suspense>
          } />
          <Route path="/landing" element={<RouteSuspense Page={LazySP.LandingPage} />} />
          <Route path="/events" element={<RouteSuspense Page={LazySP.EventsComingSoonPage} />} />
          <Route path="/matchup/:id" element={<RouteSuspense Page={LazyRMM.MatchupDetailPage} />} />
          <Route path="/ranking" element={<RouteSuspense Page={LazySP.RankingPage} />} />
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
          <Route path="/signup" element={<RouteSuspense Page={LazySP.SignupPage} />} />
          <Route path="/welcome" element={<RouteSuspense Page={LazySP.WelcomePage} />} />
          <Route path="/login" element={<LoginPage />} />
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

      {/* 전역 매치업 생성 Drawer */}
      <CreateMatchupDrawer onCreated={() => homeRefreshRef.current?.()} />

      {/* 전역 도전하기 Drawer (User B) */}
      <ChallengeDrawer />

      {/* 전역 로그인 모달 */}
      <Modal
        isOpen={isLoginModalOpen}
        onClose={closeLoginModal}
        title={false}
        className="max-w-[min(22rem,calc(100vw-2rem))] overflow-visible border border-white/70 bg-transparent shadow-2xl shadow-fuchsia-500/20"
        bodyClassName="p-0 overflow-y-auto overflow-x-hidden"
      >
        <LoginModal onClose={closeLoginModal} />
      </Modal>
      </ServerMaintenanceGate>
    </BrowserRouter>
  )
}

export default App
