/**
 * Firebase Admin — FCM 토픽(공지 브로드캐스트) + 멀티캐스트(지정 유저)
 * 환경변수: FIREBASE_SERVICE_ACCOUNT_JSON (서비스 계정 JSON 전체 문자열)
 */

const admin = require('firebase-admin')

/** 공지 전체 발송용 FCM 토픽 (클라 등록 시 이 토픽에 구독) */
const TOPIC_NOTICES = 'vics_notices_all'

let _inited = false

function initFirebaseAdmin() {
  if (_inited) return
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || ''
  if (!raw.trim()) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set')
  }
  const cred = JSON.parse(raw)
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(cred),
    })
  }
  _inited = true
}

function getMessaging() {
  initFirebaseAdmin()
  return admin.messaging()
}

/**
 * @param {string} token
 */
async function subscribeTokenToNoticesTopic(token) {
  if (!token || typeof token !== 'string') return { ok: false, skipped: 'no_token' }
  const messaging = getMessaging()
  const res = await messaging.subscribeToTopic([token], TOPIC_NOTICES)
  return { ok: true, successCount: res.successCount, failureCount: res.failureCount }
}

/**
 * @param {string} token
 */
async function unsubscribeTokenFromNoticesTopic(token) {
  if (!token || typeof token !== 'string') return { ok: false, skipped: 'no_token' }
  const messaging = getMessaging()
  const res = await messaging.unsubscribeFromTopic([token], TOPIC_NOTICES)
  return { ok: true, successCount: res.successCount, failureCount: res.failureCount }
}

/**
 * @param {{ title: string, body: string, data?: Record<string, string> }} payload
 */
async function sendNoticeToTopic({ title, body, data = {} }) {
  const messaging = getMessaging()
  const dataFlat = {}
  for (const [k, v] of Object.entries(data || {})) {
    dataFlat[String(k)] = v == null ? '' : String(v)
  }
  await messaging.send({
    topic: TOPIC_NOTICES,
    notification: {
      title: String(title || 'VICS').slice(0, 200),
      body: String(body || '').slice(0, 1000),
    },
    data: dataFlat,
    android: { priority: 'high' },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          contentAvailable: true,
        },
      },
    },
  })
  return { ok: true }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string[]} userIds
 * @param {{ title: string, body: string, data?: Record<string, string> }} payload
 */
async function sendMulticastToUserIds(supabaseAdmin, userIds, { title, body, data = {} }) {
  const ids = [...new Set((userIds || []).filter(Boolean))]
  if (!ids.length) return { sent: 0, tokens: 0 }

  const { data: rows, error } = await supabaseAdmin
    .from('push_device_tokens')
    .select('token')
    .in('user_id', ids)

  if (error) throw new Error(error.message)
  const tokens = [...new Set((rows || []).map((r) => r.token).filter(Boolean))]
  if (!tokens.length) return { sent: 0, tokens: 0 }

  const dataFlat = {}
  for (const [k, v] of Object.entries(data || {})) {
    dataFlat[String(k)] = v == null ? '' : String(v)
  }

  const messaging = getMessaging()
  let sent = 0
  const chunkSize = 500
  for (let i = 0; i < tokens.length; i += chunkSize) {
    const chunk = tokens.slice(i, i + chunkSize)
    const res = await messaging.sendEachForMulticast({
      tokens: chunk,
      notification: {
        title: String(title || 'VICS').slice(0, 200),
        body: String(body || '').slice(0, 1000),
      },
      data: dataFlat,
      android: { priority: 'high' },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            contentAvailable: true,
          },
        },
      },
    })
    sent += res.successCount
  }
  return { sent, tokens: tokens.length }
}

function isFcmConfigured() {
  return Boolean((process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim())
}

module.exports = {
  TOPIC_NOTICES,
  isFcmConfigured,
  subscribeTokenToNoticesTopic,
  unsubscribeTokenFromNoticesTopic,
  sendNoticeToTopic,
  sendMulticastToUserIds,
}
