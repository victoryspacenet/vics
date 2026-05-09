import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Sparkles, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import {
  clearStoredLoginReturn,
  getLastPathBeforeLogin,
  getSafeReturnPath,
  pathFromRouterState,
  storeLoginReturnForOAuth,
} from '../lib/loginReturn'
import { Button } from '../components/ui/Button'
import { Logo } from '../components/ui/Logo'

// ── 로그인 실패 반복 추적 ─────────────────────────────────────────────────────
const LOGIN_FAIL_KEY = 'vics_login_fail_v1'
const FAIL_WINDOW_MS = 5 * 60 * 1000  // 5분 내 실패 횟수 집계
const FAIL_THRESHOLD = 5              // 5회 이상이면 알림 발송

function trackLoginFail(email) {
  try {
    const now = Date.now()
    const raw = sessionStorage.getItem(LOGIN_FAIL_KEY)
    const timestamps = raw ? JSON.parse(raw).filter((t) => now - t < FAIL_WINDOW_MS) : []
    timestamps.push(now)
    sessionStorage.setItem(LOGIN_FAIL_KEY, JSON.stringify(timestamps))

    if (timestamps.length >= FAIL_THRESHOLD) {
      sessionStorage.removeItem(LOGIN_FAIL_KEY)
      fetch('/.netlify/functions/login-fail-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email || '',
          userAgent: navigator.userAgent || '',
        }),
      }).catch(() => {})
    }
  } catch { /* ignore */ }
}

// ── 소셜 로그인 버튼 정의 ──────────────────────────────────────────
const SOCIAL_PROVIDERS = [
  {
    id: 'kakao',
    label: '카카오로 계속하기',
    bg: 'bg-[#FEE500] hover:bg-[#FDD835]',
    text: 'text-[#191600]',
    icon: (
      <svg width="20" height="19" viewBox="0 0 20 19" fill="none">
        <path
          d="M10 0C4.477 0 0 3.582 0 8C0 10.89 1.733 13.441 4.357 15.009L3.19 18.702a.333.333 0 0 0 .519.363L8.077 16.1c.635.054 1.279.081 1.923.081 5.523 0 10-3.582 10-8S15.523 0 10 0z"
          fill="#191600"
        />
      </svg>
    ),
  },
  {
    id: 'google',
    label: 'Google로 계속하기',
    bg: 'bg-white hover:bg-gray-50 border border-gray-200',
    text: 'text-gray-700',
    icon: (
      <svg width="18" height="18" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
        <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
      </svg>
    ),
  },
]

function SocialButtons({ oauthReturnPath = '/', tone = 'default' }) {
  const [loadingProvider, setLoadingProvider] = useState(null)
  const { showToast } = useUIStore()
  const isMz = tone === 'mz'

  const handleSocial = async (provider) => {
    setLoadingProvider(provider)
    try {
      storeLoginReturnForOAuth(oauthReturnPath)
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/`,
          // Kakao에는 provider-specific queryParams 불필요
        },
      })
      console.log(`[OAuth] ${provider} 시작:`, { data, error })
      if (error) throw error
      // 리다이렉트가 발생하므로 이 이후 코드는 실행되지 않음
    } catch (err) {
      console.error(`[OAuth] ${provider} 에러:`, err)
      showToast(
        `${provider === 'kakao' ? '카카오' : 'Google'} 로그인 실패: ${err.message || '다시 시도해주세요'}`,
        'error'
      )
      setLoadingProvider(null)
    }
  }

  return (
    <div className={isMz ? 'space-y-2.5' : 'space-y-2'}>
      {SOCIAL_PROVIDERS.map((p) => (
        <button
          key={p.id}
          onClick={() => handleSocial(p.id)}
          disabled={!!loadingProvider}
          className={`w-full flex items-center justify-center gap-3 text-sm transition-all disabled:opacity-70 ${
            isMz
              ? `rounded-2xl py-3.5 font-bold shadow-lg shadow-black/5 ring-1 ring-white/60 ${p.bg} ${p.text} hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]`
              : `py-3 rounded-xl font-semibold ${p.bg} ${p.text}`
          }`}
        >
          {loadingProvider === p.id ? (
            <span className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          ) : p.icon}
          {p.label}
        </button>
      ))}
    </div>
  )
}

// ── 로그인 페이지 ──────────────────────────────────────────────────
export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { fetchProfile } = useAuthStore()
  const { showToast } = useUIStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const returnAfterLogin = useMemo(() => {
    const fromState = pathFromRouterState(location.state?.from)
    const next = searchParams.get('next')
    if (fromState || next) return getSafeReturnPath(fromState || next, '/')
    const remembered = getLastPathBeforeLogin()
    return getSafeReturnPath(remembered || '/', '/')
  }, [location.state, searchParams])

  const handleEmailLogin = async (e) => {
    e.preventDefault()
    if (!email || !password || loading) return
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      await fetchProfile(data.user.id)
      clearStoredLoginReturn()
      showToast('로그인 됐어요!', 'success')
      navigate(returnAfterLogin, { replace: true })
    } catch {
      trackLoginFail(email)
      showToast('이메일 또는 비밀번호가 올바르지 않아요', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto py-8">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <Logo size={48} dark={false} link={false} />
        </div>
        <h1 className="text-xl font-black text-[#22282E]">VICS 로그인</h1>
        <p className="text-sm text-gray-400 mt-1">경쟁의 세계로 돌아오세요</p>
      </div>

      <SocialButtons oauthReturnPath={returnAfterLogin} />

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-gray-100" />
        <span className="text-xs text-gray-400">또는 이메일로 로그인</span>
        <div className="flex-1 h-px bg-gray-100" />
      </div>

      <form onSubmit={handleEmailLogin} className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#22282E] transition-colors"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#22282E] transition-colors"
        />
        <Button size="full" disabled={!email || !password || loading}>
          {loading
            ? <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                로그인 중...
              </span>
            : '로그인'}
        </Button>
      </form>

      <p className="text-center text-sm text-gray-400 mt-6">
        아직 계정이 없으신가요?{' '}
        <Link to="/signup" className="text-[#22282E] font-semibold hover:underline">회원가입</Link>
      </p>
    </div>
  )
}

// ── 헤더 로그인 모달 버전 (MZ 톤) ──────────────────────────────────
const MZ_INPUT =
  'w-full px-4 py-3 text-sm rounded-2xl outline-none transition-all bg-white/70 border-2 border-fuchsia-200/60 text-violet-950/90 placeholder:text-fuchsia-400/70 focus:border-fuchsia-400 focus:ring-4 focus:ring-fuchsia-200/40'

export function LoginModal({ onClose }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { fetchProfile } = useAuthStore()
  const { showToast, loginModalContext } = useUIStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const oauthReturnPath = useMemo(
    () => getSafeReturnPath(`${location.pathname}${location.search}${location.hash}`, '/'),
    [location.pathname, location.search, location.hash]
  )

  const isVote = loginModalContext === 'vote'
  const headline = isVote ? '투표하려면 로그인!' : '다시 만나서 반가워요'
  const subline = isVote
    ? '로그인하고 내 한 표를 남겨봐 ✨'
    : '오늘도 취향 경쟁 한 판 어때요? 💜'

  const handleEmailLogin = async (e) => {
    e.preventDefault()
    if (!email || !password || loading) return
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      await fetchProfile(data.user.id)
      clearStoredLoginReturn()
      showToast('로그인 됐어요!', 'success')
      onClose()
    } catch {
      trackLoginFail(email)
      showToast('이메일 또는 비밀번호가 올바르지 않아요', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative rounded-2xl">
      {/* 배경만 overflow clip — 본문 텍스트(bg-clip-text 등)는 잘리지 않도록 분리 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-100/95 via-fuchsia-50/90 to-cyan-50/85" />
        <div className="absolute -top-16 -right-12 h-44 w-44 rounded-full bg-fuchsia-400/35 blur-3xl" />
        <div className="absolute -bottom-10 -left-8 h-36 w-36 rounded-full bg-violet-400/25 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-300/20 blur-2xl" />
      </div>

      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-xl bg-white/60 text-fuchsia-900/50 shadow-sm backdrop-blur-md transition-all hover:bg-white/90 hover:text-fuchsia-900"
        aria-label="닫기"
      >
        <X size={18} strokeWidth={2.25} />
      </button>

      <div className="relative z-10 px-5 pb-8 pt-10">
        {/* 히어로 */}
        <div className="mb-5 text-center">
          <div className="mb-3 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 opacity-40 blur-lg" />
              <div className="relative rounded-2xl bg-gradient-to-br from-white to-fuchsia-50/90 p-2.5 shadow-lg shadow-fuchsia-300/30 ring-2 ring-white/90">
                <Logo size={44} dark={false} link={false} />
              </div>
            </div>
          </div>
          <div className="mb-1 inline-flex items-center gap-1 rounded-full border border-fuchsia-200/80 bg-white/50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-fuchsia-600/90 backdrop-blur-sm">
            <Sparkles size={12} className="text-amber-400" />
            VICS Login
          </div>
          <h2 className="mt-2 text-xl font-black leading-tight tracking-tight text-[#1e1b2e]">
            {headline}
          </h2>
          <p className="mt-1.5 text-sm font-medium leading-relaxed text-fuchsia-950/55">{subline}</p>
        </div>

        <SocialButtons oauthReturnPath={oauthReturnPath} tone="mz" />

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-fuchsia-300/50 to-transparent" />
          <span className="shrink-0 text-[11px] font-bold tracking-wide text-fuchsia-600/70">or 이메일로 입장</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-fuchsia-300/50 to-transparent" />
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일 주소"
            autoComplete="email"
            className={MZ_INPUT}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            autoComplete="current-password"
            className={MZ_INPUT}
          />
          <button
            type="submit"
            disabled={!email || !password || loading}
            className="flex min-h-[3.25rem] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 px-3 py-3.5 text-center text-sm font-black leading-snug text-white shadow-lg shadow-fuchsia-400/35 transition-all hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                로그인 중…
              </span>
            ) : (
              <span className="block w-full whitespace-normal break-keep px-0.5">
                로그인하고 입장하기 🚀
              </span>
            )}
          </button>
        </form>

        <p className="mt-6 flex flex-wrap items-center justify-center gap-x-1 gap-y-1 pb-0.5 text-center text-xs font-medium leading-relaxed text-fuchsia-950/45">
          <span className="shrink-0">아직 계정이 없어요?</span>
          <button
            type="button"
            onClick={() => {
              onClose()
              navigate('/signup')
            }}
            className="inline-flex shrink-0 border-none bg-transparent p-0"
          >
            <span className="whitespace-nowrap bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text py-0.5 text-sm font-bold text-transparent underline decoration-fuchsia-300/80 underline-offset-2 hover:from-violet-500 hover:to-pink-500">
              회원가입하러가기
            </span>
          </button>
        </p>
      </div>
    </div>
  )
}
