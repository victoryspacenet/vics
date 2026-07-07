/**
 * 매치업 작성자(A) 콘텐츠 vs 선택한 카테고리 — Netlify 함수에서 OpenAI 멀티모달 유사도 검사
 *
 * 인프라 오류(502/503/504/408/타임아웃/네트워크)는 콘텐츠 문제가 아니므로 skip 처리.
 * ok:false 만 진짜 유사도 거부.
 */
import { supabase } from './supabase'
import { resolveSiteUrl } from './siteApiBase'

const SESSION_TIMEOUT_MS = 10_000

function apiUrl() {
  const base = import.meta.env.VITE_MATCHUP_CATEGORY_SIMILARITY_URL
  if (base && String(base).trim()) return String(base).trim().replace(/\/$/, '')
  return resolveSiteUrl('/api/matchup-category-similarity')
}

function parseTimeoutMs() {
  const raw = import.meta.env.VITE_MATCHUP_CATEGORY_SIMILARITY_TIMEOUT_MS
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

function shouldAllowSimilaritySkip() {
  return import.meta.env.VITE_MATCHUP_CATEGORY_SIMILARITY_FAIL_OPEN === '1'
}

function rejectSkippedCheck(reason) {
  if (shouldAllowSimilaritySkip()) {
    console.warn('[categorySimilarity] check skipped (fail-open):', reason)
    return { skipped: true }
  }
  throw new Error('카테고리·콘텐츠 유사도 검사를 완료하지 못했어요. 잠시 후 다시 시도해 주세요.')
}

/**
 * @param {{
 *   matchupId?: string|null,
 *   title?: string|null,
 *   description?: string|null,
 *   category?: string|null,
 *   categoryLabel?: string|null,
 *   left: { type: string, text?: string|null, url?: string|null, thumb?: string|null }
 * }} params
 * @returns {Promise<{ skipped: boolean, similarity?: number }>}
 */
export async function checkMatchupCategorySimilarity({
  matchupId = null,
  title,
  description,
  category,
  categoryLabel,
  left,
}) {
  // 세션 획득 (타임아웃 적용 — auth 락 경합 시 무한 대기 방지)
  let tok = null
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('session_timeout')), SESSION_TIMEOUT_MS)),
    ])
    tok = result?.data?.session?.access_token ?? null
  } catch {
    tok = null
  }

  if (!tok) {
    throw new Error('로그인이 필요해요')
  }

  // 인프라 오류는 기본 차단. VITE_MATCHUP_CATEGORY_SIMILARITY_FAIL_OPEN=1 일 때만 로컬/QA용 생략.
  const explicitFailOpen = shouldAllowSimilaritySkip()

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
      body: JSON.stringify({
        matchupId: matchupId || null,
        title: title || null,
        description: description || null,
        category: category || null,
        categoryLabel: categoryLabel || null,
        left,
      }),
      signal: controller.signal,
    })
  } catch (e) {
    if (explicitFailOpen || e?.name === 'AbortError') {
      return rejectSkippedCheck(e?.message || 'network')
    }
    throw new Error(e?.message || '유사도 검사에 연결할 수 없어요')
  } finally {
    clearTimeout(timer)
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    if (isInfraError(res.status)) {
      return rejectSkippedCheck(data.error || `http_${res.status}`)
    }
    if (res.status === 401) throw new Error('로그인이 필요해요')
    throw new Error(data.error || data.message || '유사도 검사에 실패했어요')
  }

  // ok:false = 유사도 거부 (콘텐츠 문제)
  if (data.ok === false) {
    throw new Error(data.message || data.error || '카테고리와 콘텐츠 주제가 맞지 않아 업로드할 수 없어요')
  }

  if (data.skipped) {
    return rejectSkippedCheck(data.reason || 'server_skipped')
  }

  return {
    skipped: false,
    similarity: typeof data.similarity === 'number' ? data.similarity : undefined,
  }
}
