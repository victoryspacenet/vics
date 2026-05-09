/** DB 트리거 `enforce_profile_rejoin_cooldown` 와 동일 문구 (문의 자동응답 등과 맞춤) */
export const REJOIN_COOLDOWN_USER_MESSAGE =
  '탈퇴 후 재가입은 탈퇴 시점으로부터 7일 후 가능합니다.'

export function isRejoinCooldownDbError(err) {
  if (!err) return false
  const parts = [err.message, err.details, err.hint].filter(Boolean).map(String)
  return parts.some((p) => p.includes('REJOIN_COOLDOWN_7D'))
}
