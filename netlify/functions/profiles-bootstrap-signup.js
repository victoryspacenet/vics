/**
 * 이메일 인증만 켜진 가입(signUp 후 session 없음)에서 클라이언트 upsert가 불가할 때
 * profiles 행이 비면 관리자 목록에 안 뜨는 문제를 막기 위한 보조 엔드포인트.
 *
 * POST /.netlify/functions/profiles-bootstrap-signup
 * Body: { userId, email, nickname, birthdate?, gender? }
 * — Service Role로 auth.users 와 이메일 일치를 검증한 뒤 profiles upsert (남용 방지: IP rate limit)
 *
 * 가입 기본 포인트: `src/lib/signupRewards.js` 의 SIGNUP_BONUS_POINTS 와 동일하게 유지
 */
'use strict'

const SIGNUP_BONUS_POINTS = 100

const { createClient } = require('@supabase/supabase-js')
const { withIpRateLimit } = require('../lib/rateLimitMiddleware.cjs')

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
    body: JSON.stringify(body),
  }
}

exports.handler = withIpRateLimit(async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: '서버 설정이 부족해요' })
  }

  let body
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || {}
  } catch {
    return json(400, { error: '잘못된 요청이에요' })
  }

  const { userId, email, nickname, birthdate, gender, signup_taste_answers: tasteRaw } = body
  if (!userId || typeof userId !== 'string') {
    return json(400, { error: 'userId가 필요해요' })
  }
  if (!email || typeof email !== 'string' || !String(email).trim()) {
    return json(400, { error: 'email이 필요해요' })
  }
  if (!nickname || typeof nickname !== 'string' || !String(nickname).trim()) {
    return json(400, { error: 'nickname이 필요해요' })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: guErr } = await admin.auth.admin.getUserById(userId)
  if (guErr || !userData?.user) {
    return json(403, { error: '유효하지 않은 가입 정보예요' })
  }
  const authEmail = String(userData.user.email || '').trim().toLowerCase()
  if (authEmail !== String(email).trim().toLowerCase()) {
    return json(403, { error: '이메일이 일치하지 않아요' })
  }

  const nick = String(nickname).trim().slice(0, 10)
  const bd = typeof birthdate === 'string' && birthdate ? birthdate.trim() : null
  const gen =
    gender === 'male' || gender === 'female' || gender === 'other' ? gender : null

  const row = {
    id: userId,
    email: String(email).trim(),
    nickname: nick,
    birthdate: bd,
    gender: gen,
    points: SIGNUP_BONUS_POINTS,
    updated_at: new Date().toISOString(),
  }

  if (
    tasteRaw &&
    typeof tasteRaw === 'object' &&
    !Array.isArray(tasteRaw) &&
    ['personality_type', 'matchup_role', 'interest_topic'].every((k) => typeof tasteRaw[k] === 'string')
  ) {
    row.signup_taste_answers = tasteRaw
  }

  const { error: upErr } = await admin.from('profiles').upsert(row, { onConflict: 'id' })

  if (!upErr) {
    const { error: grantErr } = await admin.rpc('grant_signup_bonus', { p_user_id: userId })
    if (grantErr) {
      console.warn('[profiles-bootstrap-signup] grant_signup_bonus', grantErr.message || grantErr)
    }
  }

  if (upErr) {
    console.error('[profiles-bootstrap-signup]', upErr)
    const msg = String(upErr.message || '')
    if (String(upErr.code) === '23505' || msg.includes('unique') || msg.includes('duplicate')) {
      return json(409, { error: '닉네임이 이미 사용 중이에요' })
    }
    return json(500, { error: '프로필 저장에 실패했어요' })
  }

  // profiles.nickname 과 가입 폼이 항상 같도록 auth.user_metadata 도 맞춤 (중복 확인·표시 정합)
  try {
    const u = userData.user
    const um = { ...(u.user_metadata || {}) }
    um.nickname = nick
    if (bd) um.birthdate = bd
    if (gen) um.gender = gen
    if (row.signup_taste_answers) um.signup_taste_answers = row.signup_taste_answers
    const { error: metaErr } = await admin.auth.admin.updateUserById(userId, { user_metadata: um })
    if (metaErr) console.warn('[profiles-bootstrap-signup] updateUserById', metaErr.message || metaErr)
  } catch (e) {
    console.warn('[profiles-bootstrap-signup] updateUserById', e?.message || e)
  }

  return json(200, { ok: true })
})
