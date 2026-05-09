/**
 * 문의 접수 후 자동 응대 봇 — DB 트리거(`auto_reply_on_inquiry`)와 동일 조건.
 * 트리거가 없거나 실패해도 접수 직후 한 번 보강(멱등: 기존 auto 답변이 있으면 스킵).
 */
import { supabase } from './supabase'

export async function ensureInquiryAutoReplyAfterInsert(inquiryId, category) {
  if (!inquiryId || !category) return { ok: false, skipped: true, reason: 'missing args' }

  const { data: existing } = await supabase
    .from('inquiry_replies')
    .select('id')
    .eq('inquiry_id', inquiryId)
    .eq('reply_type', 'auto')
    .limit(1)
    .maybeSingle()
  if (existing?.id) return { ok: true, skipped: true, reason: 'already has auto' }

  const { data: botRow } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', 'bot_enabled')
    .maybeSingle()
  const enabled = botRow?.value?.enabled
  if (enabled === false) return { ok: true, skipped: true, reason: 'bot disabled' }

  const { data: scenario, error: scErr } = await supabase
    .from('admin_bot_scenarios')
    .select('message')
    .eq('category', category)
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (scErr || !scenario?.message?.trim()) return { ok: true, skipped: true, reason: 'no scenario' }

  const { error: insErr } = await supabase.from('inquiry_replies').insert({
    inquiry_id: inquiryId,
    reply_type: 'auto',
    content: scenario.message.trim(),
    replied_by: 'bot',
  })
  if (insErr) {
    console.warn('[inquiryBotAutoReply] insert:', insErr.message)
    return { ok: false, error: insErr.message }
  }
  return { ok: true, inserted: true }
}
