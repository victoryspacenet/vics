/**
 * XSS 방지 - 유저 입력값 Sanitizing
 * DOMPurify, URL 허용 목록, encodeURIComponent 적용
 */
import DOMPurify from 'dompurify'
import { resolveSiteUrl } from './siteApiBase'

// ── 1. HTML Sanitizing (DOMPurify) ────────────────────────────────────────

/** 모든 HTML 태그 제거, 텍스트만 반환 (기본) */
export function sanitizeText(html) {
  if (html == null || typeof html !== 'string') return ''
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
}

/** 제한된 HTML만 허용 (br, strong, em - 줄바꿈·강조용) */
export function sanitizeHtml(html) {
  if (html == null || typeof html !== 'string') return ''
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['br', 'strong', 'em', 'b', 'i'],
    ALLOWED_ATTR: [],
  })
}

// ── 2. URL 허용 목록 검사 ──────────────────────────────────────────────────

const ALLOWED_URL_PREFIXES = [
  'https://',
  'http://localhost',
  'http://127.0.0.1',
  'blob:', // 앱 내 createObjectURL로 생성된 썸네일 등
]

const ALLOWED_DOMAINS = [
  'supabase.co',
  'supabase.in',
  'api.dicebear.com',
  'cdn.jsdelivr.net',
  'googleusercontent.com',
  'kakaocdn.net',
  'kakao.com',
  'lh3.googleusercontent.com',
  'avatars.githubusercontent.com',
  'platform-lookaside.fbsbx.com',
  'pimg.kakao.net',
  'dn-img.kakao.com',
  /** 카카오·네이버 계열 CDN (프로필 사진 등) */
  'pstatic.net',
  'daumcdn.net',
]

function parseUrl(url) {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

/** VITE_SUPABASE_URL 호스트 (스토리지 공개 URL이 프로젝트 전용 도메인일 때 허용) */
function isConfiguredSupabaseHost(host) {
  const raw = import.meta.env.VITE_SUPABASE_URL
  if (!raw || typeof raw !== 'string') return false
  try {
    const h = new URL(raw.trim()).hostname.toLowerCase()
    return host === h || host.endsWith('.' + h)
  } catch {
    return false
  }
}

function isAllowedDomain(urlObj) {
  const host = urlObj.hostname.toLowerCase()
  if (ALLOWED_DOMAINS.some((d) => host === d || host.endsWith('.' + d))) return true
  return isConfiguredSupabaseHost(host)
}

/**
 * img/src 등에 사용할 URL 검증. 허용 목록 외는 null 반환
 * @param {string} url
 * @param {string} fallback - 검증 실패 시 반환할 값 (기본: 빈 문자열)
 * @returns {string}
 */
export function safeMediaUrl(url, fallback = '') {
  if (!url || typeof url !== 'string') return fallback
  let trimmed = url.trim()
  if (!trimmed) return fallback

  // 동일 출처 정적 자산 (Vite public/ → /images/...). 프로토콜 상대 URL(//evil.com)은 제외
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed
  }

  // blob: URL (앱 내 createObjectURL) 허용
  if (trimmed.toLowerCase().startsWith('blob:')) return trimmed

  // 프로토콜 상대 //host/... (일부 OAuth·카카오 메타데이터) → https 로 고정
  if (trimmed.startsWith('//')) {
    trimmed = `https:${trimmed}`
  }

  // data: / javascript: 는 아래에서 프로토콜 검사로 차단
  const urlObj = parseUrl(trimmed)
  if (!urlObj) return fallback

  // localhost는 개발용 허용 (http 포함)
  if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
    const okLocal = ALLOWED_URL_PREFIXES.some((p) => trimmed.startsWith(p))
    return okLocal ? trimmed : fallback
  }

  // 카카오 등이 http 로 주는 프로필 이미지 → 허용 도메인이면 https 로 승격
  if (urlObj.protocol === 'http:' && isAllowedDomain(urlObj)) {
    const u = new URL(trimmed)
    u.protocol = 'https:'
    trimmed = u.href
  }

  const urlObjHttps = parseUrl(trimmed)
  if (!urlObjHttps) return fallback

  if (urlObjHttps.protocol !== 'https:') return fallback

  if (trimmed.toLowerCase().startsWith('data:')) return fallback
  if (trimmed.toLowerCase().startsWith('javascript:')) return fallback

  if (!isAllowedDomain(urlObjHttps)) return fallback

  return trimmed
}

/** 갤러리·캔버스 저장 썸네일(data:image/* base64) — 외부 URL은 safeMediaUrl 사용 */
const INLINE_IMAGE_DATA_RE = /^data:image\/(png|jpeg|jpg|webp);base64,/i
const MAX_INLINE_IMAGE_DATA_LEN = 600_000

export function safeInlineImageUrl(url, fallback = '') {
  if (!url || typeof url !== 'string') return fallback
  const trimmed = url.trim()
  if (!INLINE_IMAGE_DATA_RE.test(trimmed)) return fallback
  if (trimmed.length > MAX_INLINE_IMAGE_DATA_LEN) return fallback
  return trimmed
}

/** HTTPS·blob·동일출처 또는 갤러리용 data:image 썸네일 */
export function resolveGalleryCardImageUrl(url, fallback = '') {
  const remote = safeMediaUrl(url, '')
  if (remote) return remote
  return safeInlineImageUrl(url, fallback)
}

// ── 3. 금칙어 에러 파싱 ────────────────────────────────────────────────────

/**
 * Supabase DB 트리거가 반환하는 금칙어 에러인지 확인합니다.
 * 트리거 RAISE EXCEPTION 메시지 형식: "금칙어가 포함되어 있습니다: <단어>"
 * @param {object|null} error  Supabase 에러 객체
 * @returns {string|null} 유저에게 보여줄 메시지, 아닐 경우 null
 */
export function parseBannedWordError(error) {
  if (!error) return null
  const msg = error.message || ''
  if (msg.includes('금칙어가 포함되어 있습니다')) return msg
  return null
}

/** 프로필 닉네임 시즌 1회 제한 (DB 트리거 RAISE) */
export function parseNicknameSeasonLimitError(error) {
  if (!error) return null
  const msg = String(error.message || '')
  const details = String(error.details || '')
  const hint = String(error.hint || '')
  const hay = `${msg} ${details} ${hint}`
  if (hay.includes('NICKNAME_CHANGE_SEASON_LIMIT')) {
    return '이번 시즌에는 닉네임을 한 번만 변경할 수 있어요. 다음 시즌 시작 후 다시 시도해 주세요.'
  }
  return null
}

// ── 4. SQLi/Script Injection 패턴 탐지 ─────────────────────────────────────

/**
 * 의심스러운 SQL Injection / Script Injection 패턴을 탐지합니다.
 * - 실제 DB 보안은 Supabase 파라미터화 쿼리로 보장되므로 이 함수는 알림 전용.
 * - false positive 가능성 있음 → 폼 자체를 막지 말고 백그라운드 알림만 발송.
 */

const SQLI_PATTERNS = [
  /(\bselect\b.+\bfrom\b|\binsert\s+into\b|\bdelete\s+from\b|\bdrop\s+table\b|\btruncate\s+table\b)/i,
  /(\bunion\s+(all\s+)?select\b)/i,
  /('|"|`)\s*(or|and)\s*['"` ]?\d+\s*[=<>]/i,  // ' OR 1=1
  /(;\s*(drop|delete|update|insert|select|exec|execute|alter|create)\b)/i,
  /(\bexec\s*\(|\bexecute\s*\(|\bxp_\w+\s*\()/i,  // MSSQL exec/xp_
  /(--\s*$|#\s*$)/m,  // 주석 시도
  /(<script[\s>]|javascript\s*:)/i,  // XSS 기본
]

/**
 * 의심스러운 주입 패턴이 있으면 매칭된 패턴 인덱스를 반환, 없으면 -1.
 * @param {string} text
 * @returns {number}  -1 = 정상, 0+ = 패턴 인덱스
 */
export function detectInjectionPattern(text) {
  if (!text || typeof text !== 'string') return -1
  for (let i = 0; i < SQLI_PATTERNS.length; i++) {
    if (SQLI_PATTERNS[i].test(text)) return i
  }
  return -1
}

/**
 * 여러 필드를 한 번에 검사하고, 감지된 경우 시스템 푸시를 백그라운드로 발송합니다.
 * 발송은 fire-and-forget — 폼 제출 자체를 막지 않습니다.
 * @param {string[]} fields  검사할 텍스트 배열
 * @param {{ userId?: string, path?: string }} ctx  선택적 컨텍스트
 */
export async function reportSuspiciousInputIfNeeded(fields, ctx = {}) {
  if (!Array.isArray(fields)) return
  const joined = fields.filter(Boolean).join('\n')
  if (detectInjectionPattern(joined) === -1) return

  try {
    const { supabase } = await import('./supabase')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const body = [
      ctx.path ? `경로: ${ctx.path}` : null,
      ctx.userId ? `사용자 ID: ${ctx.userId}` : null,
      '의심스러운 입력값이 감지됐습니다:',
      joined.slice(0, 1000),
    ].filter(Boolean).join('\n')

    fetch(resolveSiteUrl('/api/system-push-dispatch'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventId: 'suspicious_query',
        title: '비정상 입력값 감지',
        body,
      }),
    }).catch(() => {})
  } catch { /* ignore */ }
}

// ── 5. URL 파라미터 인코딩 ─────────────────────────────────────────────────

/** URL 쿼리/경로에 넣을 사용자 입력값 인코딩 */
export function encodeForUrl(str) {
  if (str == null) return ''
  return encodeURIComponent(String(str))
}
