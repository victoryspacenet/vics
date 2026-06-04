/**
 * POST /.netlify/functions/fcm-notice-broadcast
 * 공지 게시 후: FCM 토픽으로 전체 앱 사용자에게 알림 (인앱 RPC와 별개)
 *
 * Authorization: Bearer <access_token> — 관리자(이메일 화이트리스트)만 허용
 * Body: { title: string, body: string, noticeId?: string }
 */
const { createClient } = require('@supabase/supabase-js')
const { withIpRateLimit } = require('../lib/rateLimitMiddleware.cjs')
const fcm = require('../lib/fcmCore.cjs')

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

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
    return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'fcm_not_configured' }) }
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

  const { title, body: text, noticeId } = body
  if (!title || typeof title !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'title이 필요해요' }) }
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user?.email) {
    return { statusCode: 401, body: JSON.stringify({ error: '로그인이 필요해요' }) }
  }

  if (!isServerAdmin(user.email)) {
    return { statusCode: 403, body: JSON.stringify({ error: '관리자만 발송할 수 있어요' }) }
  }

  try {
    await fcm.sendNoticeToTopic({
      title,
      body: typeof text === 'string' ? text : '',
      data: {
        type: 'notice',
        route: '/notice',
        ...(noticeId ? { noticeId: String(noticeId) } : {}),
      },
    })
    return { statusCode: 200, body: JSON.stringify({ ok: true }) }
  } catch (e) {
    console.error('[fcm-notice-broadcast]', e?.message || e)
    return { statusCode: 500, body: JSON.stringify({ error: 'FCM 발송 실패', detail: String(e?.message || e) }) }
  }
})
