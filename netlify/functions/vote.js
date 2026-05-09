/**
 * 투표 API - 동일 IP/기기 무한 투표 방지 (Netlify)
 * 서버에서 클라이언트 IP를 추출해 votes.ip_address에 저장
 */
const { createClient } = require('@supabase/supabase-js')
const { deliverSystemPush } = require('../lib/systemPushCore.cjs')

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

function getClientIp(event) {
  const forwarded = event.headers['x-forwarded-for']
  if (forwarded) return String(forwarded).split(',')[0].trim()
  return event.headers['x-real-ip'] || event.headers['cf-connecting-ip'] || null
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const authHeader = event.headers['authorization'] || event.headers['Authorization']
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

  const { matchup_id, side } = body
  if (!matchup_id || !['left', 'right'].includes(side)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'matchup_id와 side(left/right)가 필요해요' }) }
  }

  const clientIp = getClientIp(event) || 'unknown'

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const maybeDeliver = async (eventId, title, body) => {
    if (!serviceRoleKey || !supabaseUrl) return
    try {
      const svc = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      await deliverSystemPush(svc, { eventId, title, body, relatedId: null })
    } catch (e) {
      console.warn('[vote] system push:', e?.message || e)
    }
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return { statusCode: 401, body: JSON.stringify({ error: '로그인이 필요해요' }) }
  }

  const { error } = await supabase
    .from('votes')
    .insert({ user_id: user.id, matchup_id, side, ip_address: clientIp })

  if (error) {
    if (error.message?.includes('VOTE_IP_LIMIT') || error.code === 'P0001') {
      void maybeDeliver(
        'abuse_detected',
        '투표 한도(동일 IP) 초과',
        `매치업: ${matchup_id}\nIP: ${clientIp}\n유저: ${user.id}`
      )
      return {
        statusCode: 429,
        body: JSON.stringify({
          error: '이 기기/네트워크에서 해당 매치업에 대한 투표 한도를 초과했어요 (최대 3표)',
          code: 'VOTE_IP_LIMIT',
        }),
      }
    }
    if (error.code === '23505') {
      return { statusCode: 409, body: JSON.stringify({ error: '이미 투표했어요' }) }
    }
    console.error('[vote API]', error)
    void maybeDeliver(
      'server_error_5xx',
      '투표 API 오류',
      `code: ${error.code || ''}\nmessage: ${error.message || ''}\nmatchup: ${matchup_id}`
    )
    return { statusCode: 500, body: JSON.stringify({ error: '투표 중 오류가 발생했어요' }) }
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) }
}
