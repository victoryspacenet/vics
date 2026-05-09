import { supabase } from './supabase'

/** Point Reward「프로필 공개 권한」가격 (리워드 카드와 동일) */
export const PROFILE_PUBLIC_UNLOCK_COST = 2000

/**
 * V-Card View Full Profile 등: 만료 시각이 있고 아직 지나지 않았을 때만 true
 * @param {object | null | undefined} profile — `fetchProfile` 스냅샷
 */
export function isProfilePublicUnlockActive(profile) {
  const exp = profile?.profile_public_expires_at
  if (!exp) return false
  const t = new Date(exp).getTime()
  if (Number.isNaN(t)) return false
  return t > Date.now()
}

/**
 * 프로필 공개 권한 구매·연장 (`purchase_profile_public_unlock` RPC)
 * @returns {Promise<
 *   | { ok: true; pointsSpent: number; expiresAt: string | null }
 *   | { ok: false; error: string }
 * >}
 */
export async function purchaseProfilePublicUnlockRpc() {
  const { data: raw, error } = await supabase.rpc('purchase_profile_public_unlock')

  if (error) {
    return { ok: false, error: error.message || '구매 요청에 실패했어요' }
  }

  let data = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch {
      return { ok: false, error: '응답이 올바르지 않아요' }
    }
  }

  if (data == null || typeof data !== 'object') {
    return { ok: false, error: '응답이 올바르지 않아요' }
  }

  if (data.ok === false) {
    return { ok: false, error: typeof data.error === 'string' ? data.error : '구매에 실패했어요' }
  }

  return {
    ok: true,
    pointsSpent: Number(data.points_spent ?? PROFILE_PUBLIC_UNLOCK_COST),
    expiresAt: typeof data.expires_at === 'string' ? data.expires_at : data.expires_at ?? null,
  }
}
