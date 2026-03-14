import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'

function extractNickname(user) {
  const meta = user.raw_user_meta_data || user.user_metadata || {}
  const raw = (
    meta.nickname ||
    meta.name ||
    meta.full_name ||
    meta.user_name ||
    meta.preferred_username ||
    (user.email ? user.email.split('@')[0] : null) ||
    'user'
  )
  // 특수문자 제거, 2~20자 유지
  const clean = raw.replace(/[^가-힣a-zA-Z0-9_]/g, '').slice(0, 20) || 'user'
  return clean
}

async function ensureProfile(user) {
  try {
    // 프로필 존재 여부 확인
    const { data: existing, error: selectErr } = await supabase
      .from('profiles')
      .select('id, nickname')
      .eq('id', user.id)
      .maybeSingle()

    if (selectErr) {
      console.warn('[ensureProfile] select error:', selectErr.message)
    }

    if (existing) return // 이미 있으면 끝

    // 프로필 생성 (트리거가 실패했을 경우 대비)
    const meta = user.raw_user_meta_data || user.user_metadata || {}
    let nickname = extractNickname(user)
    const avatarUrl = meta.avatar_url || meta.picture || null

    // 닉네임 중복 확인 → 중복이면 숫자 추가
    for (let i = 0; i < 5; i++) {
      const { data: conflict } = await supabase
        .from('profiles')
        .select('id')
        .eq('nickname', nickname)
        .maybeSingle()
      if (!conflict) break
      nickname = extractNickname(user).slice(0, 15) + Math.floor(Math.random() * 9000 + 1000)
    }

    const { error: insertErr } = await supabase.from('profiles').insert({
      id: user.id,
      email: user.email,
      nickname,
      avatar_url: avatarUrl,
    })

    if (insertErr) {
      console.warn('[ensureProfile] insert error:', insertErr.message, insertErr.code)
      // 이미 존재하는 경우(23505) 무시
      if (insertErr.code !== '23505') {
        console.error('[ensureProfile] 프로필 생성 실패:', insertErr)
      }
    } else {
      console.log('[ensureProfile] 프로필 생성 완료:', nickname)
    }
  } catch (err) {
    // 프로필 생성 실패해도 로그인 플로우는 계속 진행
    console.error('[ensureProfile] 예상치 못한 오류:', err)
  }
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      loading: true,

      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      setLoading: (loading) => set({ loading }),

      initialize: async () => {
        set({ loading: true })
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            set({ user: session.user })
            await ensureProfile(session.user)
            await get().fetchProfile(session.user.id)
          }
        } catch (err) {
          console.error('[Auth] initialize error:', err)
        } finally {
          set({ loading: false })
        }

        supabase.auth.onAuthStateChange(async (event, session) => {
          console.log('[Auth] onAuthStateChange:', event, session?.user?.id)
          try {
            if (session?.user) {
              set({ user: session.user })
              if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
                await ensureProfile(session.user)
              }
              await get().fetchProfile(session.user.id)
            } else if (event === 'SIGNED_OUT') {
              set({ user: null, profile: null })
            }
          } catch (err) {
            console.error('[Auth] onAuthStateChange error:', err)
          }
        })
      },

      fetchProfile: async (userId) => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle()
          if (error) console.warn('[fetchProfile] error:', error.message)
          if (data) set({ profile: data })
        } catch (err) {
          console.error('[fetchProfile] 예상치 못한 오류:', err)
        }
      },

      updateProfile: async (updates) => {
        const { user } = get()
        if (!user) return { error: new Error('로그인이 필요해요') }
        try {
          const { data, error } = await supabase
            .from('profiles')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', user.id)
            .select()
            .single()
          if (data) set({ profile: data })
          return { data, error }
        } catch (err) {
          return { error: err }
        }
      },

      signOut: async () => {
        try {
          await supabase.auth.signOut()
        } catch (err) {
          console.error('[Auth] signOut error:', err)
        }
        set({ user: null, profile: null })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, profile: state.profile }),
    }
  )
)
