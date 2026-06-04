import { cn } from '../../lib/utils'
import { Logo } from '../ui/Logo'

/** 비밀번호 찾기·재설정 — MZ 무드(그라데이션·글래스·네온 라인) */
export function PasswordRecoveryShell({ children }) {
  return (
    <div className="relative isolate w-full overflow-x-clip pb-12 pt-2">
      {/* fixed 가 아니라 영역 안 absolute — 레이아웃 푸터 전체를 덮지 않음 */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
        <div
          className="absolute inset-0 bg-[linear-gradient(165deg,#faf5ff_0%,#eff6ff_45%,#fff7ed_100%)]"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_95%_70%_at_50%_-15%,rgba(167,139,250,0.42),transparent_55%),radial-gradient(ellipse_70%_55%_at_100%_40%,rgba(244,114,182,0.28),transparent_50%),radial-gradient(ellipse_65%_50%_at_0%_85%,rgba(56,189,248,0.22),transparent_50%)]"
          aria-hidden
        />
        <div
          className="motion-safe:animate-[pulse_6s_ease-in-out_infinite] absolute -left-24 top-[10%] h-80 w-80 rounded-full bg-fuchsia-400/30 blur-[100px]"
          aria-hidden
        />
        <div
          className="motion-safe:animate-[pulse_7s_ease-in-out_infinite] absolute -right-20 bottom-[5%] h-96 w-96 rounded-full bg-violet-500/25 blur-[110px]"
          aria-hidden
        />
      </div>
      {/* 상단 라인 글로우 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/60 to-transparent"
      />

      <div className="relative z-10 mx-auto w-full max-w-md space-y-6">{children}</div>
    </div>
  )
}

/** 로고 · 그라데이션 타이틀 · 부제 */
export function RecoveryHeading({ eyebrow, title, subtitle }) {
  return (
    <div className="text-center">
      {eyebrow ? (
        <p className="mb-5 text-[11px] font-black uppercase tracking-[0.22em] text-violet-600/85">{eyebrow}</p>
      ) : null}

      <div className="mb-5 flex justify-center">
        <div className="rounded-3xl bg-gradient-to-br from-white/95 to-white/70 p-[3px] shadow-[0_12px_40px_-12px_rgba(139,92,246,0.45)] drop-shadow-lg">
          <div className="rounded-[1.35rem] bg-white/90 px-4 py-3 ring-1 ring-white/95 backdrop-blur-sm">
            <Logo size={52} dark={false} link={false} />
          </div>
        </div>
      </div>

      <h1 className="text-[1.625rem] font-black leading-[1.18] tracking-tight sm:text-[1.875rem]">
        <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-400 bg-clip-text text-transparent [text-shadow:none]">
          {title}
        </span>
      </h1>
      {subtitle ? (
        <p className="mt-3 px-2 text-[0.9375rem] font-medium leading-relaxed text-slate-600">{subtitle}</p>
      ) : null}
    </div>
  )
}

export function RecoveryGlassCard({ className, children }) {
  return (
    <div
      className={cn(
        'rounded-[1.75rem] border border-white/60 bg-white/45 p-6 shadow-[0_16px_56px_-12px_rgba(109,40,217,0.18),0_4px_24px_-8px_rgba(244,114,182,0.12)] backdrop-blur-2xl sm:p-8',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function recoveryInputClass({ error = false } = {}) {
  return cn(
    'w-full rounded-2xl px-4 py-3.5 text-sm font-medium text-slate-800 shadow-inner shadow-white/30 placeholder:font-medium placeholder:text-slate-400 outline-none transition-[box-shadow,border-color] ring-2 ring-transparent',
    error
      ? 'border border-rose-300/80 bg-rose-50/70 focus:ring-rose-300/45'
      : 'border border-violet-200/45 bg-white/80 focus:border-fuchsia-300/60 focus:ring-fuchsia-400/30',
  )
}

export function RecoveryFooterLinks({ children }) {
  return (
    <p className="text-center text-sm font-semibold text-slate-500">
      {children}
    </p>
  )
}

export function recoveryLinkClass() {
  return 'font-bold text-violet-700 underline decoration-violet-300/80 decoration-2 underline-offset-[3px] transition hover:text-fuchsia-600 hover:decoration-fuchsia-400/80'
}
