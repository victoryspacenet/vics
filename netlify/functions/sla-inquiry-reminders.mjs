/**
 * 설정 센터 SLA(시간) 초과 시 미처리 문의 → admin_notifications 리마인드
 * Supabase RPC `check_sla_and_notify` 실행 후, 시스템 푸시 설정에 따라 이메일·메신저 전달
 * DB 접속 자체가 실패(db_connection_fail)하면 Resend 이메일로 직접 알림
 */
import { createClient } from '@supabase/supabase-js'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { deliverSystemPush } = require('../lib/systemPushCore.cjs')

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

/** DB 없이 Resend로 직접 긴급 이메일 발송 (db_connection_fail 전용) */
async function sendDbFailEmail(errMsg) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM || 'noreply@victoryspace.com'
  const toRaw = process.env.ADMIN_EMAILS || process.env.OPERATOR_EMAILS || ''
  const to = toRaw.split(',').map((s) => s.trim()).filter(Boolean)
  if (!apiKey || !to.length) return

  const now = new Date().toISOString()
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: '[VICS] DB 연결 실패 경보',
        text: `[${now}] Supabase DB에 접속할 수 없습니다.\n\n오류: ${errMsg}\n\nSupabase 대시보드 또는 Status 페이지를 확인하세요.\nhttps://status.supabase.com`,
      }),
    })
    console.log('[sla-inquiry-reminders] db_connection_fail 이메일 발송 완료')
  } catch (e) {
    console.error('[sla-inquiry-reminders] 긴급 이메일 실패:', e?.message)
  }
}

export default async (req) => {
  try {
    const raw = await req.text()
    if (raw) {
      try {
        const { next_run: nextRun } = JSON.parse(raw)
        if (nextRun) console.log('[sla-inquiry-reminders] next_run:', nextRun)
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }

  if (!supabaseUrl || !serviceKey) {
    console.error('[sla-inquiry-reminders] VITE_SUPABASE_URL/SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 없음')
    return new Response(JSON.stringify({ ok: false, error: 'missing env' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const t0 = new Date().toISOString()

  const { error } = await supabase.rpc('check_sla_and_notify')
  if (error) {
    console.error('[sla-inquiry-reminders] rpc error:', error.message)

    // 네트워크/접속 오류일 경우 DB 없이 이메일로 직접 알림
    const isConnErr =
      error.message?.toLowerCase().includes('fetch') ||
      error.message?.toLowerCase().includes('econnrefused') ||
      error.message?.toLowerCase().includes('network') ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'PGRST301'
    if (isConnErr) {
      await sendDbFailEmail(error.message)
      // DB가 살아있으면 시스템 푸시도 시도 (이미 실패했으므로 무시)
      try {
        await deliverSystemPush(supabase, {
          eventId: 'db_connection_fail',
          title: 'DB 연결 실패',
          body: `Supabase RPC 호출 실패: ${error.message}`,
          relatedId: null,
        })
      } catch { /* DB 다운이면 당연히 실패 */ }
    }

    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  try {
    const { data: slaRows } = await supabase
      .from('admin_notifications')
      .select('id,title,body,related_id')
      .eq('type', 'sla')
      .gte('created_at', t0)

    if (slaRows?.length) {
      const title = `SLA 초과 미처리 문의 ${slaRows.length}건`
      const body = slaRows.map((r) => (r.body || r.title || '').trim()).filter(Boolean).join('\n')
      await deliverSystemPush(supabase, {
        eventId: 'sla_exceeded',
        title,
        body: body || title,
        relatedId: null,
        skipInApp: true,
      })
    }
  } catch (e) {
    console.warn('[sla-inquiry-reminders] system push:', e?.message || e)
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}
