import { create } from 'zustand'

export const useUIStore = create((set) => ({
  isCreateDrawerOpen: false,
  /** 작성자(A) 쪽 수정 시 프리필용 매치업 행 (신규 생성 시 null) */
  createDrawerEditMatchup: null,
  isLoginModalOpen: false,
  loginModalContext: null, // 'vote' | null
  challengeMatchup: null, // { id, title, left_type, left_url, left_thumbnail_url, left_text, tags, ... }
  /** true면 도전자(B) 기존 콘텐츠 수정 모드 */
  challengeMatchupEdit: false,
  toast: null,

  openCreateDrawer: () => set({ isCreateDrawerOpen: true, createDrawerEditMatchup: null }),
  openCreateDrawerForEdit: (matchup) => set({ isCreateDrawerOpen: true, createDrawerEditMatchup: matchup }),
  closeCreateDrawer: () => set({ isCreateDrawerOpen: false, createDrawerEditMatchup: null }),

  openLoginModal: (context) => set({ isLoginModalOpen: true, loginModalContext: context }),
  closeLoginModal: () => set({ isLoginModalOpen: false, loginModalContext: null }),

  openChallengeDrawer: (matchup, edit = false) =>
    set({ challengeMatchup: matchup, challengeMatchupEdit: Boolean(edit) }),
  closeChallengeDrawer: () => set({ challengeMatchup: null, challengeMatchupEdit: false }),

  showToast: (message, type = 'success') => {
    set({ toast: { message, type, id: Date.now() } })
    setTimeout(() => set({ toast: null }), 3000)
  },

  noticePushRefresh: 0,
  incrementNoticePushRefresh: () => set((s) => ({ noticePushRefresh: s.noticePushRefresh + 1 })),

  noticeListRefresh: 0,
  incrementNoticeListRefresh: () => set((s) => ({ noticeListRefresh: s.noticeListRefresh + 1 })),

  popupRefresh: 0,
  incrementPopupRefresh: () => set((s) => ({ popupRefresh: s.popupRefresh + 1 })),

  isNotificationPanelOpen: false,
  openNotificationPanel: () => set({ isNotificationPanelOpen: true }),
  closeNotificationPanel: () => set({ isNotificationPanelOpen: false }),
  toggleNotificationPanel: () => set((s) => ({ isNotificationPanelOpen: !s.isNotificationPanelOpen })),

  welcomeBackOpen: false,
  welcomeBackData: null, // { nickname, avatarUrl, userId, endsAt }
  openWelcomeBackModal: (data) => set({ welcomeBackOpen: true, welcomeBackData: data }),
  closeWelcomeBackModal: () => set({ welcomeBackOpen: false, welcomeBackData: null }),
}))
