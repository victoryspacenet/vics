import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { MAIN_SPOTLIGHT_1H_COST } from '../lib/mainSpotlight'
import { isRejoinCooldownDbError, REJOIN_COOLDOWN_USER_MESSAGE } from '../lib/rejoinCooldown'
import { useUIStore } from './uiStore'
import { useAdminPermissionStore } from './adminPermissionStore'

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
      if (isRejoinCooldownDbError(insertErr)) {
        await useAuthStore.getState().signOut()
        useUIStore.getState().showToast(REJOIN_COOLDOWN_USER_MESSAGE, 'error')
        return
      }
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

/** initialize()가 여러 번 호출돼도 리스너가 중복 등록되지 않도록 */
let authStateSubscription = null

// user/profile은 Supabase 세션(+ getSession / onAuthStateChange)만 소스로 둡니다.
// zustand persist로 user를 localStorage에 두면 hydrate merge가 initialize·로그아웃 이후에
// 늦게 끝나며 옛 user 객체로 상태를 덮어써 웹에서만 "로그아웃 안 됨"처럼 보일 수 있습니다.
export const useAuthStore = create((set, get) => ({
      user: null,
      profile: null,
      loading: true,

      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      setLoading: (loading) => set({ loading }),

      initialize: async () => {
        set({ loading: true })
        try {
          if (authStateSubscription) {
            authStateSubscription.unsubscribe()
            authStateSubscription = null
          }
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            set({ user: session.user })
            await ensureProfile(session.user)
            await get().fetchProfile(session.user.id)
          } else {
            // Supabase에 세션이 없으면 UI도 비로그인으로 맞춤
            set({ user: null, profile: null })
          }
        } catch (err) {
          console.error('[Auth] initialize error:', err)
        } finally {
          set({ loading: false })
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log('[Auth] onAuthStateChange:', event, session?.user?.id)
          try {
            if (session?.user) {
              set({ user: session.user })
              if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
                await ensureProfile(session.user)
              }
              await get().fetchProfile(session.user.id)
            } else {
              // SIGNED_OUT뿐 아니라 INITIAL_SESSION(null) 등 세션 없음 모두 동기화
              set({ user: null, profile: null })
            }
          } catch (err) {
            console.error('[Auth] onAuthStateChange error:', err)
          }
        })
        authStateSubscription = subscription
      },

      fetchProfile: async (userId) => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle()
          if (error) console.warn('[fetchProfile] error:', error.message)
          if (!data) return

          let profile = data
          const boostOn =
            import.meta.env.DEV &&
            (import.meta.env.VITE_BOOST_POINTS_FOR_TEST === '1' ||
              import.meta.env.VITE_BOOST_POINTS_FOR_TEST === 'true')
          // 스포트라이트 등으로 차감된 잔액을 덮어쓰지 않도록: '한 번도 살 수 없을 만큼' 부족할 때만 상향
          if (boostOn) {
            const floor = Number(import.meta.env.VITE_BOOST_POINTS_FLOOR || 50000)
            const pts = Number(data.points || 0)
            if (pts < MAIN_SPOTLIGHT_1H_COST) {
              const { data: patched, error: upErr } = await supabase
                .from('profiles')
                .update({ points: floor, updated_at: new Date().toISOString() })
                .eq('id', userId)
                .select('*')
                .maybeSingle()
              if (upErr) console.warn('[fetchProfile] boost points:', upErr.message)
              else if (patched) profile = patched
            }
          }

          if (import.meta.env.DEV) {
            const forceDiamondNick = import.meta.env.VITE_DEV_FANDOM_TIER_AS_DIAMOND_FOR_NICKNAME?.trim()
            if (forceDiamondNick && String(profile.nickname || '').trim() === forceDiamondNick) {
              profile = { ...profile, fandom_tier: 'diamond' }
            }
            // DEV: 네온/공개권한 강제 초기화 닉네임 목록 (env로 제어)
            const resetPurchasesNick = import.meta.env.VITE_DEV_RESET_PURCHASES_FOR_NICKNAME?.trim()
            if (resetPurchasesNick && String(profile.nickname || '').trim() === resetPurchasesNick) {
              profile = {
                ...profile,
                neon_profile_theme_unlocked_at: null,
                neon_profile_theme_expires_at: null,
                neon_profile_theme_id: null,
                profile_public_unlocked_at: null,
                profile_public_expires_at: null,
              }
            }
          }

          try {
            const { data: tierBonus, error: tierBonusErr } = await supabase.rpc(
              'grant_matchup_tier_milestone_bonuses'
            )
            if (
              !tierBonusErr &&
              tierBonus?.ok === true &&
              Number(tierBonus.total_granted || 0) > 0
            ) {
              const { data: refreshed, error: refErr } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle()
              if (!refErr && refreshed) {
                profile = refreshed
                if (import.meta.env.DEV) {
                  const forceDiamondNick = import.meta.env.VITE_DEV_FANDOM_TIER_AS_DIAMOND_FOR_NICKNAME?.trim()
                  if (forceDiamondNick && String(profile.nickname || '').trim() === forceDiamondNick) {
                    profile = { ...profile, fandom_tier: 'diamond' }
                  }
                }
                window.dispatchEvent(
                  new CustomEvent('vics:matchup-tier-milestone-bonus', { detail: tierBonus })
                )
              }
            }
          } catch (e) {
            console.warn('[fetchProfile] tier milestone bonus:', e?.message || e)
          }

          // 로그아웃 직후 등으로 user가 이미 없어졌으면 스테일 프로필로 UI가 되살아나지 않게 함
          const u = get().user
          if (!u || u.id !== userId) return
          set({ profile })
        } catch (err) {
          console.error('[fetchProfile] 예상치 못한 오류:', err)
        }
      },

      updateProfile: async (updates) => {
        const { user } = get()
        if (!user) return { error: new Error('로그인이 필요해요') }
        try {
          const safe = { ...updates }
          delete safe.profile_public_unlocked_at
          delete safe.profile_public_expires_at
          delete safe.neon_profile_theme_unlocked_at
          delete safe.neon_profile_theme_expires_at
          delete safe.neon_profile_theme_id
          delete safe.nickname_changed_season_number
          delete safe.fandom_points
          delete safe.fandom_tier
          delete safe.matchup_tier_bonus_mask
          const { data, error } = await supabase
            .from('profiles')
            .update({ ...safe, updated_at: new Date().toISOString() })
            .eq('id', user.id)
            .select('*')
            .single()
          if (data) set({ profile: data })
          return { data, error }
        } catch (err) {
          return { error: err }
        }
      },

      signOut: async () => {
        useAdminPermissionStore.getState().reset()
        // 먼저 스토어를 비워 헤더·라우트가 즉시 비로그인으로 반응 (웹에서 클릭 후 무반응처럼 보이는 현상 완화)
        set({ user: null, profile: null })
        try {
          // scope 분리 + global fire-and-forget 보다 한 번에 끝까지 await 하는 편이 세션/리프레시 토큰 정리에 안정적
          const { error } = await supabase.auth.signOut()
          if (error) console.warn('[Auth] signOut:', error.message)
        } catch (err) {
          console.error('[Auth] signOut error:', err)
        }
      },
}))
