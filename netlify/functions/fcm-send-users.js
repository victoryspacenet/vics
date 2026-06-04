/**
 * POST /.netlify/functions/fcm-send-users
 * 지정 유저(들)의 등록된 기기로 FCM 멀티캐스트
 *
 * Authorization: Bearer <access_token>
 * - 관리자: 임의 userIds (최대 50)
 * - 일반: 본인 user_id만 1건 허용
 *
 * Body: { userIds: string[], title: string, body: string, data?: object }
 */
const { createClient } = require('@supabase/supabase-js')
const { withIpRateLimit } = require('../lib/rateLimitMiddleware.cjs')
const fcm = require('../lib/fcmCore.cjs')

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function parseAdminEmails() {
  const raw = process.env.VITE_ADMIN_EMAILS || process.env.ADMIN_EMAILS || ''
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

function isServerAdmin(email) {
  if (!email) return false
  const list = parseAdminEmails()
  if (!list.length) return true
  return list.includes(String(email).trim().toLowerCase())
}

exports.handler = withIpRateLimit(async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  if (!fcm.isFcmConfigured()) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'fcm_not_configured', sent: 0 }) }
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

  const { userIds, title, body: text, data } = body
  if (!Array.isArray(userIds) || !userIds.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'userIds 배열이 필요해요' }) }
  }
  if (!title || typeof title !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'title이 필요해요' }) }
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return { statusCode: 401, body: JSON.stringify({ error: '로그인이 필요해요' }) }
  }

  const admin = isServerAdmin(user.email)
  let targetIds = userIds.map((id) => String(id).trim()).filter(Boolean)

  if (admin) {
    if (targetIds.length > 50) {
      return { statusCode: 400, body: JSON.stringify({ error: 'userIds는 최대 50명까지예요' }) }
    }
  } else {
    if (targetIds.length !== 1 || targetIds[0] !== user.id) {
      return { statusCode: 403, body: JSON.stringify({ error: '본인에게만 발송할 수 있어요' }) }
    }
  }

  if (!serviceRoleKey || !supabaseUrl) {
    return { statusCode: 503, body: JSON.stringify({ error: 'Server misconfigured' }) }
  }

  const svc = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const dataFlat = {}
  if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) {
      dataFlat[String(k)] = v == null ? '' : String(v)
    }
  }

  try {
    const result = await fcm.sendMulticastToUserIds(svc, targetIds, {
      title,
      body: typeof text === 'string' ? text : '',
      data: dataFlat,
    })
    return { statusCode: 200, body: JSON.stringify({ ok: true, ...result }) }
  } catch (e) {
    console.error('[fcm-send-users]', e?.message || e)
    return { statusCode: 500, body: JSON.stringify({ error: 'FCM 발송 실패', detail: String(e?.message || e) }) }
  }
})
