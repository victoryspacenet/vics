import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useUIStore } from './store/uiStore'
import { useNotificationStore } from './store/notificationStore'
import { Layout } from './components/layout/Layout'
import { Modal } from './components/ui/Modal'
import { CreateMatchupDrawer } from './components/matchup/CreateMatchupDrawer'
import { ChallengeDrawer } from './components/matchup/ChallengeDrawer'
import { LoginModal, LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { MatchupDetailPage } from './pages/MatchupDetailPage'
import { RankingPage } from './pages/RankingPage'
import { MyPage } from './pages/MyPage'
import { PublicProfilePage } from './pages/PublicProfilePage'
import { SignupPage } from './pages/SignupPage'
import { WelcomePage } from './pages/WelcomePage'
import { ProfileEditPage } from './pages/ProfileEditPage'
import { ProfileImageEditPage } from './pages/ProfileImageEditPage'
import { DeleteAccountPage } from './pages/DeleteAccountPage'
import { DeletedPage } from './pages/DeletedPage'
import { LandingPage } from './pages/LandingPage'
import { EventsComingSoonPage } from './pages/EventsComingSoonPage'
import { MainPage } from './pages/MainPage'
import { MainFeedPage } from './pages/MainFeedPage'
import { RankingGalleryPage } from './pages/RankingGalleryPage'
import { SearchPage } from './pages/SearchPage'
import { TermsPage } from './pages/TermsPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { CommunityPolicyPage } from './pages/CommunityPolicyPage'
import { PointRewardsPage } from './pages/PointRewardsPage'
import { MainSpotlight1hPage } from './pages/MainSpotlight1hPage'
import { VictoryReportPage } from './pages/VictoryReportPage'
import { VictoryReportCheerPage } from './pages/VictoryReportCheerPage'
import { FandomDashboardPage } from './pages/FandomDashboardPage'
import { DevFandomMilestonePreviewPage } from './pages/DevFandomMilestonePreviewPage'
import { DevFandomBronzeBadgePreviewPage } from './pages/DevFandomBronzeBadgePreviewPage'
import { DevDiamondLegendPreviewPage } from './pages/DevDiamondLegendPreviewPage'
import { DevLegendFeedBannerPage } from './pages/DevLegendFeedBannerPage'
import { ProfilePublicRewardPage } from './pages/ProfilePublicRewardPage'
import { NeonProfileThemePage } from './pages/NeonProfileThemePage'
import { BannerHighlightBoostPage } from './pages/BannerHighlightBoostPage'
import { VoteStatsUnlockPage } from './pages/VoteStatsUnlockPage'
import { AccessRestrictedPage } from './pages/AccessRestrictedPage'
import { NoticePage } from './pages/NoticePage'
import { NoticeDetailPage } from './pages/NoticeDetailPage'
import { ContentDeletionNoticePage } from './pages/ContentDeletionNoticePage'
import { NoticeAdminPage } from './pages/NoticeAdminPage'
import { NoticeEditPage } from './pages/NoticeEditPage'
import { NoticePublishCompletePage } from './pages/NoticePublishCompletePage'
import { PopupNoticeAdminPage } from './pages/PopupNoticeAdminPage'
import { PopupNoticeListPage } from './pages/PopupNoticeListPage'
import { PopupNoticeCompletePage } from './pages/PopupNoticeCompletePage'
import { PopupNoticeDetailPage } from './pages/PopupNoticeDetailPage'
import { PopupNoticeStatsPage } from './pages/PopupNoticeStatsPage'
import { InquiryMainPage } from './pages/InquiryMainPage'
import { InquirySearchPage } from './pages/InquirySearchPage'
import { InquiryCategoryPage } from './pages/InquiryCategoryPage'
import { InquiryCategoryHelpDetailPage } from './pages/InquiryCategoryHelpDetailPage'
import { InquiryFormPage } from './pages/InquiryFormPage'
import { AppealFormPage } from './pages/AppealFormPage'
import { AppealCompletePage } from './pages/AppealCompletePage'
import { AppealDetailPage } from './pages/AppealDetailPage'
import { AppealResultPage } from './pages/AppealResultPage'
import { InquiryFaqDetailPage } from './pages/InquiryFaqDetailPage'
import { InquiryCompletePage } from './pages/InquiryCompletePage'
import { InquiryHistoryPage } from './pages/InquiryHistoryPage'
import { InquiryHistoryDetailPage } from './pages/InquiryHistoryDetailPage'
import { AdminLayout } from './components/layout/AdminLayout'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage'
import { AdminOperatorAccountPage } from './pages/admin/AdminOperatorAccountPage'
import { AdminOperatorSecurityLogPage } from './pages/admin/AdminOperatorSecurityLogPage'
import { AdminOperatorNewPage } from './pages/admin/AdminOperatorNewPage'
import { AdminOperatorEditPage } from './pages/admin/AdminOperatorEditPage'
import { AdminOperatorDeletePage } from './pages/admin/AdminOperatorDeletePage'
import { AdminPermissionGroupPage } from './pages/admin/AdminPermissionGroupPage'
import { AdminTwoFactorPage } from './pages/admin/AdminTwoFactorPage'
import { AdminAutoBotPage } from './pages/admin/AdminAutoBotPage'
import { AdminBannedWordsPage } from './pages/admin/AdminBannedWordsPage'
import { AdminMessengerPage } from './pages/admin/AdminMessengerPage'
import { AdminSystemPushPage } from './pages/admin/AdminSystemPushPage'
import { AdminApiKeysPage } from './pages/admin/AdminApiKeysPage'
import { AdminMatchupsPage } from './pages/admin/AdminMatchupsPage'
import { AdminMatchupDetailPage } from './pages/admin/AdminMatchupDetailPage'
import { AdminUsersPage } from './pages/admin/AdminUsersPage'
import { AdminUserDetailPage } from './pages/admin/AdminUserDetailPage'
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage'
import { InquiryAdminListPage } from './pages/admin/InquiryAdminListPage'
import { InquiryAdminDetailPage } from './pages/admin/InquiryAdminDetailPage'
import { InquiryAdminCompletePage } from './pages/admin/InquiryAdminCompletePage'
import { InquiryHotFaqAdminPage } from './pages/admin/InquiryHotFaqAdminPage'
import { InquiryCategoryFaqAdminPage } from './pages/admin/InquiryCategoryFaqAdminPage'
import { AdminAppealListPage } from './pages/admin/AdminAppealListPage'
import { AdminAppealDetailPage } from './pages/admin/AdminAppealDetailPage'
import { consumeStoredLoginReturn, getSafeReturnPath } from './lib/loginReturn'

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

  // 절전/복귀 후 Realtime 재연결 (노트북 껐다 켜도 탭 연결 유지)
  useEffect(() => {
    const reconnect = () => {
      if (!user?.id) return
      subscribeRealtime(user.id)
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
      <PostOAuthRedirect />
      <Layout>
        <Routes>
          <Route path="/"              element={<MainPage />} />
          <Route path="/explore"       element={<Navigate to="/feed/best" replace />} />
          <Route path="/feed/:variant" element={<MainFeedPage />} />
          <Route path="/matchups" element={<HomePage refreshRef={homeRefreshRef} />} />
          <Route path="/landing"      element={<LandingPage />} />
          <Route path="/events"       element={<EventsComingSoonPage />} />
          <Route path="/matchup/:id"   element={<MatchupDetailPage />} />
          <Route path="/ranking"       element={<RankingPage />} />
          <Route path="/search"        element={<SearchPage />} />
          <Route path="/rewards"       element={<PointRewardsPage />} />
          <Route path="/rewards/main-spotlight" element={<MainSpotlight1hPage />} />
          <Route path="/rewards/banner-highlight" element={<BannerHighlightBoostPage />} />
          <Route path="/rewards/vote-stats" element={<VoteStatsUnlockPage />} />
          <Route path="/rewards/v-card/cheer" element={<VictoryReportCheerPage />} />
          <Route path="/rewards/v-card" element={<VictoryReportPage />} />
          <Route path="/fandom" element={<FandomDashboardPage />} />
          <Route path="/dev/fandom-milestone" element={<DevFandomMilestonePreviewPage />} />
          <Route path="/dev/fandom-bronze-badge" element={<DevFandomBronzeBadgePreviewPage />} />
          <Route path="/dev/diamond-legend" element={<DevDiamondLegendPreviewPage />} />
          <Route path="/dev/legend-feed-banner" element={<DevLegendFeedBannerPage />} />
          <Route path="/rewards/profile-public" element={<ProfilePublicRewardPage />} />
          <Route path="/rewards/neon-profile-theme" element={<NeonProfileThemePage />} />
          <Route path="/hall-of-fame" element={<EventsComingSoonPage />} />
          <Route path="/profile/:userId" element={<PublicProfilePage />} />
          <Route path="/mypage"        element={<MyPage />} />
          <Route path="/signup"        element={<SignupPage />} />
          <Route path="/welcome"       element={<WelcomePage />} />
          <Route path="/login"         element={<LoginPage />} />
          <Route path="/mypage/edit"   element={<ProfileEditPage />} />
          <Route path="/mypage/edit/image" element={<ProfileImageEditPage />} />
          <Route path="/mypage/delete" element={<DeleteAccountPage />} />
          <Route path="/goodbye"            element={<DeletedPage />} />
          <Route path="/mypage/ranking-gallery" element={<RankingGalleryPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/community-policy" element={<CommunityPolicyPage />} />
          <Route path="/restricted" element={<AccessRestrictedPage />} />
          <Route path="/notice" element={<NoticePage />} />
          <Route path="/notice/deletion/:id?" element={<ContentDeletionNoticePage />} />
          <Route path="/notice/:id" element={<NoticeDetailPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="settings/permissions" element={<AdminPermissionGroupPage />} />
            <Route path="settings/2fa" element={<AdminTwoFactorPage />} />
            <Route path="settings/autobot" element={<AdminAutoBotPage />} />
            <Route path="settings/banned-words" element={<AdminBannedWordsPage />} />
            <Route path="settings/messenger" element={<AdminMessengerPage />} />
            <Route path="settings/system-push" element={<AdminSystemPushPage />} />
            <Route path="settings/api-keys" element={<AdminApiKeysPage />} />
            <Route path="settings/operators/security-log" element={<AdminOperatorSecurityLogPage />} />
            <Route path="settings/operators/new" element={<AdminOperatorNewPage />} />
            <Route path="settings/operators/:id/delete" element={<AdminOperatorDeletePage />} />
            <Route path="settings/operators/:id" element={<AdminOperatorEditPage />} />
            <Route path="settings/operators" element={<AdminOperatorAccountPage />} />
            <Route path="matchups/:id" element={<AdminMatchupDetailPage />} />
            <Route path="matchups" element={<AdminMatchupsPage />} />
            <Route path="users/:id" element={<AdminUserDetailPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="inquiry/hot-faq" element={<InquiryHotFaqAdminPage />} />
            <Route path="inquiry/category-faq" element={<InquiryCategoryFaqAdminPage />} />
            <Route path="inquiry" element={<InquiryAdminListPage />} />
            <Route path="inquiry/complete" element={<InquiryAdminCompletePage />} />
            <Route path="inquiry/:id" element={<InquiryAdminDetailPage />} />
            <Route path="appeals" element={<AdminAppealListPage />} />
            <Route path="appeals/:id" element={<AdminAppealDetailPage />} />
            <Route path="notice/new" element={<NoticeAdminPage />} />
            <Route path="notice/edit/:id" element={<NoticeEditPage />} />
            <Route path="notice/popup" element={<PopupNoticeAdminPage />} />
            <Route path="notice/popup/list" element={<PopupNoticeListPage />} />
            <Route path="notice/popup/complete" element={<PopupNoticeCompletePage />} />
            <Route path="notice/popup/:id/stats" element={<PopupNoticeStatsPage />} />
            <Route path="notice/popup/:id" element={<PopupNoticeDetailPage />} />
            <Route path="notice/complete" element={<NoticePublishCompletePage />} />
          </Route>
          <Route path="/inquiry" element={<InquiryMainPage />} />
          <Route path="/inquiry/search" element={<InquirySearchPage />} />
          <Route path="/inquiry/category/:slug/help/:helpId" element={<InquiryCategoryHelpDetailPage />} />
          <Route path="/inquiry/category/:slug" element={<InquiryCategoryPage />} />
          <Route path="/inquiry/form" element={<InquiryFormPage />} />
          <Route path="/inquiry/appeal/complete" element={<AppealCompletePage />} />
          <Route path="/inquiry/appeal/result/:receiptId" element={<AppealResultPage />} />
          <Route path="/inquiry/appeal/result" element={<AppealResultPage />} />
          <Route path="/appeal-result/:receiptId" element={<AppealResultPage />} />
          <Route path="/inquiry/appeal/:receiptId" element={<AppealDetailPage />} />
          <Route path="/inquiry/appeal" element={<AppealFormPage />} />
          <Route path="/inquiry/faq/:id" element={<InquiryFaqDetailPage />} />
          <Route path="/inquiry/complete" element={<InquiryCompletePage />} />
          <Route path="/inquiry/history" element={<InquiryHistoryPage />} />
          <Route path="/inquiry/history/:receiptId" element={<InquiryHistoryDetailPage />} />
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
    </BrowserRouter>
  )
}

export default App
