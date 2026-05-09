/**
 * 로그인 실패 반복 알림 — 비로그인 사용자도 호출 가능한 전용 엔드포인트
 * POST /.netlify/functions/login-fail-notify
 * Body: { email?, userAgent? }
 *
 * - 30분 내 동일 이벤트가 이미 존재하면 중복 발송하지 않음
 * - IP 기반 기본 스로틀링 (동일 IP 30분 1회)
 */
const { createClient } = require('@supabase/supabase-js')
const { deliverSystemPush } = require('../lib/systemPushCore.cjs')

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const THROTTLE_MS = 30 * 60 * 1000 // 30분

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return { statusCode: 500, body: JSON.stringify({ error: '서버 설정이 부족해요' }) }
  }

  let body = {}
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || {}
  } catch {
    // 빈 body 허용
  }

  const clientIp =
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers['x-real-ip'] ||
    'unknown'
  const targetEmail = typeof body.email === 'string' ? body.email.slice(0, 200) : ''
  const userAgent = typeof body.userAgent === 'string' ? body.userAgent.slice(0, 300) : ''

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 30분 이내에 이미 login_fail_burst 알림이 발송됐으면 스킵
  const cutoff = new Date(Date.now() - THROTTLE_MS).toISOString()
  const { data: existing } = await supabaseAdmin
    .from('admin_notifications')
    .select('id')
    .eq('type', 'system')
    .ilike('title', '%로그인 실패%')
    .gte('created_at', cutoff)
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, skipped: true, reason: 'throttled' }),
    }
  }

  const bodyText = [
    targetEmail ? `대상 이메일: ${targetEmail}` : null,
    `접속 IP: ${clientIp}`,
    userAgent ? `UA: ${userAgent}` : null,
    '로그인 실패가 5회 이상 반복됐습니다. 무차별 대입 공격일 수 있어요.',
  ]
    .filter(Boolean)
    .join('\n')

  try {
    await deliverSystemPush(supabaseAdmin, {
      eventId: 'login_fail_burst',
      title: '로그인 실패 반복 감지',
      body: bodyText,
      relatedId: null,
    })
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    }
  } catch (e) {
    console.error('[login-fail-notify]', e)
    return { statusCode: 500, body: JSON.stringify({ error: e?.message || 'failed' }) }
  }
}
