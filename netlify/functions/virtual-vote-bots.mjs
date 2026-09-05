/**
 * 가상 투표 봇 — 10분마다 Supabase RPC `run_virtual_vote_bots` 호출
 * 선행: supabase_virtual_vote_bots.sql + Netlify `SUPABASE_SERVICE_ROLE_KEY`
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export default async (req) => {
  try {
    const raw = await req.text()
    if (raw) {
      try {
        const { next_run: nextRun } = JSON.parse(raw)
        if (nextRun) console.log('[virtual-vote-bots] next_run:', nextRun)
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }

  if (!supabaseUrl || !serviceKey) {
    console.error('[virtual-vote-bots] VITE_SUPABASE_URL/SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 없음')
    return new Response(JSON.stringify({ ok: false, error: 'missing env' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await supabase.rpc('run_virtual_vote_bots')
  if (error) {
    console.error('[virtual-vote-bots] rpc error:', error.message)
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  console.log('[virtual-vote-bots]', data)
  return new Response(JSON.stringify({ ok: true, result: data }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}
