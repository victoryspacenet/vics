import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ShieldOff, Siren } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { useAuthStore } from '../../store/authStore'
import { useAdminPermissionStore } from '../../store/adminPermissionStore'
import { useUIStore } from '../../store/uiStore'
import {
  activateEmergencyMaintenance,
  deactivateServerMaintenance,
  fetchServerMaintenanceConfig,
  isEmergencyMaintenance,
  SERVER_MAINTENANCE_UPDATED,
} from '../../lib/serverMaintenance'
import { cn } from '../../lib/utils'

const CONFIRM_BODY = (
  <>
    <p className="text-sm leading-relaxed text-gray-700">
      <strong className="text-red-700">즉시</strong> 모든 일반 유저 화면에 긴급 점검 안내가 표시됩니다.
      운영자는 <code className="text-xs bg-gray-100 px-1 rounded">/admin</code> 또는 점검 화면 하단
      「관리자 콘솔」에서 계속 이용할 수 있습니다.
    </p>
    <p className="mt-2 text-xs text-gray-500">
      예상 복구 시각은 기본 2시간 후로 설정됩니다. 해제는 관리자 헤더·점검 화면 하단 「점검 해제」에서 할 수
      있습니다.
    </p>
  </>
)

const DEACTIVATE_BODY = (
  <p className="text-sm leading-relaxed text-gray-700">
    긴급 점검 모드를 끄면 일반 유저에게 다시 서비스가 노출됩니다. 문제가 완전히 해결됐는지 확인해 주세요.
  </p>
)

export function EmergencyMaintenanceControl({ compact = false, surface = 'light', className }) {
  const { user } = useAuthStore()
  const canWrite = useAdminPermissionStore((s) => s.allowsAction('settings', 'w'))
  const { showToast } = useUIStore()
  const [cfg, setCfg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)

  const reload = useCallback(async () => {
    try {
      setCfg(await fetchServerMaintenanceConfig())
    } catch {
      setCfg(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
    const onUpdate = () => void reload()
    window.addEventListener(SERVER_MAINTENANCE_UPDATED, onUpdate)
    return () => window.removeEventListener(SERVER_MAINTENANCE_UPDATED, onUpdate)
  }, [reload])

  if (!canWrite) return null
  if (loading) return null

  const emergencyOn = isEmergencyMaintenance(cfg)
  const plannedOn = Boolean(cfg?.enabled) && !emergencyOn
  const maintenanceOn = Boolean(cfg?.enabled)

  const handleActivate = async () => {
    setBusy(true)
    try {
      await activateEmergencyMaintenance({
        activatedBy: user?.email || user?.id || null,
      })
      await reload()
      setConfirmOpen(false)
      showToast(
        '긴급 점검 모드가 켜졌어요. 해제는 /admin 또는 점검 화면 하단에서 할 수 있어요.',
        'success',
      )
    } catch (e) {
      showToast(e?.message || '긴급 점검 전환에 실패했어요.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleDeactivate = async () => {
    setBusy(true)
    try {
      await deactivateServerMaintenance()
      await reload()
      setDeactivateOpen(false)
      showToast('점검 모드가 해제됐어요.', 'success')
    } catch (e) {
      showToast(e?.message || '해제에 실패했어요.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const onDark = surface === 'dark'

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 shrink-0', className)}>
        {maintenanceOn ? (
          <>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-black',
                onDark
                  ? emergencyOn
                    ? 'border border-red-400/40 bg-red-500/20 text-red-100'
                    : 'border border-amber-400/30 bg-amber-500/15 text-amber-100'
                  : emergencyOn
                    ? 'hidden sm:inline-flex border border-red-200 bg-red-50 text-red-800'
                    : 'hidden sm:inline-flex border border-amber-200 bg-amber-50 text-amber-900',
              )}
            >
              <Siren size={14} className={emergencyOn && onDark ? 'animate-pulse' : ''} />
              {emergencyOn ? '긴급 점검 중' : '점검 중'}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => setDeactivateOpen(true)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold disabled:opacity-50',
                onDark
                  ? 'border border-white/25 bg-white/10 text-white hover:bg-white/15'
                  : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
              )}
            >
              <ShieldOff size={14} />
              점검 해제
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border-2 border-red-500 bg-red-600 px-3 py-1.5 text-xs font-black text-white hover:bg-red-500 disabled:opacity-50 shadow-sm"
          >
            <Siren size={14} />
            긴급 점검
          </button>
        )}
        <ActivateModal open={confirmOpen} busy={busy} onClose={() => setConfirmOpen(false)} onConfirm={handleActivate} />
        <DeactivateModal
          open={deactivateOpen}
          busy={busy}
          onClose={() => setDeactivateOpen(false)}
          onConfirm={handleDeactivate}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-xl border-2 p-5',
        emergencyOn ? 'border-red-300 bg-red-50/80' : 'border-red-200 bg-gradient-to-br from-red-50 to-orange-50',
        className,
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white">
          <Siren size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-black text-red-950">치명적 버그 — 긴급 점검</h2>
          <p className="mt-1 text-sm text-red-900/80">
            저장 없이 한 번에 전환합니다. 일반 유저 접속을 즉시 차단하고 점검 화면을 띄웁니다.
          </p>
          {emergencyOn ? (
            <p className="mt-2 text-xs font-bold text-red-800">
              현재 긴급 점검 모드가 켜져 있습니다.
              {cfg?.emergencyActivatedBy ? ` (${cfg.emergencyActivatedBy})` : ''}
            </p>
          ) : plannedOn ? (
            <p className="mt-2 text-xs font-bold text-amber-800">일반 점검 모드가 켜져 있습니다. 긴급 전환 시 문구·모드가 바뀝니다.</p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {emergencyOn ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setDeactivateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            <ShieldOff size={16} />
            점검 해제
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-black text-white hover:bg-red-500 disabled:opacity-50 shadow-md"
          >
            <AlertTriangle size={16} />
            {busy ? '전환 중…' : '긴급 점검 모드 즉시 전환'}
          </button>
        )}
        <Link
          to="/admin/settings/server-maintenance"
          className="inline-flex items-center rounded-xl border border-red-200 bg-white/80 px-4 py-2.5 text-sm font-bold text-red-900 hover:bg-white"
        >
          상세 설정
        </Link>
      </div>
      <ActivateModal open={confirmOpen} busy={busy} onClose={() => setConfirmOpen(false)} onConfirm={handleActivate} />
      <DeactivateModal
        open={deactivateOpen}
        busy={busy}
        onClose={() => setDeactivateOpen(false)}
        onConfirm={handleDeactivate}
      />
    </div>
  )
}

function ActivateModal({ open, busy, onClose, onConfirm }) {
  return (
    <Modal isOpen={open} onClose={onClose} title="긴급 점검 모드 전환">
      {CONFIRM_BODY}
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
        >
          취소
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onConfirm()}
          className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white hover:bg-red-500 disabled:opacity-50"
        >
          {busy ? '전환 중…' : '즉시 전환'}
        </button>
      </div>
    </Modal>
  )
}

function DeactivateModal({ open, busy, onClose, onConfirm }) {
  return (
    <Modal isOpen={open} onClose={onClose} title="점검 모드 해제">
      {DEACTIVATE_BODY}
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
        >
          취소
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onConfirm()}
          className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? '해제 중…' : '해제'}
        </button>
      </div>
    </Modal>
  )
}
