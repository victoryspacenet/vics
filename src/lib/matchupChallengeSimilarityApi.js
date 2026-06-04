/**
 * 도전(B) 콘텐츠 vs 메이커(A) — Netlify 함수에서 OpenAI 멀티모달 유사도 검사
 */
import { supabase } from './supabase'
import { resolveSiteUrl } from './siteApiBase'

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

/**
 * @param {{ matchupId: string, mode: 'create'|'edit', right: { type: string, text?: string|null, url?: string|null, thumb?: string|null } }} params
 * @returns {Promise<{ skipped: boolean, similarity?: number }>}
 */
export async function checkMatchupChallengeSimilarity({ matchupId, mode, right }) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('로그인이 필요해요')
  }

  const failOpen = import.meta.env.VITE_MATCHUP_SIMILARITY_FAIL_OPEN === '1'
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
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ matchupId, mode, right }),
      signal: controller.signal,
    })
  } catch (e) {
    if (failOpen) return { skipped: true }
    const msg =
      e?.name === 'AbortError'
        ? `유사도 검사 시간이 초과됐어요 (${Math.round(timeoutMs / 1000)}초)`
        : (e?.message || '유사도 검사에 연결할 수 없어요')
    throw new Error(msg)
  } finally {
    clearTimeout(timer)
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    if (
      failOpen &&
      (res.status === 404 ||
        res.status === 0 ||
        res.status === 502 ||
        res.status === 503 ||
        res.status === 504 ||
        res.status === 408 ||
        res.status === 429)
    ) {
      return { skipped: true }
    }
    throw new Error(data.error || data.message || '유사도 검사에 실패했어요')
  }

  if (data.ok === false) {
    throw new Error(data.message || data.error || '주제 유사도가 낮아 업로드할 수 없어요')
  }

  return {
    skipped: !!data.skipped,
    similarity: typeof data.similarity === 'number' ? data.similarity : undefined,
  }
}
