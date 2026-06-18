/**
 * 투표 API - 동일 IP/기기 무한 투표 방지 (Netlify)
 * 서버에서 클라이언트 IP를 추출해 votes.ip_address에 저장
 */
const { createClient } = require('@supabase/supabase-js')
const { deliverSystemPush } = require('../lib/systemPushCore.cjs')
const { withIpRateLimit } = require('../lib/rateLimitMiddleware.cjs')
const { withDistributedRateLimit } = require('../lib/rateLimitDistributed.cjs')
const fcm = require('../lib/fcmCore.cjs')

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

let serviceClient = null

function getServiceClient() {
  if (!serviceRoleKey || !supabaseUrl) return null
  if (!serviceClient) {
    serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return serviceClient
}

function getClientIp(event) {
  const forwarded = event.headers['x-forwarded-for']
  if (forwarded) return String(forwarded).split(',')[0].trim()
  return event.headers['x-real-ip'] || event.headers['cf-connecting-ip'] || null
}

/** FCM 제외용 — cast_vote 성공 시 getUser 왕복 생략 */
function userIdFromAccessToken(token) {
  try {
    const payload = String(token || '').split('.')[1]
    if (!payload) return null
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'))
    return json.sub || null
  } catch {
    return null
  }
}

function scheduleBackground(work, context) {
  const waitUntil =
    (context && typeof context.waitUntil === 'function' && context.waitUntil.bind(context)) ||
    (typeof globalThis.Netlify?.context?.waitUntil === 'function' &&
      globalThis.Netlify.context.waitUntil.bind(globalThis.Netlify.context)) ||
    null
  if (waitUntil) {
    waitUntil(work)
  } else {
    void work.catch((e) => console.warn('[vote] background task:', e?.message || e))
  }
}

function mapVoteError(error) {
  const msg = error?.message || ''
  const code = error?.code || ''
  if (msg.includes('VOTE_IP_LIMIT') || code === 'P0001') {
    return {
      statusCode: 429,
      body: JSON.stringify({
        error: '이 기기/네트워크에서 해당 매치업에 대한 투표 한도를 초과했어요 (최대 3표)',
        code: 'VOTE_IP_LIMIT',
      }),
    }
  }
  if (code === '23505') {
    return { statusCode: 409, body: JSON.stringify({ error: '이미 투표했어요' }) }
  }
  if (code === '42501' || msg.includes('로그인이 필요')) {
    return { statusCode: 401, body: JSON.stringify({ error: '로그인이 필요해요' }) }
  }
  return null
}

async function notifyVoteError(eventId, title, body) {
  const svc = getServiceClient()
  if (!svc) return
  try {
    await deliverSystemPush(svc, { eventId, title, body, relatedId: null })
  } catch (e) {
    console.warn('[vote] system push:', e?.message || e)
  }
}

async function runFcmAfterVote(matchupId, voterUserId) {
  if (!fcm.isFcmConfigured() || !serviceRoleKey) return
  const svc = getServiceClient()
  if (!svc) return
  try {
    const { data: mu } = await svc
      .from('matchups')
      .select('user_id, right_user_id')
      .eq('id', matchupId)
      .maybeSingle()
    const targets = []
    if (mu?.user_id && mu.user_id !== voterUserId) targets.push(mu.user_id)
    if (mu?.right_user_id && mu.right_user_id !== voterUserId) targets.push(mu.right_user_id)
    if (targets.length) {
      await fcm.sendMulticastToUserIds(svc, targets, {
        title: '새 투표',
        body: '회원님의 매치업에 새 투표가 들어왔어요.',
        data: {
          type: 'vote',
          route: `/matchup/${matchupId}`,
          matchup_id: String(matchupId),
        },
      })
    }
  } catch (e) {
    console.warn('[vote] fcm notify participants:', e?.message || e)
  }
}

/**
 * cast_vote RPC 우선 — JWT 검증+INSERT 1왕복. 미배포 시 getUser+insert 폴백.
 */
async function castVoteWithUserToken(supabase, { matchupId, side, clientIp, token }) {
  const { error: rpcError } = await supabase.rpc('cast_vote', {
    p_matchup_id: matchupId,
    p_side: side,
    p_ip_address: clientIp,
  })

  if (!rpcError) {
    return { ok: true, userId: userIdFromAccessToken(token) }
  }

  const rpcMissing =
    rpcError.code === 'PGRST202' ||
    rpcError.code === '42883' ||
    /cast_vote/i.test(rpcError.message || '') ||
    /function.*does not exist/i.test(rpcError.message || '')

  if (!rpcMissing) {
    return { ok: false, error: rpcError }
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return { ok: false, error: authError || { message: '로그인이 필요해요', code: '42501' } }
  }

  const { error: insertError } = await supabase
    .from('votes')
    .insert({ user_id: user.id, matchup_id: matchupId, side, ip_address: clientIp })

  if (insertError) {
    return { ok: false, error: insertError, userId: user.id }
  }
  return { ok: true, userId: user.id }
}

/**
 * FCM 알림은 투표 응답을 막지 않도록 `context.waitUntil`로 연장 실행합니다.
 */
const voteHandler = async (event, context) => {
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

  const result = await castVoteWithUserToken(supabase, {
    matchupId: matchup_id,
    side,
    clientIp,
    token,
  })

  if (!result.ok) {
    const mapped = mapVoteError(result.error)
    if (mapped) {
      if (mapped.statusCode === 429) {
        scheduleBackground(
          notifyVoteError(
            'abuse_detected',
            '투표 한도(동일 IP) 초과',
            `매치업: ${matchup_id}\nIP: ${clientIp}\n유저: ${result.userId || 'unknown'}`,
          ),
          context,
        )
      }
      return mapped
    }
    console.error('[vote API]', result.error)
    scheduleBackground(
      notifyVoteError(
        'server_error_5xx',
        '투표 API 오류',
        `code: ${result.error?.code || ''}\nmessage: ${result.error?.message || ''}\nmatchup: ${matchup_id}`,
      ),
      context,
    )
    return { statusCode: 500, body: JSON.stringify({ error: '투표 중 오류가 발생했어요' }) }
  }

  scheduleBackground(runFcmAfterVote(matchup_id, result.userId), context)

  return { statusCode: 200, body: JSON.stringify({ ok: true }) }
}

exports.handler = withIpRateLimit(
  withDistributedRateLimit(voteHandler, { scope: 'vote', maxRequests: 90, windowSeconds: 60 }),
  { scope: 'vote', maxRequests: 120 },
)
