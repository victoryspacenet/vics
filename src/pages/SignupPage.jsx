import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, CheckCircle, Eye, EyeOff, Loader2, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { checkNicknameTaken } from '../lib/nicknameTakenApi'
import { resolveSiteUrl } from '../lib/siteApiBase'
import { SIGNUP_BONUS_POINTS, grantSignupBonusIfNeeded } from '../lib/signupRewards'
import { messageForSignUpError } from '../lib/signInPasswordErrors'
import { isRejoinCooldownDbError, REJOIN_COOLDOWN_USER_MESSAGE } from '../lib/rejoinCooldown'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { Logo } from '../components/ui/Logo'
import { SignupTasteSection } from '../components/signup/SignupTasteSection'
import { isSignupTasteComplete, normalizeSignupTasteAnswers, SIGNUP_TASTE_QUESTIONS } from '../lib/signupTasteQuestions'

const NICKNAME_MAX = 10
const PASSWORD_MIN = 8

function getPasswordValidationError(pw) {
  if (!pw) return '비밀번호를 입력해주세요'
  if (/\s/.test(pw)) return '비밀번호에 공백을 사용할 수 없어요'
  if (pw.length < PASSWORD_MIN) return `비밀번호는 ${PASSWORD_MIN}자 이상으로 입력해주세요`
  if (!/[A-Za-z]/.test(pw)) return '비밀번호에 영문을 포함해주세요'
  if (!/[0-9]/.test(pw)) return '비밀번호에 숫자를 포함해주세요'
  if (!/[^A-Za-z0-9]/.test(pw)) return '비밀번호에 특수문자를 포함해주세요'
  return null
}

function getPasswordStrength(pw) {
  if (!pw) return 0
  let score = 0
  if (pw.length >= PASSWORD_MIN) score++
  if (/[A-Za-z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}

const INPUT_BASE =
  'w-full px-4 py-3 text-sm rounded-2xl outline-none transition-all text-[#22282E] placeholder:text-slate-400 ring-2 ring-transparent'
const INPUT_NORMAL = `${INPUT_BASE} bg-white/80 border-2 border-violet-200/50 focus:border-fuchsia-400 focus:ring-fuchsia-200/40`
const INPUT_ERROR  = `${INPUT_BASE} bg-rose-50/70 border-2 border-rose-300/80 focus:border-rose-400 focus:ring-rose-200/40`

export function SignupPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading: authLoading } = useAuthStore()
  const { showToast } = useUIStore()

  const [form, setForm] = useState({ nickname: '', email: '', password: '', birthdate: '', gender: '' })
  const [tasteAnswers, setTasteAnswers] = useState({
    personality_type: '',
    matchup_role: '',
    interest_topic: '',
  })
  const [nicknameStatus, setNicknameStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [showPw, setShowPw] = useState(false)

  const setTaste = (questionId, optionId) => {
    setTasteAnswers((prev) => ({ ...prev, [questionId]: optionId }))
    setErrors((e) => ({ ...e, [questionId]: null, taste: null }))
  }

  const set = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: null }))
  }

  const checkNickname = async () => {
    if (!form.nickname.trim()) return
    setNicknameStatus('checking')
    const { taken, error } = await checkNicknameTaken(form.nickname.trim())
    if (error) {
      setNicknameStatus(null)
      showToast('닉네임 확인에 실패했어요. 잠시 후 다시 시도해 주세요.', 'error')
      return
    }
    setNicknameStatus(taken ? 'taken' : 'available')
  }

  const validate = () => {
    const errs = {}
    if (!form.nickname.trim()) errs.nickname = '닉네임을 입력해주세요'
    else if (nicknameStatus === 'checking') errs.nickname = '닉네임 중복 확인 중이에요. 잠시만 기다려 주세요'
    else if (nicknameStatus === 'taken') errs.nickname = '이미 사용 중인 닉네임이에요'
    else if (nicknameStatus !== 'available') errs.nickname = '「중복확인」으로 사용 가능한 닉네임인지 확인해 주세요'
    if (!form.email.trim()) errs.email = '이메일을 입력해주세요'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = '올바른 이메일 형식이 아니에요'
    const pwErr = getPasswordValidationError(form.password)
    if (pwErr) errs.password = pwErr
    if (!form.birthdate) errs.birthdate = '생년월일을 입력해주세요'
    if (!form.gender) errs.gender = '성별을 선택해주세요'
    for (const q of SIGNUP_TASTE_QUESTIONS) {
      if (!tasteAnswers[q.id]) errs[q.id] = '하나 골라 주세요'
    }
    if (!isSignupTasteComplete(tasteAnswers)) errs.taste = '취향 체크 3문항을 모두 선택해 주세요'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate() || loading) return
    setLoading(true)
    try {
      const tastePayload = normalizeSignupTasteAnswers(tasteAnswers)
      const { data: authData, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            nickname: form.nickname.trim(),
            birthdate: form.birthdate,
            gender: form.gender,
            signup_taste_answers: tastePayload,
          },
        },
      })
      if (error) throw error

      const session = authData?.session
      const newUser = authData?.user

      if (newUser && !session) {
        try {
          const res = await fetch(resolveSiteUrl('/api/profiles-bootstrap-signup'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: newUser.id,
              email: form.email.trim(),
              nickname: form.nickname.trim(),
              birthdate: form.birthdate,
              gender: form.gender,
              signup_taste_answers: tastePayload,
            }),
          })
          if (!res.ok) {
            const j = await res.json().catch(() => ({}))
            console.warn('[Signup] profiles-bootstrap-signup', res.status, j)
          } else {
            await grantSignupBonusIfNeeded(newUser.id)
            try { window.dispatchEvent(new CustomEvent('vics:adminUsers:updated')) } catch { /* ignore */ }
          }
        } catch (e) {
          console.warn('[Signup] profiles-bootstrap-signup fetch', e?.message || e)
        }
        showToast('가입 확인 메일을 보냈어요. 메일함(스팸함 포함)에서 링크를 눌러 인증한 뒤 로그인해 주세요.', 'success')
        const q = new URLSearchParams({ registered: '1', email: form.email.trim() })
        navigate(`/login?${q.toString()}`, { replace: true })
        return
      }

      const authedUser = session?.user ?? newUser
      if (authedUser) {
        const { error: upErr } = await supabase.from('profiles').upsert({
          id: authedUser.id,
          nickname: form.nickname.trim(),
          email: form.email.trim(),
          birthdate: form.birthdate,
          gender: form.gender,
          signup_taste_answers: tastePayload,
          points: SIGNUP_BONUS_POINTS,
        })
        if (upErr) {
          if (isRejoinCooldownDbError(upErr)) { await supabase.auth.signOut(); showToast(REJOIN_COOLDOWN_USER_MESSAGE, 'error'); return }
          throw upErr
        }
        await grantSignupBonusIfNeeded(authedUser.id)
        try { await supabase.auth.updateUser({ data: { nickname: form.nickname.trim(), birthdate: form.birthdate, gender: form.gender, signup_taste_answers: tastePayload } }) }
        catch (e) { console.warn('[Signup] auth.updateUser', e?.message || e) }
        try { window.dispatchEvent(new CustomEvent('vics:adminUsers:updated')) } catch { /* ignore */ }
      }

      navigate('/welcome', { replace: true, state: { nickname: form.nickname.trim(), avatarUrl: null } })
    } catch (err) {
      if (isRejoinCooldownDbError(err)) { await supabase.auth.signOut(); showToast(REJOIN_COOLDOWN_USER_MESSAGE, 'error') }
      else showToast(messageForSignUpError(err), 'error')
    } finally {
      setLoading(false)
    }
  }

  const isValid =
    form.nickname.trim() &&
    form.email.trim() &&
    form.birthdate &&
    form.gender &&
    isSignupTasteComplete(tasteAnswers) &&
    nicknameStatus === 'available'
  const pwStrength = getPasswordStrength(form.password)

  if (authLoading) {
    return (
      <div className="relative -mx-4 px-4 pt-2 pb-20 min-h-[calc(100dvh-5.5rem)] flex flex-col items-center justify-center bg-gradient-to-b from-violet-50/80 to-fuchsia-50/50">
        <div className="h-9 w-9 border-2 border-fuchsia-200 border-t-fuchsia-600 rounded-full animate-spin" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-fuchsia-800/70">세션 확인 중…</p>
      </div>
    )
  }

  if (user?.id) return <Navigate to="/" replace />

  return (
    <div className="relative -mx-4 px-4 pt-2 pb-20 sm:pb-24 min-h-[calc(100dvh-5.5rem)] overflow-hidden">
      {/* 배경 */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,#faf5ff_0%,#eff6ff_45%,#fff7ed_100%)]" aria-hidden />
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-20 right-[-20%] h-[min(24rem,60vw)] w-[min(24rem,60vw)] rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div className="absolute top-[30%] -left-[18%] h-[min(20rem,52vw)] w-[min(20rem,52vw)] rounded-full bg-violet-400/18 blur-3xl" />
        <div className="absolute bottom-[5%] right-[8%] h-52 w-52 rounded-full bg-amber-300/25 blur-2xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,255,255,0.55),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_95%_70%_at_50%_-15%,rgba(167,139,250,0.3),transparent_55%),radial-gradient(ellipse_70%_55%_at_100%_40%,rgba(244,114,182,0.18),transparent_50%)]" />
      </div>
      {/* 상단 네온 라인 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/50 to-transparent" />

      <div className="relative z-10 max-w-sm mx-auto min-w-0 space-y-5">

        {/* 뒤로가기 */}
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="flex items-center gap-1.5 pl-1 pr-3 py-2 rounded-xl bg-white/60 border border-white/70 text-fuchsia-700 text-xs font-bold hover:bg-white/90 transition-all shadow-sm backdrop-blur-sm"
        >
          <ArrowLeft size={14} />
          로그인으로
        </button>

        {/* 헤더 */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 opacity-30 blur-xl" />
              <div className="relative rounded-2xl bg-gradient-to-br from-white/95 to-fuchsia-50/80 p-[3px] shadow-[0_12px_40px_-12px_rgba(139,92,246,0.4)]">
                <div className="rounded-[1.35rem] bg-white/90 px-4 py-3 ring-1 ring-white/95">
                  <Logo size={48} dark={false} link={false} />
                </div>
              </div>
            </div>
          </div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-fuchsia-200/80 bg-white/60 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-fuchsia-600/90 backdrop-blur-sm shadow-sm">
            <Sparkles size={12} className="text-amber-400" />
            VICS Signup
          </div>
          <h1 className="mt-2 text-[1.5rem] font-black leading-tight tracking-tight">
            <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-400 bg-clip-text text-transparent">
              함께 경쟁해요!
            </span>
          </h1>
          <p className="mt-1.5 text-sm font-medium text-slate-500 leading-relaxed">
            한 번에 가입하고,{' '}
            <span className="font-bold text-violet-600/90">바로 취향 대결</span>을 시작해요
          </p>
        </div>

        {/* 폼 카드 */}
        <div className="rounded-[1.75rem] border border-white/60 bg-white/50 backdrop-blur-2xl shadow-[0_16px_56px_-12px_rgba(109,40,217,0.18),0_4px_24px_-8px_rgba(244,114,182,0.12)] overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-400" />
          <div className="px-5 py-6 sm:px-7 sm:py-7">
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* 닉네임 */}
              <div>
                <label className="block text-xs font-bold text-violet-900/70 mb-1.5">닉네임</label>
                <div className="flex gap-2 min-w-0">
                  <input
                    type="text"
                    value={form.nickname}
                    maxLength={NICKNAME_MAX}
                    onChange={(e) => { set('nickname', e.target.value.slice(0, NICKNAME_MAX)); setNicknameStatus(null) }}
                    placeholder="멋진 닉네임을 입력해요"
                    className={(errors.nickname ? INPUT_ERROR : INPUT_NORMAL) + ' flex-1 min-w-0'}
                  />
                  <button
                    type="button"
                    onClick={checkNickname}
                    disabled={nicknameStatus === 'checking' || !form.nickname.trim()}
                    className="px-3 py-3 text-xs font-black rounded-2xl shrink-0 border-2 border-fuchsia-200/70 bg-fuchsia-50/60 text-fuchsia-800 hover:bg-fuchsia-100/80 hover:border-fuchsia-300 disabled:opacity-50 transition-all"
                  >
                    {nicknameStatus === 'checking' ? <Loader2 size={14} className="animate-spin" /> : '중복확인'}
                  </button>
                </div>
                <div className="flex items-center justify-between mt-1.5 px-0.5">
                  <div>
                    {nicknameStatus === 'available' && (
                      <p className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                        <CheckCircle size={12} /> 사용 가능한 닉네임이에요
                      </p>
                    )}
                    {nicknameStatus === 'taken' && (
                      <p className="flex items-center gap-1 text-[11px] font-bold text-rose-500">
                        <AlertCircle size={12} /> 이미 사용 중인 닉네임이에요
                      </p>
                    )}
                    {errors.nickname && !['available', 'taken'].includes(nicknameStatus) && (
                      <p className="flex items-center gap-1 text-[11px] font-bold text-rose-500">
                        <AlertCircle size={12} />{errors.nickname}
                      </p>
                    )}
                  </div>
                  <span className={`text-[11px] font-semibold tabular-nums ${form.nickname.length >= NICKNAME_MAX ? 'text-fuchsia-600' : 'text-slate-400'}`}>
                    {form.nickname.length}/{NICKNAME_MAX}
                  </span>
                </div>
              </div>

              {/* 이메일 */}
              <div>
                <label className="block text-xs font-bold text-violet-900/70 mb-1.5">이메일</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="example@email.com"
                  className={errors.email ? INPUT_ERROR : INPUT_NORMAL}
                />
                {errors.email && (
                  <p className="flex items-center gap-1 text-[11px] font-bold text-rose-500 mt-1.5 px-0.5">
                    <AlertCircle size={12} />{errors.email}
                  </p>
                )}
              </div>

              {/* 생년월일 + 성별 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-violet-900/70 mb-1.5">생년월일</label>
                  <input
                    type="date"
                    value={form.birthdate}
                    onChange={(e) => set('birthdate', e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className={errors.birthdate ? INPUT_ERROR : INPUT_NORMAL}
                  />
                  {errors.birthdate && (
                    <p className="flex items-center gap-1 text-[11px] font-bold text-rose-500 mt-1">
                      <AlertCircle size={11} />{errors.birthdate}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-violet-900/70 mb-1.5">성별</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[{ id: 'male', label: '남성', emoji: '👦' }, { id: 'female', label: '여성', emoji: '👧' }].map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => set('gender', g.id)}
                        className={`py-3 text-xs font-black rounded-2xl border-2 transition-all ${
                          form.gender === g.id
                            ? 'border-fuchsia-500 bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-md shadow-fuchsia-300/30'
                            : 'border-violet-200/50 bg-white/70 text-slate-600 hover:border-fuchsia-300 hover:bg-fuchsia-50/50'
                        }`}
                      >
                        <span className="block text-base mb-0.5">{g.emoji}</span>
                        {g.label}
                      </button>
                    ))}
                  </div>
                  {errors.gender && (
                    <p className="flex items-center gap-1 text-[11px] font-bold text-rose-500 mt-1">
                      <AlertCircle size={11} />{errors.gender}
                    </p>
                  )}
                </div>
              </div>

              {/* VictorySpace 취향 체크 */}
              <SignupTasteSection
                answers={tasteAnswers}
                onChange={setTaste}
                errors={errors}
              />
              {errors.taste && (
                <p className="flex items-center gap-1 text-[11px] font-bold text-rose-500 -mt-2 px-0.5">
                  <AlertCircle size={12} />
                  {errors.taste}
                </p>
              )}

              {/* 비밀번호 */}
              <div>
                <label className="block text-xs font-bold text-violet-900/70 mb-1.5">비밀번호</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                    placeholder={`${PASSWORD_MIN}자 이상, 영문+숫자+특수문자`}
                    className={(errors.password ? INPUT_ERROR : INPUT_NORMAL) + ' pr-11'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-fuchsia-600 transition-colors"
                    tabIndex={-1}
                    aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* 비밀번호 강도 바 */}
                {form.password.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((n) => (
                        <div key={n} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          pwStrength >= n
                            ? n <= 1 ? 'bg-rose-400'
                            : n <= 2 ? 'bg-amber-400'
                            : n <= 3 ? 'bg-lime-400'
                            : 'bg-emerald-500'
                            : 'bg-slate-200'
                        }`} />
                      ))}
                    </div>
                    <p className={`text-[11px] font-semibold px-0.5 ${
                      pwStrength <= 1 ? 'text-rose-500'
                      : pwStrength <= 2 ? 'text-amber-600'
                      : pwStrength <= 3 ? 'text-lime-600'
                      : 'text-emerald-600'
                    }`}>
                      {pwStrength <= 1 ? '⚠️ 매우 약함'
                      : pwStrength === 2 ? '보통'
                      : pwStrength === 3 ? '강함'
                      : '✅ 매우 강함'}
                    </p>
                  </div>
                )}

                {errors.password && (
                  <p className="flex items-center gap-1 text-[11px] font-bold text-rose-500 mt-1 px-0.5">
                    <AlertCircle size={12} className="shrink-0" />{errors.password}
                  </p>
                )}
                {!errors.password && (
                  <p className="mt-1.5 px-0.5 text-[11px] text-violet-600/70 leading-snug">
                    {PASSWORD_MIN}자 이상 · 영문/숫자/특수문자 혼합 (공백 불가)
                  </p>
                )}
              </div>

              {/* 제출 버튼 */}
              <button
                type="submit"
                disabled={!isValid || loading}
                className={`flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white transition-all mt-2 ${
                  isValid && !loading
                    ? 'bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 shadow-[0_4px_18px_-4px_rgba(139,92,246,0.55)] hover:brightness-105 hover:shadow-[0_6px_24px_-4px_rgba(192,38,211,0.5)] active:scale-[0.98]'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                }`}
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white shrink-0" />
                    가입 중…
                  </>
                ) : (
                  '🎉 회원가입 완료'
                )}
              </button>

            </form>
          </div>
        </div>

        {/* 로그인 링크 */}
        <p className="text-center text-sm font-medium text-slate-500 pb-2">
          이미 계정이 있으신가요?{' '}
          <Link
            to="/login"
            state={{ from: location }}
            className="font-black text-violet-700 underline decoration-violet-300/80 decoration-2 underline-offset-[3px] transition hover:text-fuchsia-600 hover:decoration-fuchsia-400/80"
          >
            로그인 하기
          </Link>
        </p>

      </div>
    </div>
  )
}
