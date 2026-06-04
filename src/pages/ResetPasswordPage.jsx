import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUIStore } from '../store/uiStore'
import { Button } from '../components/ui/Button'
import { clearLastPathBeforeLogin } from '../lib/loginReturn'
import {
  PasswordRecoveryShell,
  RecoveryHeading,
  RecoveryGlassCard,
  RecoveryFooterLinks,
  recoveryInputClass,
  recoveryLinkClass,
} from '../components/auth/passwordRecoveryUi'

const PASSWORD_MIN = 8

/** 가입 페이지와 동일 규칙 */
function getPasswordValidationError(pw) {
  if (!pw) return '비밀번호를 입력해주세요'
  if (/\s/.test(pw)) return '비밀번호에 공백을 사용할 수 없어요'
  if (pw.length < PASSWORD_MIN) return `비밀번호는 ${PASSWORD_MIN}자 이상으로 입력해주세요`
  if (!/[A-Za-z]/.test(pw)) return '비밀번호에 영문을 포함해주세요'
  if (!/[0-9]/.test(pw)) return '비밀번호에 숫자를 포함해주세요'
  if (!/[^A-Za-z0-9]/.test(pw)) return '비밀번호에 특수문자를 포함해주세요'
  return null
}

function messageForUpdatePasswordApiError(err) {
  const raw = String(err?.message || '')
  const low = raw.toLowerCase()
  const mutex =
    /steal|lock broken|lock acquisition|navigatorlock|timed out.*lock|isAcquireTimeout/i.test(low) ||
    err?.isAcquireTimeout === true
  if (mutex) {
    return '처리 순서가 겹쳤어요. 다른 VICS 탭을 닫고 잠깐 후 다시 눌러 주세요.'
  }
  if (
    /same|identical|reuse|different from the old|should be different|must be different/i.test(low) ||
    raw.includes('이전')
  ) {
    return '새 비밀번호는 이전 비밀번호와 달라야 해요. 예전 비밀번호와 완전히 다른 문자 조합으로 다시 입력해 주세요.'
  }
  return raw || '비밀번호 변경에 실패했어요.'
}

function isLikelyMutexUpdateError(err) {
  const raw = String(err?.message || '')
  return (
    /steal|lock broken|lock acquisition|navigatorlock|timed out.*lock|isAcquireTimeout/i.test(raw) ||
    err?.isAcquireTimeout === true
  )
}

/** Supabase 비밀번호 재설정 링크가 실패할 때 해시(Query) 에 붙는 error 파라미터 */
function parseRecoveryUrlError() {
  try {
    if (typeof window === 'undefined') return null
    const tryParse = (raw) => {
      if (!raw) return null
      const p = new URLSearchParams(raw)
      const err = p.get('error')
      if (!err) return null
      const description = String(p.get('error_description') || '').replace(/\+/g, ' ')
      let decoded = description
      try {
        decoded = decodeURIComponent(description)
      } catch {
        /* 그대로 */
      }
      return {
        error: err,
        code: p.get('error_code') || '',
        description: decoded,
      }
    }
    const fromHash = window.location.hash.replace(/^#/, '')
    const fromSearch = window.location.search.replace(/^\?/, '')
    return tryParse(fromHash) || tryParse(fromSearch)
  } catch {
    return null
  }
}

/** 링크 hash · query 의 복구 신호(type=recovery, access_token fragment, PKCE code 등) — error 와 구분 */
function hasRecoveryIndicators() {
  try {
    if (typeof window === 'undefined') return false
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    if (hashParams.get('error')) return false
    if (hashParams.get('type') === 'recovery') return true
    if (hashParams.get('access_token')) return true

    const q = new URLSearchParams(window.location.search)
    if (q.get('error')) return false
    if (q.get('type') === 'recovery') return true
    if (q.get('code')) return true
  } catch {
    /* ignore */
  }
  return false
}

/**
 * 메일 링크로 들어온 직후 URL 해시가 한 번만 보이거나(React Strict Mode 재마운트·클라이언트 처리)
 * 곧 지워져도 복구 플로우로 남기기 위해 세션에 표시.
 */
const RECOVERY_LANDING_SESSION_KEY = 'vics_recovery_landing'

function markRecoveryLandingSessionIfHashPresent() {
  if (typeof window === 'undefined') return
  if (!hasRecoveryIndicators()) return
  try {
    sessionStorage.setItem(RECOVERY_LANDING_SESSION_KEY, '1')
  } catch {
    /* ignore */
  }
}

function getStableRecoveryLandingFlag() {
  if (typeof window === 'undefined') return false
  if (hasRecoveryIndicators()) {
    markRecoveryLandingSessionIfHashPresent()
    return true
  }
  try {
    return sessionStorage.getItem(RECOVERY_LANDING_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

function clearRecoveryLandingSessionFlag() {
  try {
    sessionStorage.removeItem(RECOVERY_LANDING_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

function messageForRecoveryUrlError(err) {
  if (!err) return ''
  const code = String(err.code || '').toLowerCase()
  if (code === 'otp_expired') {
    return (
      '재설정 링크가 만료되었거나 이미 사용된 링크예요.' +
      ' 메일 속 링크는 보통 한 번만 쓸 수 있고, 시간이 지나면 무효가 됩니다.'
    )
  }
  if (/expired/i.test(err.description || '')) {
    return '링크 유효 시간이 지났어요. 비밀번호 찾기에서 메일을 다시 요청해 주세요.'
  }
  return '비밀번호 재설정 링크를 처리하지 못했어요.'
}

/** 알림 카드 안 링크 — 배경색에 맞춘 대비 */
const alertLinkClass =
  'text-sm font-black text-current underline decoration-2 underline-offset-[3px] opacity-95 hover:opacity-100'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const { showToast } = useUIStore()
  const recoveryUrlError = useMemo(() => parseRecoveryUrlError(), [])
  /** 복구 토큰·코드가 있었는지 — 해시 소비·재마운트 후에도 sessionStorage 로 유지 */
  const [recoveryFlowAtLanding, setRecoveryFlowAtLanding] = useState(() => getStableRecoveryLandingFlag())

  const [phase, setPhase] = useState(() => (recoveryUrlError ? 'failed' : 'pending'))
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const devDebug = useMemo(() => {
    if (!import.meta.env.DEV) return null
    try {
      const hash = typeof window !== 'undefined' ? window.location.hash || '' : ''
      const search = typeof window !== 'undefined' ? window.location.search || '' : ''
      const hashParams = new URLSearchParams(hash.replace(/^#/, ''))
      const q = new URLSearchParams(search.replace(/^\?/, ''))
      return {
        phase,
        hasHash: Boolean(hash),
        hashLen: hash.length,
        hasAccessToken: Boolean(hashParams.get('access_token')),
        type: hashParams.get('type') || q.get('type') || '',
        hasCode: Boolean(q.get('code')),
        recoveryFlowAtLanding,
        hasRecoveryIndicators: hasRecoveryIndicators(),
        recoveryUrlError: recoveryUrlError ? JSON.stringify(recoveryUrlError) : '',
      }
    } catch (e) {
      return { phase, error: String(e?.message || e) }
    }
  }, [phase, recoveryFlowAtLanding, recoveryUrlError])

  useEffect(() => {
    if (!recoveryUrlError) return
    clearRecoveryLandingSessionFlag()
    if (typeof window !== 'undefined' && (window.location.hash || window.location.search)) {
      window.history.replaceState(null, '', `${window.location.pathname}`)
    }
  }, [recoveryUrlError])

  /** 해시가 늦게 붙는 경우(일부 메일·브라우저), Strict Mode 재마운트 후에도 플래그 복구 */
  useEffect(() => {
    if (recoveryUrlError) return

    const sync = () => {
      const next = getStableRecoveryLandingFlag()
      setRecoveryFlowAtLanding((prev) => (prev === next ? prev : next))
      if (next) void supabase.auth.getSession()
    }

    sync()
    const t = window.setTimeout(sync, 0)
    window.addEventListener('hashchange', sync)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('hashchange', sync)
    }
  }, [recoveryUrlError])

  useEffect(() => {
    if (recoveryUrlError) return

    let cancelled = false
    const expectsRecovery = recoveryFlowAtLanding

    const settleForm = () => {
      if (cancelled) return
      setPhase('form')
    }

    async function bootstrapRecoverySession() {
      if (typeof window === 'undefined') return
      /** App.initialize 의 getSession 과 동시 실행 시 auth 락 경합 완화 */
      await new Promise((r) => setTimeout(r, 120))

      const q = new URLSearchParams(window.location.search)
      const code = q.get('code')
      if (!code || !expectsRecovery) return

      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!cancelled && error) {
        console.warn('[reset-password] exchangeCodeForSession:', error.message)
        showToast(
          /verifier/i.test(error.message || '')
            ? '같은 브라우저에서 비밀번호 찾기를 요청한 뒤, 메일 링크를 눌러 주세요.'
            : '링크 처리에 실패했어요. 비밀번호 찾기로 다시 시도해 주세요.',
          'error',
        )
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (!cancelled && session?.user) settleForm()
    }

    void bootstrapRecoverySession()

    if (expectsRecovery && typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search)
      if (!q.get('code')) void supabase.auth.getSession()
    }

    let unsubscribed = false
    const { data } = supabase.auth.onAuthStateChange((event, sess) => {
      if (unsubscribed || cancelled || !sess?.user) return
      /** implicit 복구: 일부 브라우저는 PASSWORD_RECOVERY 대신 SIGNED_IN 만 올림 */
      if (event === 'PASSWORD_RECOVERY' || (recoveryFlowAtLanding && event === 'SIGNED_IN')) settleForm()
    })

    const timer = window.setTimeout(() => {
      if (unsubscribed || cancelled) return
      setPhase((p) => {
        if (p !== 'pending') return p
        if (expectsRecovery) return 'pending'
        return 'hint'
      })
    }, 2800)

    const hardTimer = window.setTimeout(() => {
      if (unsubscribed || cancelled) return
      setPhase((p) => (p === 'pending' ? 'hint' : p))
    }, 12000)

    return () => {
      cancelled = true
      unsubscribed = true
      window.clearTimeout(timer)
      window.clearTimeout(hardTimer)
      data.subscription.unsubscribe()
    }
  }, [recoveryUrlError, recoveryFlowAtLanding, showToast])

  useEffect(() => {
    if (phase === 'hint') clearRecoveryLandingSessionFlag()
  }, [phase])

  const pwErr = getPasswordValidationError(password)
  const matchErr = password && password !== password2 ? '비밀번호가 서로 다릅니다' : null
  const open = phase === 'form'
  const submitDisabled = !open || loading

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!open || loading) return

    const e1 = getPasswordValidationError(password)
    if (e1) {
      showToast(e1, 'error')
      return
    }
    if (password !== password2) {
      showToast('비밀번호가 서로 달라요.', 'error')
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      showToast('재설정 세션이 없어요. 메일의 링크를 다시 눌러 주세요.', 'error')
      return
    }

    setLoading(true)
    try {
      let lastUpdateErr = null
      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 380 * attempt))
        }
        const { error } = await supabase.auth.updateUser({ password })
        if (!error) {
          lastUpdateErr = null
          break
        }
        lastUpdateErr = error
        if (!isLikelyMutexUpdateError(error)) break
      }
      if (lastUpdateErr) throw lastUpdateErr
      await supabase.auth.signOut()
      clearLastPathBeforeLogin()
      clearRecoveryLandingSessionFlag()
      window.history.replaceState(null, '', window.location.pathname)
      showToast('비밀번호를 변경했어요. 새 비밀번호로 로그인해 주세요.', 'success')
      navigate('/login?reset=success', { replace: true })
    } catch (err) {
      showToast(messageForUpdatePasswordApiError(err), 'error')
    } finally {
      setLoading(false)
    }
  }

  if (phase === 'failed' && recoveryUrlError) {
    const detail = messageForRecoveryUrlError(recoveryUrlError)
    return (
      <PasswordRecoveryShell>
        {devDebug ? (
          <pre className="mx-auto mb-4 w-full max-w-xl overflow-auto rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-950">
            {JSON.stringify(devDebug, null, 2)}
          </pre>
        ) : null}
        <RecoveryHeading eyebrow="Oops" title="링크 문제" subtitle={detail} />
        <RecoveryGlassCard className="border-rose-200/60 bg-gradient-to-br from-rose-50/80 to-orange-50/40">
          <p className="text-sm font-bold leading-relaxed text-rose-950/90">
            가능한 원인: 두 번 탭했을 때 · 오래된 메일 · 새 메일 요청 후 예전 메일 링크
          </p>
          <div className="mt-5 flex flex-row flex-wrap items-center gap-x-2 gap-y-2 text-rose-950">
            <Link to="/forgot-password" className={alertLinkClass}>
              비밀번호 찾기로 다시 받기
            </Link>
            <span aria-hidden className="text-rose-300">
              ·
            </span>
            <Link to="/login" className={alertLinkClass}>
              로그인
            </Link>
          </div>
        </RecoveryGlassCard>
      </PasswordRecoveryShell>
    )
  }

  if (phase === 'pending') {
    return (
      <PasswordRecoveryShell>
        {devDebug ? (
          <pre className="mx-auto mb-4 w-full max-w-xl overflow-auto rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-950">
            {JSON.stringify(devDebug, null, 2)}
          </pre>
        ) : null}
        <RecoveryHeading
          eyebrow="Hold on"
          title="링크 확인 중"
          subtitle="잠깐만 기다려 주세요. 재설정 연결을 점검하고 있어요."
        />
        <RecoveryGlassCard className="flex flex-col items-center py-14">
          <span
            className="h-12 w-12 animate-spin rounded-full border-[3px] border-violet-200/70 border-t-fuchsia-500 shadow-[0_0_24px_-4px_rgba(217,70,239,0.55)]"
            aria-hidden
          />
          <p className="mt-6 text-center text-sm font-semibold text-slate-600">세팅 거의 다 됐어요…</p>
        </RecoveryGlassCard>
      </PasswordRecoveryShell>
    )
  }

  if (!open) {
    return (
      <PasswordRecoveryShell>
        {devDebug ? (
          <pre className="mx-auto mb-4 w-full max-w-xl overflow-auto rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-950">
            {JSON.stringify(devDebug, null, 2)}
          </pre>
        ) : null}
        <RecoveryHeading
          eyebrow="Reset"
          title="유효한 링크가 없어요"
          subtitle="메일 속 링크를 다시 누르거나, 비밀번호 찾기로 새 요청을 보내 주세요."
        />
        <RecoveryGlassCard className="border-amber-200/55 bg-gradient-to-br from-amber-50/85 to-orange-50/45">
          <div className="flex flex-row flex-wrap items-center justify-center gap-x-2 gap-y-2 text-center text-amber-950">
            <Link to="/forgot-password" className={alertLinkClass}>
              비밀번호 찾기
            </Link>
            <span aria-hidden className="text-amber-300">
              ·
            </span>
            <Link to="/login" className={alertLinkClass}>
              로그인
            </Link>
          </div>
        </RecoveryGlassCard>
      </PasswordRecoveryShell>
    )
  }

  return (
    <PasswordRecoveryShell>
      {devDebug ? (
        <pre className="mx-auto mb-4 w-full max-w-xl overflow-auto rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-950">
          {JSON.stringify(devDebug, null, 2)}
        </pre>
      ) : null}
      <RecoveryHeading
        eyebrow="New pass"
        title="새 비밀번호 설정"
        subtitle={`영문·숫자·특수문자 포함 최소 ${PASSWORD_MIN}자 — 멋지게 만들어 보세요.`}
      />

      <RecoveryGlassCard>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="reset-pw-1" className="mb-1.5 block text-xs font-bold text-violet-900/70">
              새 비밀번호
            </label>
            <input
              id="reset-pw-1"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="영문·숫자·특수문자 조합"
              autoComplete="new-password"
              className={recoveryInputClass({ error: !!pwErr })}
            />
            {pwErr ? <p className="mt-2 text-xs font-semibold text-rose-600">{pwErr}</p> : null}
          </div>

          <div>
            <label htmlFor="reset-pw-2" className="mb-1.5 block text-xs font-bold text-violet-900/70">
              한 번 더 입력
            </label>
            <input
              id="reset-pw-2"
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="비밀번호 확인"
              autoComplete="new-password"
              className={recoveryInputClass({ error: !!matchErr })}
            />
            {matchErr ? <p className="mt-2 text-xs font-semibold text-rose-600">{matchErr}</p> : null}
          </div>

          <Button size="full" variant="mz" type="submit" disabled={submitDisabled}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                저장 중…
              </span>
            ) : (
              '비밀번호 변경하기'
            )}
          </Button>
        </form>
      </RecoveryGlassCard>

      <RecoveryFooterLinks>
        <Link to="/login" className={recoveryLinkClass()}>
          로그인으로 돌아가기
        </Link>
      </RecoveryFooterLinks>
    </PasswordRecoveryShell>
  )
}
