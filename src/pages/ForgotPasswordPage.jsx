import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getPasswordRecoveryRedirectToUrl } from '../lib/siteApiBase'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { Button } from '../components/ui/Button'
import {
  PasswordRecoveryShell,
  RecoveryHeading,
  RecoveryGlassCard,
  RecoveryFooterLinks,
  recoveryInputClass,
  recoveryLinkClass,
} from '../components/auth/passwordRecoveryUi'

export function ForgotPasswordPage() {
  const { user, loading: authLoading } = useAuthStore()
  const { showToast } = useUIStore()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const redirectTo = useMemo(() => getPasswordRecoveryRedirectToUrl(), [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || loading) return

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
    if (!emailOk) {
      showToast('올바른 이메일 형식으로 입력해 주세요.', 'error')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo })
      if (error) throw error
      setSent(true)
      showToast('안내 메일을 보냈어요. 받은편지함·스팸함을 확인해 주세요.', 'success')
    } catch (err) {
      showToast(err?.message ? String(err.message) : '요청 처리에 실패했어요.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PasswordRecoveryShell>
      <RecoveryHeading
        eyebrow="Pass reset"
        title="비밀번호 찾기"
        subtitle="가입한 이메일로 재설정 링크를 보내 드릴게요. 스팸함도 한번 확인해 주세요."
      />

      {!authLoading && user ? (
        <div className="rounded-[1.25rem] border border-amber-200/60 bg-amber-50/80 px-4 py-3 text-center text-xs font-semibold leading-relaxed text-amber-950/90 backdrop-blur-sm shadow-sm">
          지금 다른 계정으로 로그인 중이에요. 다른 주소로 재설정하려면 먼저 로그아웃해 주세요.
        </div>
      ) : null}

      <RecoveryGlassCard>
        {sent ? (
          <div
            className="mb-5 flex gap-3 rounded-2xl border border-emerald-300/40 bg-gradient-to-br from-emerald-50/90 to-teal-50/50 px-4 py-3.5 text-left shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7)]"
            role="status"
          >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/25 text-emerald-700">
              <Sparkles className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div>
              <p className="text-sm font-black text-emerald-900">메일을 확인해 주세요</p>
              <p className="mt-1 text-sm font-medium leading-snug text-emerald-900/85">
                해당 주소가 가입되어 있으면 재설정 링크가 갔어요. 링크는 시간이 지나면 만료될 수 있어요.
              </p>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="forgot-email" className="mb-1.5 block text-xs font-bold text-violet-900/70">
              이메일
            </label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={sent}
              className={recoveryInputClass()}
            />
          </div>
          <Button size="full" variant="mz" type="submit" disabled={!email.trim() || loading || sent}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                보내는 중…
              </span>
            ) : (
              '재설정 메일 받기'
            )}
          </Button>
        </form>
      </RecoveryGlassCard>

      <RecoveryFooterLinks>
        <Link to="/login" className={recoveryLinkClass()}>
          로그인
        </Link>
      </RecoveryFooterLinks>
    </PasswordRecoveryShell>
  )
}
