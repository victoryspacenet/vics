/**
 * 도전(B) 콘텐츠 vs 메이커(A) — Netlify 함수에서 OpenAI 멀티모달 유사도 검사
 *
 * 인프라 오류(502/503/504/408/타임아웃/네트워크)는 콘텐츠 문제가 아니므로 skip 처리.
 * ok:false 만 진짜 유사도 거부.
 */
import { supabase } from './supabase'
import { resolveSiteUrl } from './siteApiBase'

const SESSION_TIMEOUT_MS = 10_000

function apiUrl() {
  const base = import.meta.env.VITE_MATCHUP_CHALLENGE_SIMILARITY_URL
  if (base && String(base).trim()) return String(base).trim().replace(/\/$/, '')
  return resolveSiteUrl('/api/matchup-challenge-similarity')
}

function parseTimeoutMs() {
  const raw = import.meta.env.VITE_MATCHUP_SIMILARITY_TIMEOUT_MS
  const n = raw != null && String(raw).trim() !== '' ? parseInt(String(raw), 10) : 28000
  if (!Number.isFinite(n) || n < 3000) return 28000
  return Math.min(120000, n)
}

function isInfraError(status) {
  return (
    !status ||
    status === 0 ||
    status === 404 ||
    status === 408 ||
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504
  )
}

/**
 * @param {{ matchupId: string, mode: 'create'|'edit', right: { type: string, text?: string|null, url?: string|null, thumb?: string|null } }} params
 * @returns {Promise<{ skipped: boolean, similarity?: number }>}
 */
export async function checkMatchupChallengeSimilarity({ matchupId, mode, right }) {
  // 세션 획득 (타임아웃 적용 — auth 락 경합 시 무한 대기 방지)
  let tok = null
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error('session_timeout')), SESSION_TIMEOUT_MS)
      ),
    ])
    tok = result?.data?.session?.access_token ?? null
  } catch {
    tok = null
  }

  if (!tok) {
    throw new Error('로그인이 필요해요')
  }

  // 프로덕션에서도 VITE_MATCHUP_SIMILARITY_FAIL_OPEN=1 을 넣지 않으면
  // OpenAI 오류 시 업로드가 막히므로, 인프라 오류는 항상 skip 처리.
  // ok:false(유사도 거부)만 실제 에러로 전파.
  const explicitFailOpen = import.meta.env.VITE_MATCHUP_SIMILARITY_FAIL_OPEN === '1'

  const url = apiUrl()
  const timeoutMs = parseTimeoutMs()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tok}`,
      },
      body: JSON.stringify({ matchupId, mode, right }),
      signal: controller.signal,
    })
  } catch (e) {
    // 네트워크 오류·타임아웃 = 인프라 문제이므로 콘텐츠 업로드는 허용(skip)
    if (explicitFailOpen || e?.name === 'AbortError' || !e?.message?.includes('로그인')) {
      console.warn('[similarity] fetch error, skipping check:', e?.message)
      return { skipped: true }
    }
    throw new Error(e?.message || '유사도 검사에 연결할 수 없어요')
  } finally {
    clearTimeout(timer)
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    // 인프라 오류(함수 없음·서버 오류·속도제한 등) — 콘텐츠 문제가 아니므로 skip
    if (isInfraError(res.status)) {
      console.warn('[similarity] infra error', res.status, data.error)
      return { skipped: true }
    }
    // 400/401/403 = 요청 오류이므로 에러 전파
    if (res.status === 401) throw new Error('로그인이 필요해요')
    if (res.status === 403) throw new Error(data.error || '도전 권한이 없어요')
    throw new Error(data.error || data.message || '유사도 검사에 실패했어요')
  }

  // ok:false = 유사도 거부 (콘텐츠 문제)
  if (data.ok === false) {
    throw new Error(data.message || data.error || '주제 유사도가 낮아 업로드할 수 없어요')
  }

  return {
    skipped: !!data.skipped,
    similarity: typeof data.similarity === 'number' ? data.similarity : undefined,
  }
}
