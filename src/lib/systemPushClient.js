import { supabase } from './supabase'

const fpKey = (userId) => `vics_admin_ua_fp_v1_${userId}`

/** 관리자 레이아웃 진입 시: 이전에 저장한 UA와 다르면 new_admin_login 시스템 푸시(설정 ON 시) */
export async function notifyNewAdminLoginDevice(user) {
  if (!user?.id || typeof window === 'undefined' || typeof localStorage === 'undefined') return
  try {
    const key = fpKey(user.id)
    const fp = `${user.id}::${navigator.userAgent || ''}`
    const prev = localStorage.getItem(key)
    if (prev && prev !== fp) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        await fetch(`${window.location.origin}/.netlify/functions/system-push-dispatch`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            eventId: 'new_admin_login',
            title: '관리자 로그인 환경 변경',
            body: `계정: ${user.email}\n이전과 다른 브라우저/UA로 접속했습니다.\n${navigator.userAgent}`.slice(0, 3500),
          }),
        })
      }
    }
    localStorage.setItem(key, fp)
  } catch {
    /* ignore */
  }
}
