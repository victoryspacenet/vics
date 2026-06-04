/**
 * 1:1 문의 수동 답변 발송 시, 수신자 이메일로 안내 (Resend)
 * Netlify 환경변수: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
 *   RESEND_API_KEY, RESEND_FROM, ADMIN_EMAILS(쉼표, VITE와 동일 권장), OPERATOR_EMAILS(선택)
 */
const { createClient } = require('@supabase/supabase-js')
const { withIpRateLimit } = require('../lib/rateLimitMiddleware.cjs')

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function parseEmailList(raw) {
  if (!raw || typeof raw !== 'string') return []
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

exports.handler = withIpRateLimit(async (event) => {
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

  const { userId, receiptId, inquiryTitle, replyText } = body
  if (!userId || typeof userId !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'userId가 필요해요' }) }
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Supabase 환경변수가 없어요' }) }
  }

  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: authData, error: authError } = await supabaseUser.auth.getUser(token)
  if (authError || !authData?.user?.email) {
    return { statusCode: 401, body: JSON.stringify({ error: '로그인이 필요해요' }) }
  }

  const senderEmail = authData.user.email.trim().toLowerCase()
  const adminList = parseEmailList(process.env.ADMIN_EMAILS || '')
  const operatorList = parseEmailList(process.env.OPERATOR_EMAILS || '')
  const allowed = [...adminList, ...operatorList]
  if (allowed.length > 0 && !allowed.includes(senderEmail)) {
    return { statusCode: 403, body: JSON.stringify({ error: '문의 답변 메일 발송 권한이 없어요' }) }
  }

  const resendKey = process.env.RESEND_API_KEY || ''
  const resendFrom = process.env.RESEND_FROM || ''
  if (!resendKey || !resendFrom) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailSent: false, skipped: 'resend_not_configured' }),
    }
  }

  if (!serviceRoleKey) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailSent: false, skipped: 'service_role_missing' }),
    }
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: targetUser, error: adminErr } = await supabaseAdmin.auth.admin.getUserById(userId)
  if (adminErr || !targetUser?.user?.email) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailSent: false, skipped: 'recipient_email_unavailable' }),
    }
  }

  const to = targetUser.user.email
  const subject = `[VICTORYSPACE] 문의 ${receiptId ? `#${receiptId}` : '답변'} 안내`
  const safeTitle = escapeHtml(inquiryTitle)
  const safeReply = escapeHtml(replyText).replace(/\n/g, '<br/>')
  const html = `<p>안녕하세요, VICTORYSPACE입니다.</p>
<p>접수하신 문의에 답변이 등록되었습니다.</p>
<p><strong>${safeTitle || '문의'}</strong></p>
<hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
<div style="font-size:14px;line-height:1.6;color:#333">${safeReply || ''}</div>
<p style="margin-top:24px;font-size:12px;color:#888">앱의 <strong>문의 &gt; 내역</strong>에서도 동일한 내용을 확인하실 수 있습니다.</p>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [to],
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('[inquiry-reply-email] Resend:', res.status, errText)
    return {
      statusCode: 502,
      body: JSON.stringify({ error: '이메일 발송에 실패했어요', detail: errText.slice(0, 200) }),
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailSent: true }),
  }
})
