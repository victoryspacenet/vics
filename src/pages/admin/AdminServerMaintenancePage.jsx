import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Flame, Save } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { EmergencyMaintenanceControl } from '../../components/admin/EmergencyMaintenanceControl'
import {
  datetimeLocalValueToIso,
  DEFAULT_SERVER_MAINTENANCE_MESSAGE,
  deactivateServerMaintenance,
  fetchServerMaintenanceConfig,
  isEmergencyMaintenance,
  isoToDatetimeLocalValue,
  MAINTENANCE_MODES,
  saveServerMaintenanceConfig,
} from '../../lib/serverMaintenance'

export function AdminServerMaintenancePage() {
  const { showToast } = useUIStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [message, setMessage] = useState(DEFAULT_SERVER_MAINTENANCE_MESSAGE)
  const [recoveryLocal, setRecoveryLocal] = useState('')
  const [mode, setMode] = useState('off')

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const cfg = await fetchServerMaintenanceConfig()
        setEnabled(cfg.enabled)
        setMode(cfg.mode)
        setMessage(cfg.message)
        setRecoveryLocal(isoToDatetimeLocalValue(cfg.expectedRecoveryAt))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      if (!enabled) {
        await deactivateServerMaintenance()
      } else {
        await saveServerMaintenanceConfig({
          enabled: true,
          mode: MAINTENANCE_MODES.planned,
          message: message.trim() || DEFAULT_SERVER_MAINTENANCE_MESSAGE,
          expectedRecoveryAt: datetimeLocalValueToIso(recoveryLocal),
          emergencyActivatedAt: null,
          emergencyActivatedBy: null,
        })
      }
      const cfg = await fetchServerMaintenanceConfig()
      setMode(cfg.mode)
      showToast(
        enabled
          ? isEmergencyMaintenance(cfg)
            ? '긴급 점검 설정이 반영됐어요.'
            : '서버 점검 화면이 켜졌어요. 일반 유저에게 안내가 표시됩니다.'
          : '서버 점검 모드가 꺼졌어요.',
        'success',
      )
    } catch (e) {
      showToast(e?.message || '저장에 실패했어요.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <Link
        to="/admin/settings"
        className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft size={16} />
        설정 센터
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 text-white">
          <Flame size={22} />
        </div>
        <div>
          <h1 className="text-xl font-black text-[#22282E]">서버 점검·다운 안내</h1>
          <p className="text-sm text-gray-500">일반 유저에게 표시되는 점검 화면과 복구 예정 시각</p>
        </div>
      </div>

      {!loading ? <EmergencyMaintenanceControl className="mb-5" /> : null}

      {loading ? (
        <p className="text-sm text-gray-500">불러오는 중…</p>
      ) : (
        <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          {mode === 'emergency' ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-800">
              긴급 점검 모드가 켜져 있습니다. 아래 「일반 점검」 저장 시 긴급 모드가 해제되고 예정 점검으로 전환됩니다.
            </p>
          ) : null}
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300"
            />
            <span>
              <span className="block text-sm font-black text-gray-900">점검 모드 켜기</span>
              <span className="mt-0.5 block text-xs text-gray-500">
                켜면 서버 응답과 관계없이 모든 일반 유저에게 점검 화면이 표시됩니다. (운영자 /admin 제외)
              </span>
            </span>
          </label>

          <div>
            <label className="mb-1.5 block text-sm font-bold text-gray-800">안내 문구</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              placeholder={DEFAULT_SERVER_MAINTENANCE_MESSAGE}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-bold text-gray-800">예상 복구 시각 (선택)</label>
            <input
              type="datetime-local"
              value={recoveryLocal}
              onChange={(e) => setRecoveryLocal(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
            <p className="mt-1.5 text-xs text-gray-500">
              비우면 「복구 예정 시각은 곧 안내」 문구가 표시됩니다. 서버가 실제로 응답하지 않을 때도 자동으로 같은
              화면이 뜹니다.
            </p>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? '저장 중…' : '저장'}
          </button>

          {import.meta.env.DEV ? (
            <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
              미리보기: 일반 페이지 URL에 <code className="text-gray-600">?maintenanceDemo=1</code> 추가
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
