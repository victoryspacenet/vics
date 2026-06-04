'use strict'

const { createClient } = require('@supabase/supabase-js')
const { getClientIp, rateLimitExceededResponse } = require('./rateLimitMiddleware.cjs')

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
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

/**
 * Supabase RPC 분산 rate limit (Netlify 인스턴스 간 공유)
 * @param {{ bucketKey: string, windowSeconds?: number, maxRequests?: number }} opts
 * @returns {Promise<{ allowed: boolean, skipped?: boolean }>}
 */
async function consumeDistributedRateLimit({ bucketKey, windowSeconds = 60, maxRequests = 60 }) {
  const client = getServiceClient()
  if (!client) return { allowed: true, skipped: true }

  try {
    const { data, error } = await client.rpc('consume_api_rate_limit', {
      p_bucket_key: bucketKey,
      p_window_seconds: windowSeconds,
      p_max_requests: maxRequests,
    })
    if (error) {
      console.warn('[rateLimitDistributed]', error.message || error)
      return { allowed: true, skipped: true }
    }
    return { allowed: Boolean(data) }
  } catch (e) {
    console.warn('[rateLimitDistributed]', e?.message || e)
    return { allowed: true, skipped: true }
  }
}

/**
 * @param {(event: any, context?: any) => Promise<any>} handler
 * @param {{ scope?: string, windowSeconds?: number, maxRequests?: number, headers429?: Record<string, string> }} [options]
 */
function withDistributedRateLimit(handler, options = {}) {
  const scope = options.scope || 'api'
  const windowSeconds = options.windowSeconds ?? 60
  const maxRequests = options.maxRequests ?? 60
  const { headers429 = {} } = options

  return async (event, context) => {
    if (event.httpMethod === 'OPTIONS') {
      return handler(event, context)
    }
    const ip = getClientIp(event)
    const bucketKey = `${scope}:${ip}`
    const { allowed } = await consumeDistributedRateLimit({
      bucketKey,
      windowSeconds,
      maxRequests,
    })
    if (!allowed) {
      return rateLimitExceededResponse(headers429)
    }
    return handler(event, context)
  }
}

module.exports = {
  consumeDistributedRateLimit,
  withDistributedRateLimit,
}
