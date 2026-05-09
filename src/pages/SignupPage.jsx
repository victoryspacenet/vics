import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { isRejoinCooldownDbError, REJOIN_COOLDOWN_USER_MESSAGE } from '../lib/rejoinCooldown'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { Button } from '../components/ui/Button'
import { Logo } from '../components/ui/Logo'

const NICKNAME_MAX = 10
const PASSWORD_MIN = 8

/** 영문·숫자·특수문자 혼합 + PASSWORD_MIN자 이상, 공백 불가. 통과 시 null */
function getPasswordValidationError(pw) {
  if (!pw) return '비밀번호를 입력해주세요'
  if (/\s/.test(pw)) return '비밀번호에 공백을 사용할 수 없어요'
  if (pw.length < PASSWORD_MIN) return `비밀번호는 ${PASSWORD_MIN}자 이상으로 입력해주세요`
  if (!/[A-Za-z]/.test(pw)) return '비밀번호에 영문을 포함해주세요'
  if (!/[0-9]/.test(pw)) return '비밀번호에 숫자를 포함해주세요'
  if (!/[^A-Za-z0-9]/.test(pw)) return '비밀번호에 특수문자를 포함해주세요'
  return null
}

export function SignupPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading: authLoading } = useAuthStore()
  const { showToast } = useUIStore()

  const [form, setForm] = useState({
    nickname: '',
    email: '',
    password: '',
    birthdate: '',
    gender: '',
  })
  const [nicknameStatus, setNicknameStatus] = useState(null) // null | 'checking' | 'available' | 'taken'
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  const set = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: null }))
  }

  const checkNickname = async () => {
    if (!form.nickname.trim()) return
    setNicknameStatus('checking')
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('nickname', form.nickname.trim())
      .maybeSingle()
    setNicknameStatus(data ? 'taken' : 'available')
  }

  const validate = () => {
    const errs = {}
    if (!form.nickname.trim()) errs.nickname = '닉네임을 입력해주세요'
    if (nicknameStatus === 'taken') errs.nickname = '이미 사용 중인 닉네임이에요'
    if (!form.email.trim()) errs.email = '이메일을 입력해주세요'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = '올바른 이메일 형식이 아니에요'
    {
      const pwErr = getPasswordValidationError(form.password)
      if (pwErr) errs.password = pwErr
    }
    if (!form.birthdate) errs.birthdate = '생년월일을 입력해주세요'
    if (!form.gender) errs.gender = '성별을 선택해주세요'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate() || loading) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            nickname: form.nickname.trim(),
            birthdate: form.birthdate,
            gender: form.gender,
          },
        },
      })
      if (error) throw error

      // 프로필에 추가 정보 업데이트
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { error: upErr } = await supabase.from('profiles').upsert({
          id: user.id,
          nickname: form.nickname.trim(),
          email: form.email.trim(),
          birthdate: form.birthdate,
          gender: form.gender,
          points: 1000,
        })
        if (upErr) {
          if (isRejoinCooldownDbError(upErr)) {
            await supabase.auth.signOut()
            showToast(REJOIN_COOLDOWN_USER_MESSAGE, 'error')
            return
          }
          throw upErr
        }
      }

      navigate('/welcome', {
        replace: true,
        state: { nickname: form.nickname.trim(), avatarUrl: null },
      })
    } catch (err) {
      if (isRejoinCooldownDbError(err)) {
        await supabase.auth.signOut()
        showToast(REJOIN_COOLDOWN_USER_MESSAGE, 'error')
      } else {
        showToast(err.message || '회원가입에 실패했어요', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const isValid = form.nickname && form.email && form.birthdate && form.gender
    && nicknameStatus !== 'taken'

  if (authLoading) {
    return (
      <div className="relative -mx-4 px-4 pt-2 pb-20 sm:pb-24 min-h-[calc(100dvh-5.5rem)] flex flex-col items-center justify-center">
        <div className="h-9 w-9 border-2 border-fuchsia-200 border-t-fuchsia-600 rounded-full animate-spin" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-fuchsia-800/70">세션 확인 중…</p>
      </div>
    )
  }

  if (user?.id) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="relative -mx-4 px-4 pt-2 pb-20 sm:pb-24 min-h-[calc(100dvh-5.5rem)] overflow-hidden">
      {/* 배경: 소프트 그라데이션 + 블롭 (MZ 톤, 심플) */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-violet-100/90 via-fuchsia-50/80 to-amber-50/70"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-16 right-[-20%] h-[min(22rem,55vw)] w-[min(22rem,55vw)] rounded-full bg-fuchsia-400/25 blur-3xl" />
        <div className="absolute top-[28%] -left-[15%] h-[min(18rem,48vw)] w-[min(18rem,48vw)] rounded-full bg-violet-400/20 blur-3xl" />
        <div className="absolute bottom-[-5%] right-[10%] h-48 w-48 rounded-full bg-amber-300/30 blur-2xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,255,255,0.55),transparent)]" />
      </div>

      <div className="relative z-10 max-w-sm mx-auto min-w-0">
        <div className="rounded-[1.75rem] border border-white/70 bg-white/75 backdrop-blur-xl shadow-[0_8px_40px_-12px_rgba(139,92,246,0.25),0_0_0_1px_rgba(255,255,255,0.8)_inset] px-5 py-8 sm:px-7 sm:py-9">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="rounded-2xl bg-gradient-to-br from-white to-violet-50/80 p-2 shadow-md shadow-violet-200/40 ring-1 ring-white/90">
                <Logo size={48} dark={false} link={false} />
              </div>
            </div>
            <h1 className="text-[1.35rem] font-black tracking-tight text-[#1e2430] sm:text-xl">
              VICS{' '}
              <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-violet-600 bg-clip-text text-transparent">
                가입하기
              </span>
            </h1>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              한 번에 가입하고, <span className="font-semibold text-violet-600/90">바로 경쟁</span>해요
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
        {/* 닉네임 */}
        <div>
          <label className="block text-xs font-semibold text-[#22282E] mb-2">닉네임</label>
          <div className="flex gap-2 min-w-0">
            <input
              type="text"
              value={form.nickname}
              maxLength={NICKNAME_MAX}
              onChange={(e) => {
                const v = e.target.value.slice(0, NICKNAME_MAX)
                set('nickname', v)
                setNicknameStatus(null)
              }}
              placeholder="멋진 닉네임을 입력해요"
              className="flex-1 min-w-0 px-3 py-2.5 text-sm rounded-xl outline-none transition-all bg-fuchsia-50/30 border-2 border-fuchsia-200/80 text-[#22282E] focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200/50 hover:border-fuchsia-300"
            />
            <button
              type="button"
              onClick={checkNickname}
              className="px-3 py-2.5 text-xs font-medium rounded-xl transition-colors shrink-0 border-2 border-fuchsia-200/70 bg-fuchsia-50/40 text-fuchsia-800 hover:bg-fuchsia-100/60 hover:border-fuchsia-300"
            >
              중복확인
            </button>
          </div>
          <div className="flex justify-end mt-1.5 px-0.5">
            <span
              className={`text-[11px] font-semibold tabular-nums ${
                form.nickname.length >= NICKNAME_MAX ? 'text-fuchsia-600' : 'text-fuchsia-500/70'
              }`}
            >
              {form.nickname.length}/{NICKNAME_MAX}
            </span>
          </div>
          {nicknameStatus === 'available' && (
            <p className="flex items-center gap-1 text-xs text-green-600 mt-1">
              <CheckCircle size={12} /> 사용 가능한 닉네임이에요
            </p>
          )}
          {nicknameStatus === 'taken' && (
            <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
              <AlertCircle size={12} /> 이미 사용 중인 닉네임이에요
            </p>
          )}
          {errors.nickname && (
            <p className="text-xs text-red-500 mt-1">{errors.nickname}</p>
          )}
        </div>

        {/* 이메일 */}
        <div>
          <label className="block text-xs font-semibold text-[#22282E] mb-2">이메일</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="example@email.com"
            className="w-full px-3 py-2.5 text-sm rounded-xl outline-none transition-all bg-sky-50/30 border-2 border-sky-200/85 text-[#22282E] focus:border-sky-400 focus:ring-2 focus:ring-sky-200/50 hover:border-sky-300"
          />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
        </div>

        {/* 생년월일 */}
        <div>
          <label className="block text-xs font-semibold text-[#22282E] mb-2">생년월일</label>
          <input
            type="date"
            value={form.birthdate}
            onChange={(e) => set('birthdate', e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2.5 text-sm rounded-xl outline-none transition-all bg-emerald-50/30 border-2 border-emerald-200/85 text-[#22282E] focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200/50 hover:border-emerald-300"
          />
          {errors.birthdate && <p className="text-xs text-red-500 mt-1">{errors.birthdate}</p>}
        </div>

        {/* 성별 */}
        <div>
          <label className="block text-xs font-semibold text-[#22282E] mb-2">성별</label>
          <div className="grid grid-cols-2 gap-2">
            {[{ id: 'male', label: '남성' }, { id: 'female', label: '여성' }].map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => set('gender', g.id)}
                className={`py-2.5 text-sm font-medium rounded-xl border-2 transition-all ${
                  form.gender === g.id
                    ? 'border-[#22282E] bg-[#22282E] text-white shadow-md shadow-slate-300/30'
                    : g.id === 'male'
                      ? 'border-cyan-200/90 bg-cyan-50/35 text-gray-700 hover:border-cyan-400/80 hover:bg-cyan-50/50'
                      : 'border-rose-200/90 bg-rose-50/35 text-gray-700 hover:border-rose-400/80 hover:bg-rose-50/50'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          {errors.gender && <p className="text-xs text-red-500 mt-1">{errors.gender}</p>}
        </div>

        {/* 비밀번호 */}
        <div>
          <label className="block text-xs font-semibold text-[#22282E] mb-2">비밀번호</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            placeholder={`${PASSWORD_MIN}자 이상 입력해요`}
            className="w-full px-3 py-2.5 text-sm rounded-xl outline-none transition-all bg-violet-50/30 border-2 border-violet-200/85 text-[#22282E] focus:border-violet-400 focus:ring-2 focus:ring-violet-200/50 hover:border-violet-300"
          />
          <p className="mt-1.5 px-0.5 text-[11px] text-violet-600/85 leading-snug">
            {PASSWORD_MIN}자 이상 · 영문/숫자/특수문자 혼합 (공백 불가)
          </p>
          {errors.password && (
            <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
              <AlertCircle size={12} className="shrink-0" />
              {errors.password}
            </p>
          )}
        </div>

        <Button variant="mz" size="full" disabled={!isValid || loading} className="mt-2 rounded-2xl py-3.5 text-[15px] tracking-tight">
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              가입 중...
            </span>
          ) : '회원가입 완료'}
        </Button>
      </form>
        </div>

        <p className="text-center text-sm text-gray-600/90 mt-7">
          이미 계정이 있으신가요?{' '}
          <Link
            to="/login"
            state={{ from: location }}
            className="font-semibold text-violet-700 hover:text-violet-800 underline underline-offset-2 decoration-violet-300/80 hover:decoration-violet-500"
          >
            로그인
          </Link>
        </p>
      </div>
    </div>
  )
}
