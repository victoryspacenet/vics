/**

 * 신규 가입 시 지급하는 기본 포인트.

 * — DB `grant_signup_bonus` RPC, Welcome UI, Netlify bootstrap, 트리거 SQL과 맞출 것.

 */

import { supabase } from './supabase'



export const SIGNUP_BONUS_POINTS = 100



/**

 * 가입 축하 100P — `signup_bonus_granted_at` 이 없을 때만 DB에서 1회 지급.

 * @param {string} userId

 * @returns {Promise<{ granted: boolean; error?: unknown }>}

 */

export async function grantSignupBonusIfNeeded(userId) {

  if (!userId) return { granted: false }

  try {

    const { data, error } = await supabase.rpc('grant_signup_bonus', {

      p_user_id: userId,

    })

    if (error) {

      console.warn('[signupRewards] grant_signup_bonus', error.message)

      return { granted: false, error }

    }

    return { granted: Boolean(data) }

  } catch (error) {

    console.warn('[signupRewards] grant_signup_bonus', error)

    return { granted: false, error }

  }

}


