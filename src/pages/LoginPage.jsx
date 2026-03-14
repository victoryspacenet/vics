import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { Button } from '../components/ui/Button'
import { Logo } from '../components/ui/Logo'

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

function SocialButtons({ onLogin }) {
  const [loadingProvider, setLoadingProvider] = useState(null)
  const { showToast } = useUIStore()

  const handleSocial = async (provider) => {
    setLoadingProvider(provider)
    try {
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
    <div className="space-y-2">
      {SOCIAL_PROVIDERS.map((p) => (
        <button
          key={p.id}
          onClick={() => handleSocial(p.id)}
          disabled={!!loadingProvider}
          className={`w-full flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-semibold transition-all ${p.bg} ${p.text} disabled:opacity-70`}
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
  const { fetchProfile } = useAuthStore()
  const { showToast } = useUIStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleEmailLogin = async (e) => {
    e.preventDefault()
    if (!email || !password || loading) return
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      await fetchProfile(data.user.id)
      showToast('로그인 됐어요!', 'success')
      navigate('/')
    } catch {
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
        <p className="text-sm text-gray-400 mt-1">대결의 세계로 돌아오세요</p>
      </div>

      <SocialButtons />

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

// ── 헤더 로그인 모달 버전 ──────────────────────────────────────────
export function LoginModal({ onClose }) {
  const navigate = useNavigate()
  const { fetchProfile } = useAuthStore()
  const { showToast } = useUIStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleEmailLogin = async (e) => {
    e.preventDefault()
    if (!email || !password || loading) return
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      await fetchProfile(data.user.id)
      showToast('로그인 됐어요!', 'success')
      onClose()
    } catch {
      showToast('이메일 또는 비밀번호가 올바르지 않아요', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <SocialButtons />

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-100" />
        <span className="text-xs text-gray-400">이메일 로그인</span>
        <div className="flex-1 h-px bg-gray-100" />
      </div>

      <form onSubmit={handleEmailLogin} className="space-y-2">
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
          {loading ? '로그인 중...' : '로그인'}
        </Button>
      </form>

      <p className="text-center text-xs text-gray-400">
        계정이 없으신가요?{' '}
        <button
          onClick={() => { onClose(); navigate('/signup') }}
          className="text-[#22282E] font-semibold hover:underline"
        >
          회원가입
        </button>
      </p>
    </div>
  )
}
