/**
 * 시스템 푸시 — 클라이언트(로그인 사용자)에서 제한된 이벤트만 전달
 * POST /.netlify/functions/system-push-dispatch
 * Authorization: Bearer <Supabase access_token>
 * Body: { eventId, title, body, relatedId? }
 *
 * 허용 eventId: rate_limit_breach, login_fail_burst, new_admin_login, appeal_submitted, suspicious_query
 */
const { createClient } = require('@supabase/supabase-js')
const { deliverSystemPush } = require('../lib/systemPushCore.cjs')

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const CLIENT_ALLOWED = new Set([
  'rate_limit_breach',
  'login_fail_burst',
  'new_admin_login',
  'appeal_submitted',
  'suspicious_query',
])

function parseEmailList(raw) {
  if (!raw || typeof raw !== 'string') return []
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
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

  const { eventId, title, body: text, relatedId } = body
  if (!eventId || typeof eventId !== 'string' || !CLIENT_ALLOWED.has(eventId)) {
    return { statusCode: 403, body: JSON.stringify({ error: '허용되지 않은 이벤트예요' }) }
  }
  if (!title || typeof title !== 'string' || !text || typeof text !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'title, body가 필요해요' }) }
  }

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return { statusCode: 500, body: JSON.stringify({ error: '서버 설정이 부족해요' }) }
  }

  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: authData, error: authError } = await supabaseUser.auth.getUser(token)
  if (authError || !authData?.user?.email) {
    return { statusCode: 401, body: JSON.stringify({ error: '로그인이 필요해요' }) }
  }

  const email = authData.user.email.trim().toLowerCase()
  if (eventId === 'new_admin_login') {
    const allowed = [...parseEmailList(process.env.ADMIN_EMAILS || ''), ...parseEmailList(process.env.OPERATOR_EMAILS || '')]
    if (allowed.length > 0 && !allowed.includes(email)) {
      return { statusCode: 403, body: JSON.stringify({ error: '관리자 계정만 전송할 수 있어요' }) }
    }
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const result = await deliverSystemPush(supabaseAdmin, {
      eventId,
      title: String(title).slice(0, 200),
      body: String(text).slice(0, 4000),
      relatedId: relatedId != null ? String(relatedId) : null,
    })
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    }
  } catch (e) {
    console.error('[system-push-dispatch]', e)
    return { statusCode: 500, body: JSON.stringify({ error: e?.message || 'dispatch failed' }) }
  }
}
