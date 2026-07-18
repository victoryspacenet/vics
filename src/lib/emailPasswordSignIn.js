import { supabase } from './supabase'
import { setAuthSessionCache } from './authSessionCache'
import { useAuthStore } from '../store/authStore'

/**
 * signInWithPassword 직후 — onAuthStateChange 타이밍에 의존하지 않고
 * 모바일 Safari에서도 즉시 로그인 상태를 반영합니다.
 * @param {{ session?: import('@supabase/supabase-js').Session | null, user?: import('@supabase/supabase-js').User | null }} signInData
 */
export async function completeEmailPasswordSignIn(signInData) {
  const user = signInData?.user
  const session = signInData?.session
  if (!user?.id) throw new Error('로그인 정보를 받지 못했어요')

  if (session?.access_token) setAuthSessionCache(session)
  useAuthStore.getState().setUser(user)
  useAuthStore.setState({ loading: false })

  let activeSession = session
  if (!activeSession?.access_token) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 120))
      const { data: { session: next } } = await supabase.auth.getSession()
      if (next?.access_token) {
        activeSession = next
        break
      }
    }
  }

  if (!activeSession?.access_token) {
    throw new Error('로그인 세션을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
  }

  setAuthSessionCache(activeSession)
  if (activeSession.user?.id) useAuthStore.getState().setUser(activeSession.user)
  await useAuthStore.getState().fetchProfile(user.id, { force: true })
  return user
}
