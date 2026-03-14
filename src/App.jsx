import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useUIStore } from './store/uiStore'
import { useNotificationStore } from './store/notificationStore'
import { Layout } from './components/layout/Layout'
import { Modal } from './components/ui/Modal'
import { CreateMatchupDrawer } from './components/matchup/CreateMatchupDrawer'
import { ChallengeDrawer } from './components/matchup/ChallengeDrawer'
import { LoginModal } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { MatchupDetailPage } from './pages/MatchupDetailPage'
import { RankingPage } from './pages/RankingPage'
import { MyPage } from './pages/MyPage'
import { SignupPage } from './pages/SignupPage'
import { LoginPage } from './pages/LoginPage'
import { ProfileEditPage } from './pages/ProfileEditPage'
import { ProfileImageEditPage } from './pages/ProfileImageEditPage'
import { DeleteAccountPage } from './pages/DeleteAccountPage'
import { DeletedPage } from './pages/DeletedPage'
import { LandingPage } from './pages/LandingPage'
import { MainPage } from './pages/MainPage'
import { MainFeedPage } from './pages/MainFeedPage'
import { RankingGalleryPage } from './pages/RankingGalleryPage'
import { PolicyPlaceholderPage } from './pages/PolicyPlaceholderPage'

function App() {
  const { initialize, user } = useAuthStore()
  const { isLoginModalOpen, closeLoginModal, showToast } = useUIStore()
  const { fetchNotifications, subscribeRealtime, reset: resetNotifications } = useNotificationStore()
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
      <Layout>
        <Routes>
          <Route path="/"              element={<MainPage />} />
          <Route path="/feed/:variant" element={<MainFeedPage />} />
          <Route path="/matchups"
            element={user ? <HomePage refreshRef={homeRefreshRef} /> : <Navigate to="/" replace />}
          />
          <Route path="/landing"      element={<LandingPage />} />
          <Route path="/matchup/:id"   element={<MatchupDetailPage />} />
          <Route path="/ranking"       element={<RankingPage />} />
          <Route path="/mypage"        element={<MyPage />} />
          <Route path="/signup"        element={<SignupPage />} />
          <Route path="/login"         element={<LoginPage />} />
          <Route path="/mypage/edit"   element={<ProfileEditPage />} />
          <Route path="/mypage/edit/image" element={<ProfileImageEditPage />} />
          <Route path="/mypage/delete" element={<DeleteAccountPage />} />
          <Route path="/goodbye"            element={<DeletedPage />} />
          <Route path="/mypage/ranking-gallery" element={<RankingGalleryPage />} />
          <Route path="/privacy" element={<PolicyPlaceholderPage title="개인정보처리방침" />} />
          <Route path="/terms" element={<PolicyPlaceholderPage title="이용약관" />} />
          <Route path="/community-policy" element={<PolicyPlaceholderPage title="커뮤니티운영정책" />} />
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
        title="로그인"
      >
        <LoginModal onClose={closeLoginModal} />
      </Modal>
    </BrowserRouter>
  )
}

export default App
