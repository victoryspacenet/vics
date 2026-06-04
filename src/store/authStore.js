import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { MAIN_SPOTLIGHT_1H_COST } from '../lib/mainSpotlight'
import { isRejoinCooldownDbError, REJOIN_COOLDOWN_USER_MESSAGE } from '../lib/rejoinCooldown'
import { runWhenIdle } from '../lib/runDeferred'
import {
  clearTierMilestoneGrantThrottle,
  markTierMilestoneGrantRan,
  shouldRunTierMilestoneGrant,
} from '../lib/tierMilestoneGrantThrottle'
import { useUIStore } from './uiStore'
import { useAdminPermissionStore } from './adminPermissionStore'
import { SIGNUP_BONUS_POINTS, grantSignupBonusIfNeeded } from '../lib/signupRewards'

/** 새 비밀번호 설정 페이지: auth Mutex 경합 줄이려 프로필·푸시 부가 작업 건너뜀(로그인 후 로드됨). */
function skipHeavyAuthHooksOnResetPasswordPage() {
  try {
    return typeof window !== 'undefined' && window.location.pathname === '/reset-password'
  } catch {
    return false
  }
}

/** `VITE_DEV_RESET_PURCHASES_FOR_NICKNAME` — 로컬 QA용 테스트 계정 */
function devTestAccountResetNickname() {
  return import.meta.env.VITE_DEV_RESET_PURCHASES_FOR_NICKNAME?.trim() || ''
}

function isDevTestAccountUiReset(profile) {
  const nick = devTestAccountResetNickname()
  return Boolean(import.meta.env.DEV && nick && String(profile?.nickname || '').trim() === nick)
}

/** DB에 남은 가상 구매·포인트를 UI에서 0으로 표시 (리워드 센터·마이페이지 등) */
function applyDevTestAccountUiReset(profile) {
  if (!isDevTestAccountUiReset(profile)) return profile
  return {
    ...profile,
    points: 0,
    oracle_points: 0,
    neon_profile_theme_unlocked_at: null,
    neon_profile_theme_expires_at: null,
    neon_profile_theme_id: null,
    profile_public_unlocked_at: null,
    profile_public_expires_at: null,
  }
}

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
      .select('id, nickname, email, birthdate, gender')
      .eq('id', user.id)
      .maybeSingle()

    if (selectErr) {
      console.warn('[ensureProfile] select error:', selectErr.message)
    }

    if (existing) {
      const meta = user.raw_user_meta_data || user.user_metadata || {}
      const patch = {}
      if (user.email && String(existing.email || '').toLowerCase() !== String(user.email || '').toLowerCase()) {
        patch.email = user.email
      }
      const metaNick = typeof meta.nickname === 'string' ? meta.nickname.trim() : ''
      const emailLocal = user.email ? String(user.email).split('@')[0] : ''
      if (
        metaNick &&
        String(existing.nickname || '') !== metaNick &&
        emailLocal &&
        String(existing.nickname || '').toLowerCase() === emailLocal.toLowerCase()
      ) {
        patch.nickname = metaNick
      }
      const metaBd = meta.birthdate || null
      if (metaBd && !existing.birthdate) patch.birthdate = metaBd
      const metaGe =
        meta.gender === 'male' || meta.gender === 'female' || meta.gender === 'other' ? meta.gender : null
      if (metaGe && !existing.gender) patch.gender = metaGe
      if (Object.keys(patch).length > 0) {
        patch.updated_at = new Date().toISOString()
        const { error: upErr } = await supabase.from('profiles').update(patch).eq('id', user.id)
        if (upErr) console.warn('[ensureProfile] metadata patch:', upErr.message)
        else {
          try {
            window.dispatchEvent(new CustomEvent('vics:adminUsers:updated'))
          } catch {
            /* ignore */
          }
        }
      }
      await grantSignupBonusIfNeeded(user.id)
      return
    }

    // 프로필 생성 (트리거가 실패했을 경우 대비)
    const meta = user.raw_user_meta_data || user.user_metadata || {}
    let nickname = extractNickname(user)
    const avatarUrl = meta.avatar_url || meta.picture || null
    const birthdate = meta.birthdate || null
    const genderRaw = meta.gender
    const gender =
      genderRaw === 'male' || genderRaw === 'female' || genderRaw === 'other' ? genderRaw : null

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

    const insertRow = {
      id: user.id,
      email: user.email,
      nickname,
      avatar_url: avatarUrl,
      points: SIGNUP_BONUS_POINTS,
    }
    if (birthdate) insertRow.birthdate = birthdate
    if (gender) insertRow.gender = gender

    const { error: insertErr } = await supabase.from('profiles').insert(insertRow)

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
      await grantSignupBonusIfNeeded(user.id)
      try {
        window.dispatchEvent(new CustomEvent('vics:adminUsers:updated'))
      } catch {
        /* ignore */
      }
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
            void useAdminPermissionStore.getState().load(session.user)
            if (!skipHeavyAuthHooksOnResetPasswordPage()) {
              await ensureProfile(session.user)
              await get().fetchProfile(session.user.id)
              runWhenIdle(() => {
                void import('../lib/pushNotifications').then((m) =>
                  m.registerPushForCurrentUser().then((r) => {
                    if (r?.error && !r?.skipped) console.warn('[Auth] push register:', r.error)
                  }),
                )
              })
            }
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
              void useAdminPermissionStore.getState().load(session.user)
              if (skipHeavyAuthHooksOnResetPasswordPage()) {
                return
              }
              if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
                await ensureProfile(session.user)
              }
              if (event !== 'TOKEN_REFRESHED') {
                await get().fetchProfile(session.user.id)
              }
              if (event === 'SIGNED_IN') {
                runWhenIdle(() => {
                  void import('../lib/pushNotifications').then((m) =>
                    m.registerPushForCurrentUser().then((r) => {
                      if (r?.error && !r?.skipped) console.warn('[Auth] push register:', r.error)
                    }),
                  )
                })
              }
            } else {
              // SIGNED_OUT뿐 아니라 INITIAL_SESSION(null) 등 세션 없음 모두 동기화
              useAdminPermissionStore.getState().reset()
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
            profile = applyDevTestAccountUiReset(profile)
          }

          const u = get().user
          if (!u || u.id !== userId) return
          set({ profile })

          const skipTierMilestoneGrant = isDevTestAccountUiReset(profile)

          runWhenIdle(() => {
            void (async () => {
              if (skipTierMilestoneGrant) return
              if (!shouldRunTierMilestoneGrant(userId)) return
              markTierMilestoneGrantRan(userId)
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
                    let nextProfile = refreshed
                    if (import.meta.env.DEV) {
                      const forceDiamondNick = import.meta.env.VITE_DEV_FANDOM_TIER_AS_DIAMOND_FOR_NICKNAME?.trim()
                      if (forceDiamondNick && String(nextProfile.nickname || '').trim() === forceDiamondNick) {
                        nextProfile = { ...nextProfile, fandom_tier: 'diamond' }
                      }
                      nextProfile = applyDevTestAccountUiReset(nextProfile)
                    }
                    window.dispatchEvent(
                      new CustomEvent('vics:matchup-tier-milestone-bonus', { detail: tierBonus })
                    )
                    const u2 = get().user
                    if (u2 && u2.id === userId) set({ profile: nextProfile })
                  }
                }
              } catch (e) {
                console.warn('[fetchProfile] tier milestone bonus:', e?.message || e)
              }
            })()
          })
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
        const uid = get().user?.id
        clearTierMilestoneGrantThrottle()
        useAdminPermissionStore.getState().reset()
        if (uid) {
          try {
            const { clearPushDeviceTokensForUser } = await import('../lib/pushNotifications')
            await clearPushDeviceTokensForUser(uid)
          } catch (err) {
            console.warn('[Auth] clearPushDeviceTokens:', err?.message || err)
          }
        }
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
