/**
 * POST /.netlify/functions/fcm-register-token
 * Authorization: Bearer <access_token>
 * Body: { token: string, platform: 'android'|'ios'|'web' }
 *
 * Supabase push_device_tokens upsert + FCM 공지 토픽 구독
 */
const { createClient } = require('@supabase/supabase-js')
const { withIpRateLimit } = require('../lib/rateLimitMiddleware.cjs')
const fcm = require('../lib/fcmCore.cjs')

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

exports.handler = withIpRateLimit(async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  if (!fcm.isFcmConfigured()) {
    return { statusCode: 503, body: JSON.stringify({ error: 'FCM not configured', skipped: true }) }
  }

  const authHeader = event.headers.authorization || event.headers.Authorization
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: '로그인이 필요해요' }) }
  }

  let body
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || {}
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: '잘못된 요청이에요' }) }
  }

  const { token: fcmToken, platform } = body
  if (!fcmToken || typeof fcmToken !== 'string' || fcmToken.length < 20) {
    return { statusCode: 400, body: JSON.stringify({ error: '유효한 FCM token이 필요해요' }) }
  }
  const plat = platform === 'ios' || platform === 'android' || platform === 'web' ? platform : 'android'

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return { statusCode: 401, body: JSON.stringify({ error: '로그인이 필요해요' }) }
  }

  if (!serviceRoleKey || !supabaseUrl) {
    return { statusCode: 503, body: JSON.stringify({ error: 'Server misconfigured' }) }
  }

  const svc = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const now = new Date().toISOString()
  const { error: upErr } = await svc.from('push_device_tokens').upsert(
    {
      user_id: user.id,
      token: fcmToken,
      platform: plat,
      updated_at: now,
    },
    { onConflict: 'user_id,token' },
  )

  if (upErr) {
    console.error('[fcm-register-token] upsert:', upErr.message)
    return { statusCode: 500, body: JSON.stringify({ error: '토큰 저장 실패' }) }
  }

  try {
    await fcm.subscribeTokenToNoticesTopic(fcmToken)
  } catch (e) {
    console.warn('[fcm-register-token] subscribe topic:', e?.message || e)
    return { statusCode: 200, body: JSON.stringify({ ok: true, topicSubscribed: false, warning: String(e?.message || e) }) }
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true, topicSubscribed: true }) }
})
