/**
 * 시스템 푸시 설정(system_push_settings) + 이메일(Resend) + 외부 메신저 웹훅
 * Netlify 함수에서만 require (SERVICE_ROLE_KEY 사용)
 */

const SETTING_KEY = 'system_push_settings'

const DEFAULT_EVENTS = {
  server_error_5xx: true,
  db_connection_fail: true,
  storage_full: true,
  traffic_spike: true,
  rate_limit_breach: true,
  concurrent_users: false,
  login_fail_burst: true,
  suspicious_query: true,
  new_admin_login: false,
  sla_exceeded: true,
  appeal_submitted: false,
  abuse_detected: true,
}

/** AdminMessengerPage NOTIFY_EVENTS.id ↔ 시스템 푸시 eventId */
const MESSENGER_EVENT_FOR_SYSTEM = {
  appeal_submitted: 'new_appeal',
  sla_exceeded: 'sla_exceeded',
  abuse_detected: 'matchup_report',
}

function mergePushSettings(raw) {
  const events = { ...DEFAULT_EVENTS, ...(raw?.events || {}) }
  return {
    enabled: raw?.enabled !== false,
    channels: {
      inapp: raw?.channels?.inapp !== false,
      email: raw?.channels?.email !== false,
      messenger: raw?.channels?.messenger === true,
    },
    events,
  }
}

function messengerEventAllows(integEvents, systemEventId) {
  const mapped = MESSENGER_EVENT_FOR_SYSTEM[systemEventId] || systemEventId
  if (integEvents[mapped] === false) return false
  if (integEvents[systemEventId] === false) return false
  return true
}

async function loadPushSettings(supabaseAdmin) {
  const { data } = await supabaseAdmin.from('admin_settings').select('value').eq('key', SETTING_KEY).maybeSingle()
  return mergePushSettings(data?.value || {})
}

async function loadMessengerIntegrations(supabaseAdmin) {
  const { data } = await supabaseAdmin.from('admin_settings').select('key, value').like('key', '%_integration')
  const map = {}
  ;(data || []).forEach(({ key, value }) => {
    const id = key.replace('_integration', '')
    map[id] = value
  })
  return map
}

function parseEmailList(raw) {
  if (!raw || typeof raw !== 'string') return []
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
}

async function sendResendEmail({ to, subject, text }) {
  const resendKey = process.env.RESEND_API_KEY || ''
  const resendFrom = process.env.RESEND_FROM || ''
  if (!resendKey || !resendFrom || !to.length) return { skipped: 'resend' }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: resendFrom, to, subject, text }),
  })
  if (!r.ok) {
    const errText = await r.text().catch(() => '')
    console.warn('[systemPush] Resend:', r.status, errText)
    return { ok: false }
  }
  return { ok: true }
}

async function postSlackLikeWebhook(url, text) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  return r.ok
}

async function postDiscordWebhook(url, text) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: text }),
  })
  return r.ok
}

async function postGoogleChatWebhook(url, text) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  return r.ok
}

async function postMessenger(integMap, systemEventId, text) {
  const platforms = [
    { id: 'slack', post: postSlackLikeWebhook },
    { id: 'discord', post: postDiscordWebhook },
    { id: 'googlechat', post: postGoogleChatWebhook },
    { id: 'notion', post: null },
  ]
  for (const p of platforms) {
    const integ = integMap[p.id]
    if (!integ?.enabled || !integ.webhook_url) continue
    const evs = integ.events || {}
    if (!messengerEventAllows(evs, systemEventId)) continue
    if (p.id === 'notion') {
      console.warn('[systemPush] Notion outbound skipped (needs API shape)')
      continue
    }
    try {
      await p.post(integ.webhook_url, text)
    } catch (e) {
      console.warn('[systemPush] messenger', p.id, e?.message || e)
    }
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin - service role
 * @param {{ eventId: string, title: string, body: string, relatedId?: string|null, skipInApp?: boolean, skipEmail?: boolean, skipMessenger?: boolean }} params
 */
async function deliverSystemPush(supabaseAdmin, params) {
  const { eventId, title, body, relatedId = null } = params
  const skipInApp = params.skipInApp === true
  const skipEmail = params.skipEmail === true
  const skipMessenger = params.skipMessenger === true

  const settings = await loadPushSettings(supabaseAdmin)
  if (!settings.enabled) return { ok: true, skipped: 'master_off' }
  if (settings.events[eventId] === false) return { ok: true, skipped: 'event_off' }

  const out = { inapp: false, email: false, messenger: false }

  if (settings.channels.inapp && !skipInApp) {
    const { error } = await supabaseAdmin.from('admin_notifications').insert({
      type: 'system',
      title: title.slice(0, 200),
      body: (body || '').slice(0, 2000),
      related_id: relatedId ? String(relatedId) : null,
      is_read: false,
    })
    if (error) console.warn('[systemPush] inapp insert:', error.message)
    else out.inapp = true
  }

  if (settings.channels.email && !skipEmail) {
    const adminList = parseEmailList(process.env.ADMIN_EMAILS || '')
    const opList = parseEmailList(process.env.OPERATOR_EMAILS || '')
    const uniq = [...new Set([...adminList, ...opList])]
    if (uniq.length) {
      const r = await sendResendEmail({
        to: uniq,
        subject: `[VICS] ${title}`.slice(0, 900),
        text: `${title}\n\n${body || ''}`,
      })
      out.email = !!r.ok
    }
  }

  if (settings.channels.messenger && !skipMessenger) {
    const integMap = await loadMessengerIntegrations(supabaseAdmin)
    const text = `*[VICS 시스템]* ${title}\n${body || ''}`.slice(0, 3500)
    await postMessenger(integMap, eventId, text)
    out.messenger = true
  }

  return { ok: true, out }
}

module.exports = {
  SETTING_KEY,
  mergePushSettings,
  loadPushSettings,
  deliverSystemPush,
  MESSENGER_EVENT_FOR_SYSTEM,
}
