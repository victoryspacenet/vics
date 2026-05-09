/**
 * 관리자·운영자 권한 체크
 * - VITE_ADMIN_EMAILS: 쉼표로 구분된 관리자 이메일
 * - VITE_OPERATOR_EMAILS: 쉼표로 구분된 운영자 이메일 (관리자 페이지 접근 가능)
 * - 프로덕션에서는 반드시 환경변수로 설정하세요.
 * - VITE_ADMIN_EMAILS 미설정 시: 개발 편의를 위해 로그인한 모든 유저가 관리자로 인정됨
 */
const ADMIN_EMAILS_RAW = import.meta.env.VITE_ADMIN_EMAILS || ''
const ADMIN_EMAILS = ADMIN_EMAILS_RAW
  ? ADMIN_EMAILS_RAW.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  : []

const OPERATOR_EMAILS_RAW = import.meta.env.VITE_OPERATOR_EMAILS || ''
const OPERATOR_EMAILS = OPERATOR_EMAILS_RAW
  ? OPERATOR_EMAILS_RAW.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  : []

const IS_DEV_MODE = ADMIN_EMAILS.length === 0

/** VITE_ADMIN_EMAILS에 명시된 슈퍼 관리자 — DB granular 없이 전 메뉴 허용 */
export function isListedSuperAdmin(user) {
  if (!user?.email) return false
  if (ADMIN_EMAILS.length === 0) return false
  const email = user.email.trim().toLowerCase()
  return ADMIN_EMAILS.includes(email)
}

export function isAdmin(user) {
  if (!user) return false
  if (IS_DEV_MODE) return true
  if (!user.email) return false
  const email = user.email.trim().toLowerCase()
  return ADMIN_EMAILS.includes(email)
}

/** 운영자(관리자 페이지 접근 가능, 관리자 목록과 별도) */
export function isOperator(user) {
  if (!user?.email) return false
  if (OPERATOR_EMAILS.length === 0) return false
  const email = user.email.trim().toLowerCase()
  return OPERATOR_EMAILS.includes(email)
}

/** 관리자 또는 운영자로 등록된 계정 */
export function canAccessAdmin(user) {
  if (!user) return false
  return isAdmin(user) || isOperator(user)
}
