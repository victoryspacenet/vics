import { AlertTriangle, Flame, RefreshCw } from 'lucide-react'
import { Button } from '../ui/Button'
import { Logo } from '../ui/Logo'
import { formatExpectedRecoveryLabel, isEmergencyMaintenance } from '../../lib/serverMaintenance'
import { useServerMaintenanceStore } from '../../store/serverMaintenanceStore'
import { cn } from '../../lib/utils'
import { MaintenanceOperatorBar } from './MaintenanceOperatorBar'

export function ServerMaintenanceScreen() {
  const config = useServerMaintenanceStore((s) => s.config)
  const message = config.message
  const expectedRecoveryAt = config.expectedRecoveryAt
  const checking = useServerMaintenanceStore((s) => s.checking)
  const refresh = useServerMaintenanceStore((s) => s.refresh)
  const recoveryLabel = formatExpectedRecoveryLabel(expectedRecoveryAt)
  const emergency = isEmergencyMaintenance(config)

  return (
    <div
      className={cn(
        'fixed inset-0 z-[200] flex min-h-[100dvh] flex-col items-center justify-center overflow-y-auto px-4 py-10 text-white',
        emergency
          ? 'bg-gradient-to-br from-slate-950 via-red-950/50 to-slate-900'
          : 'bg-gradient-to-br from-slate-950 via-orange-950/40 to-slate-900',
      )}
    >
      <div className="w-full max-w-md pb-24 text-center">
        <div className="mb-6 flex justify-center">
          <Logo size={48} dark link={false} />
        </div>
        {emergency ? (
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-red-400/40 bg-red-500/20 px-3 py-1 text-xs font-black uppercase tracking-wide text-red-100">
            <AlertTriangle size={14} />
            긴급 점검
          </span>
        ) : null}
        <div
          className={cn(
            'mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg',
            emergency
              ? 'bg-gradient-to-br from-red-500 via-rose-600 to-red-800 shadow-red-500/30'
              : 'bg-gradient-to-br from-orange-400 via-rose-500 to-amber-500 shadow-orange-500/30',
          )}
          aria-hidden
        >
          {emergency ? (
            <AlertTriangle size={32} className="text-white" strokeWidth={2.25} />
          ) : (
            <Flame size={32} className="text-white" strokeWidth={2.25} />
          )}
        </div>
        <h1 className="text-xl font-black tracking-tight sm:text-2xl">
          {emergency ? '긴급 점검 중' : '잠시 열을 식히는 중'}
        </h1>
        <p
          className={cn(
            'mt-4 text-base font-semibold leading-relaxed sm:text-lg',
            emergency ? 'text-red-50/95' : 'text-orange-50/95',
          )}
        >
          {message}
        </p>
        {recoveryLabel ? (
          <p
            className={cn(
              'mt-4 inline-flex max-w-full flex-row flex-wrap items-center justify-center gap-x-1 rounded-xl',
              'border border-amber-300/30 bg-amber-500/15 px-4 py-2.5',
              'text-sm font-bold text-amber-100 [writing-mode:horizontal-tb] [word-break:keep-all] whitespace-nowrap',
            )}
          >
            <span className="shrink-0">예상 복구:</span>
            <span>{recoveryLabel}</span>
          </p>
        ) : (
          <p className="mt-4 text-sm text-white/55">복구 예정 시각은 곧 안내될 예정이에요.</p>
        )}
        <p className="mt-6 text-sm leading-relaxed text-white/50">
          {emergency
            ? '불편을 드려 죄송합니다. 문제 해결 후 순차적으로 서비스를 재개할 예정입니다.'
            : '잠시만 기다려 주세요. 곧 다시 뜨거운 매치업 현장으로 돌아올게요!'}
        </p>
        <div className="mt-8">
          <Button
            type="button"
            variant="primary"
            disabled={checking}
            onClick={() => void refresh({ probe: true })}
            className="min-w-[10rem] gap-2 bg-gradient-to-r from-lime-400 via-emerald-400 to-teal-500 text-[#0f1f0f] shadow-lg"
          >
            <RefreshCw size={16} className={checking ? 'animate-spin' : ''} />
            {checking ? '확인 중…' : '다시 확인'}
          </Button>
        </div>
      </div>
      <MaintenanceOperatorBar />
    </div>
  )
}
