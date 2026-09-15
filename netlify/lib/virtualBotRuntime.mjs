import { createClient } from '@supabase/supabase-js'

export function createVirtualBotClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!supabaseUrl || !serviceKey) {
    return { supabaseUrl, serviceKey, supabase: null }
  }
  return {
    supabaseUrl,
    serviceKey,
    supabase: createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  }
}

export function isMissingRpc(error) {
  const code = error?.code || ''
  const msg = error?.message || ''
  return code === 'PGRST202' || /could not find the function/i.test(msg) || /does not exist/i.test(msg)
}

export async function callRpc(supabase, name, args) {
  const { data, error } = args ? await supabase.rpc(name, args) : await supabase.rpc(name)
  if (error) {
    if (isMissingRpc(error)) {
      console.warn(`[virtual-bots] ${name} 미배포, 건너뜀:`, error.message)
      return { skipped: 'rpc_missing', error: error.message }
    }
    throw error
  }
  return data
}

export async function readSchedulePayload(req) {
  try {
    const raw = await req.text()
    if (!raw) return
    try {
      const { next_run: nextRun } = JSON.parse(raw)
      if (nextRun) console.log('[virtual-bots] next_run:', nextRun)
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
