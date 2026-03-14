import { create } from 'zustand'

export const useUIStore = create((set) => ({
  isCreateDrawerOpen: false,
  isLoginModalOpen: false,
  challengeMatchup: null, // { id, title, left_type, left_url, left_thumbnail_url, left_text, tags, ... }
  toast: null,

  openCreateDrawer: () => set({ isCreateDrawerOpen: true }),
  closeCreateDrawer: () => set({ isCreateDrawerOpen: false }),

  openLoginModal: () => set({ isLoginModalOpen: true }),
  closeLoginModal: () => set({ isLoginModalOpen: false }),

  openChallengeDrawer: (matchup) => set({ challengeMatchup: matchup }),
  closeChallengeDrawer: () => set({ challengeMatchup: null }),

  showToast: (message, type = 'success') => {
    set({ toast: { message, type, id: Date.now() } })
    setTimeout(() => set({ toast: null }), 3000)
  },
}))
