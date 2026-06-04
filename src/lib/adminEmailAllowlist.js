/**
 * 관리자·운영자 env 이메일 목록 (순환 import 없이 공유)
 */

const ADMIN_EMAILS_RAW = import.meta.env.VITE_ADMIN_EMAILS || ''
const ADMIN_EMAILS = ADMIN_EMAILS_RAW
  ? ADMIN_EMAILS_RAW.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  : []

const OPERATOR_EMAILS_RAW = import.meta.env.VITE_OPERATOR_EMAILS || ''
const OPERATOR_EMAILS = OPERATOR_EMAILS_RAW
  ? OPERATOR_EMAILS_RAW.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  : []

export function isListedSuperAdmin(user) {
  if (!user?.email) return false
  if (ADMIN_EMAILS.length === 0) return false
  const email = user.email.trim().toLowerCase()
  return ADMIN_EMAILS.includes(email)
}

export function isAdmin(user) {
  if (!user?.email) return false
  const email = user.email.trim().toLowerCase()
  return ADMIN_EMAILS.includes(email)
}

export function isOperator(user) {
  if (!user?.email) return false
  if (OPERATOR_EMAILS.length === 0) return false
  const email = user.email.trim().toLowerCase()
  return OPERATOR_EMAILS.includes(email)
}

export function canAccessAdminFromEnv(user) {
  if (!user) return false
  return isListedSuperAdmin(user) || isAdmin(user) || isOperator(user)
}
