'use strict'

/** IP당 1분(고정 윈도우) 최대 허용 요청 수 */
const WINDOW_MS = 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 60

const RATE_LIMIT_MESSAGE = '잠시 후 다시 시도해주세요'

/** @type {Map<string, { windowStart: number, count: number }>} */
const buckets = new Map()
let pruneTick = 0

/**
 * Netlify Functions `event`에서 클라이언트 IP 추출
 * @param {{ headers?: Record<string, string | undefined> }} event
 */
function getClientIp(event) {
  const h = event.headers || {}
  const xf = h['x-forwarded-for'] || h['X-Forwarded-For']
  if (xf) return String(xf).split(',')[0].trim()
  const real = h['x-real-ip'] || h['X-Real-IP']
  if (real) return String(real).trim()
  const cf = h['cf-connecting-ip'] || h['CF-Connecting-IP']
  if (cf) return String(cf).trim()
  return 'unknown'
}

function pruneStale(now) {
  const cutoff = now - WINDOW_MS * 2
  for (const [key, b] of buckets.entries()) {
    if (b.windowStart < cutoff) buckets.delete(key)
  }
}

/**
 * @param {string} ip
 * @returns {boolean} true = 허용(카운트 소비), false = 거부
 */
function bucketKey(ip, scope) {
  return scope && scope !== 'global' ? `${scope}:${ip}` : ip
}

function consume(ip, scope = 'global', maxRequests = MAX_REQUESTS_PER_WINDOW) {
  const now = Date.now()
  const windowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS
  const key = bucketKey(ip, scope)
  let b = buckets.get(key)
  if (!b || b.windowStart !== windowStart) {
    b = { windowStart, count: 0 }
    buckets.set(key, b)
  }
  if (b.count >= maxRequests) return false
  b.count += 1
  if (++pruneTick % 400 === 0) pruneStale(now)
  return true
}

function default429Headers() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Retry-After': '60',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  }
}

function rateLimitExceededResponse(extraHeaders = {}) {
  const payload = { error: RATE_LIMIT_MESSAGE, message: RATE_LIMIT_MESSAGE }
  return {
    statusCode: 429,
    headers: { ...default429Headers(), ...extraHeaders },
    body: JSON.stringify(payload),
  }
}

/**
 * Netlify Functions 핸들러를 IP 기준 분당 요청 한도로 감쌉니다.
 * OPTIONS는 카운트하지 않습니다(브라우저 CORS 프리플라이트).
 *
 * @param {(event: any, context?: any) => Promise<any>} handler
 * @param {{ headers429?: Record<string, string>; scope?: string; maxRequests?: number }} [options]
 */
function withIpRateLimit(handler, options = {}) {
  const { headers429 = {}, scope = 'global', maxRequests = MAX_REQUESTS_PER_WINDOW } = options
  return async (event, context) => {
    if (event.httpMethod === 'OPTIONS') {
      return handler(event, context)
    }
    const ip = getClientIp(event)
    if (!consume(ip, scope, maxRequests)) {
      return rateLimitExceededResponse(headers429)
    }
    return handler(event, context)
  }
}

module.exports = {
  WINDOW_MS,
  MAX_REQUESTS_PER_WINDOW,
  RATE_LIMIT_MESSAGE,
  getClientIp,
  consume,
  rateLimitExceededResponse,
  withIpRateLimit,
}
