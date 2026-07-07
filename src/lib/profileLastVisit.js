import { supabase } from './supabase'

/** 클라이언트·서버 UPDATE 빈도 상한 (5분) */
export const PROFILE_LAST_VISIT_TOUCH_MS = 5 * 60 * 1000

let lastTouchAt = 0
let lastTouchUserId = null

/** 로그인 유저 profiles.last_visit_at 갱신 (과도한 UPDATE 방지 스로틀) */
export async function touchProfileLastVisit(userId) {
  const id = String(userId || '').trim()
  if (!id) return

  const now = Date.now()
  if (lastTouchUserId === id && now - lastTouchAt < PROFILE_LAST_VISIT_TOUCH_MS) return

  try {
    const { error } = await supabase.rpc('touch_profile_last_visit')
    if (error) {
      console.warn('[profileLastVisit] touch:', error.message)
      return
    }
    lastTouchAt = now
    lastTouchUserId = id
  } catch (e) {
    console.warn('[profileLastVisit] touch', e?.message || e)
  }
}
