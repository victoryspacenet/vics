import { supabase } from './supabase'

/**
 * Supabase `signInWithPassword` 실패 시 사용자에게 보여줄 메시지
 * (이메일 미인증은 동일한 "Invalid login credentials"로 올 수 있어 code·문구 둘 다 확인)
 */
export function messageForSignInWithPasswordError(err) {
  const code = err && typeof err === 'object' ? String(err.code || '') : ''
  const msg = String(err?.message || '').toLowerCase()

  if (
    code === 'email_not_confirmed' ||
    msg.includes('email not confirmed') ||
    msg.includes('email_not_confirmed')
  ) {
    return '이메일 인증을 먼저 완료해 주세요. 가입 시 받은 메일의 링크를 누른 뒤 다시 로그인해 주세요.'
  }
  if (
    msg.includes('email logins are disabled') ||
    msg.includes('email logins disabled') ||
    msg.includes('provider is disabled') ||
    msg.includes('provider disabled')
  ) {
    return '현재 이메일 로그인 기능이 비활성화되어 있어요. Supabase 대시보드 → Authentication → Providers에서 Email을 활성화해 주세요.'
  }
  if (msg.includes('captcha') || msg.includes('turnstile')) {
    return '보안 인증(CAPTCHA) 설정 때문에 로그인이 차단됐을 수 있어요. Supabase Auth의 CAPTCHA 설정을 확인해 주세요.'
  }
  if (code === 'too_many_requests' || msg.includes('too many requests')) {
    return '시도가 너무 많아요. 잠시 후 다시 시도해 주세요.'
  }
  return '이메일 또는 비밀번호가 올바르지 않아요'
}

/**
 * Supabase `signUp` 실패 시 — 이미 가입된 이메일 등은 원문이 영어라 사용자용으로 정리
 */
export function messageForSignUpError(err) {
  const msg = String(err?.message || '').toLowerCase()
  const code = String(err?.code || '')
  const status = Number(err?.status)

  if (
    msg.includes('already registered') ||
    msg.includes('already been registered') ||
    msg.includes('user already registered') ||
    msg.includes('user already exists') ||
    msg.includes('email address is already') ||
    msg.includes('email is already in use') ||
    msg.includes('email already') ||
    (msg.includes('already exists') && msg.includes('user'))
  ) {
    return '이미 가입된 이메일이에요. 로그인을 시도해 주세요.'
  }
  if (code === '23505' || msg.includes('duplicate key')) {
    if (msg.includes('nickname') || msg.includes('profiles_nickname')) {
      return '이미 사용 중인 닉네임이에요. 다른 닉네임으로 다시 중복 확인해 주세요.'
    }
    return '이미 가입된 정보가 있어요. 로그인을 시도해 주세요.'
  }
  if (code === 'too_many_requests' || msg.includes('too many requests') || status === 429) {
    return '시도가 너무 많아요. 잠시 후 다시 시도해 주세요.'
  }
  if (msg.includes('rate limit') || msg.includes('email rate limit')) {
    return '이메일 발송 한도에 걸렸어요. 잠시 후 다시 시도해 주세요.'
  }
  return err?.message || '회원가입에 실패했어요. 잠시 후 다시 시도해 주세요.'
}

/**
 * 가입 확인(인증) 메일 재전송 — "이메일 인증을 먼저 완료해 주세요" 에러로 로그인이
 * 막힌 유저가 인증 메일을 못 받았거나 잃어버렸을 때 스스로 다시 받을 수 있게 함.
 * @param {string} email
 * @returns {Promise<{ ok: boolean; message: string }>}
 */
export async function resendSignupVerificationEmail(email) {
  const trimmed = String(email || '').trim()
  if (!trimmed) {
    return { ok: false, message: '이메일을 입력해 주세요.' }
  }
  try {
    const { error } = await supabase.auth.resend({ type: 'signup', email: trimmed })
    if (error) throw error
    return { ok: true, message: '인증 메일을 다시 보냈어요. 받은 편지함·스팸함을 확인해 주세요 📩' }
  } catch (err) {
    const msg = String(err?.message || '').toLowerCase()
    if (msg.includes('already confirmed') || msg.includes('already been confirmed')) {
      return { ok: true, message: '이미 인증된 이메일이에요. 비밀번호로 바로 로그인해 주세요.' }
    }
    if (msg.includes('rate limit')) {
      return { ok: false, message: '메일 발송 한도에 걸렸어요. 잠시 후 다시 시도해 주세요.' }
    }
    return { ok: false, message: '인증 메일 재전송에 실패했어요. 잠시 후 다시 시도해 주세요.' }
  }
}
