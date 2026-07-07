import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { MainPagination } from '../../components/main/MainPagination'
import { Modal } from '../../components/ui/Modal'
import { useUIStore } from '../../store/uiStore'
import { cn } from '../../lib/utils'
import { countProfilesCreatedSince, countVotesCreatedSince, countWithdrawalsSince, fetchAdminMemberStats } from '../../lib/userAdminStorage'
import {
  fetchPendingModerationAlerts,
  resolveModerationAlert,
  MODERATION_ALERT_UPDATED,
} from '../../lib/matchupModerationAlerts'
import { EmergencyMaintenanceControl } from '../../components/admin/EmergencyMaintenanceControl'

const STATS_BASE = [
  {
    label: '전체 회원',
    value: null,
    unit: '명',
    color: 'border-slate-200 bg-slate-50',
    statKey: 'totalMembers',
    href: '/admin/users',
  },
  {
    label: '탈퇴 회원 (오늘)',
    value: null,
    unit: '명',
    color: 'border-gray-300 bg-gray-100',
    statKey: 'withdrawnToday',
  },
  { label: '신규 가입', value: null, unit: '명', color: 'border-violet-200 bg-violet-50', statKey: 'newSignupsToday' },
  { label: '오늘의 투표', value: null, unit: '표', color: 'border-emerald-200 bg-emerald-50', statKey: 'votesToday' },
  {
    label: '긴급신고',
    value: null,
    unit: '건',
    color: 'border-red-200 bg-red-50',
    badge: true,
    dynamicCount: true,
  },
]

const MONITORING_PAGE_SIZE = 5

const MONITORING_HEAD_ROW = 'border-b border-gray-300'
const MONITORING_BODY_ROW = 'border-b border-gray-200'

function formatToday() {
  const d = new Date()
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

const ACTION_MODAL = {
  keep: {
    title: '유지 처리',
    body: (
      <>
        <p className="text-sm leading-relaxed text-gray-700">
          AI 부적절 판정이 있었으나, 이 매치업을 <strong className="text-emerald-700">그대로 유지</strong>합니다.
        </p>
        <p className="mt-2 text-xs text-gray-500">진행하시겠습니까?</p>
      </>
    ),
    confirmClass:
      'flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700',
  },
  block: {
    title: '차단 처리',
    body: (
      <>
        <p className="text-sm leading-relaxed text-gray-700">
          해당 매치업을 <strong className="text-orange-700">종료(차단)</strong>합니다. 피드 노출이 중단됩니다.
        </p>
        <p className="mt-2 text-xs text-amber-800/90">되돌리려면 별도 복구 절차가 필요할 수 있습니다.</p>
      </>
    ),
    confirmClass:
      'flex-1 rounded-xl border-2 border-orange-500 bg-orange-50 px-4 py-2.5 text-sm font-bold text-orange-950 hover:bg-orange-100',
  },
  delete: {
    title: '삭제 확인',
    body: (
      <>
        <p className="text-sm leading-relaxed text-gray-700">
          이 매치업을 <strong className="text-red-700">영구 삭제</strong>합니다. 투표·댓글 등 관련 데이터가 함께 제거될 수 있어요.
        </p>
        <p className="mt-2 text-xs font-bold text-red-600">삭제 후에는 복구할 수 없습니다.</p>
      </>
    ),
    confirmClass:
      'flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700',
  },
  restore: {
    title: '목록에서 제거',
    body: (
      <>
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-900">
          확인 시 긴급 모니터링 목록에서만 제거됩니다. (유지 처리와 동일)
        </div>
        <p className="mt-3 text-sm leading-relaxed text-gray-700">
          이미 자동 몰수패·종료된 매치업일 수 있어요. 실제 매치업 상태는 상세에서 다시 확인해 주세요.
        </p>
      </>
    ),
    confirmClass:
      'flex-1 rounded-xl border-2 border-amber-500 bg-amber-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-600',
  },
}

export function AdminDashboardPage() {
  const { showToast } = useUIStore()
  const [confirmModal, setConfirmModal] = useState(null)
  const [monitoringItems, setMonitoringItems] = useState([])
  const [monitoringTotal, setMonitoringTotal] = useState(0)
  const [monitoringPage, setMonitoringPage] = useState(1)
  const [monitoringLoading, setMonitoringLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [newSignupsToday, setNewSignupsToday] = useState(null)
  const [votesToday, setVotesToday] = useState(null)
  const [totalMembers, setTotalMembers] = useState(null)
  const [withdrawnToday, setWithdrawnToday] = useState(null)

  const loadMonitoring = useCallback(async () => {
    setMonitoringLoading(true)
    try {
      const { rows, totalCount } = await fetchPendingModerationAlerts({
        page: monitoringPage,
        pageSize: MONITORING_PAGE_SIZE,
      })
      setMonitoringItems(rows)
      setMonitoringTotal(totalCount)
    } finally {
      setMonitoringLoading(false)
    }
  }, [monitoringPage])

  useEffect(() => {
    void loadMonitoring()
  }, [loadMonitoring])

  useEffect(() => {
    const onUpdate = () => void loadMonitoring()
    window.addEventListener(MODERATION_ALERT_UPDATED, onUpdate)
    return () => window.removeEventListener(MODERATION_ALERT_UPDATED, onUpdate)
  }, [loadMonitoring])

  useEffect(() => {
    let cancelled = false
    const start = new Date()
    start.setHours(0, 0, 0, 0)

    const loadSignups = () => {
      void countProfilesCreatedSince(start.toISOString()).then((n) => {
        if (!cancelled) setNewSignupsToday(n)
      })
    }

    const loadVotesToday = () => {
      void countVotesCreatedSince(start.toISOString()).then((n) => {
        if (!cancelled) setVotesToday(n)
      })
    }

    const loadWithdrawnToday = () => {
      void countWithdrawalsSince(start.toISOString()).then((n) => {
        if (!cancelled) setWithdrawnToday(n)
      })
    }

    const loadMemberStats = () => {
      void fetchAdminMemberStats().then((res) => {
        if (cancelled) return
        setTotalMembers(res.totalMembers)
      })
    }

    loadSignups()
    loadVotesToday()
    loadWithdrawnToday()
    loadMemberStats()
    const onUsers = () => {
      loadSignups()
      loadWithdrawnToday()
      loadMemberStats()
    }
    const onVote = () => loadVotesToday()
    window.addEventListener('vics:adminUsers:updated', onUsers)
    window.addEventListener('vics:tendency-vote-cast', onVote)
    const votePoll = setInterval(loadVotesToday, 60_000)
    return () => {
      cancelled = true
      window.removeEventListener('vics:adminUsers:updated', onUsers)
      window.removeEventListener('vics:tendency-vote-cast', onVote)
      clearInterval(votePoll)
    }
  }, [])

  const monitoringTotalPages = useMemo(() => {
    if (monitoringTotal === 0) return 0
    return Math.ceil(monitoringTotal / MONITORING_PAGE_SIZE)
  }, [monitoringTotal])

  const monitoringPageClamped = useMemo(() => {
    if (monitoringTotal === 0) return 1
    return Math.min(Math.max(1, monitoringPage), monitoringTotalPages)
  }, [monitoringTotal, monitoringPage, monitoringTotalPages])

  useEffect(() => {
    if (monitoringPage !== monitoringPageClamped) setMonitoringPage(monitoringPageClamped)
  }, [monitoringPage, monitoringPageClamped])

  const stats = useMemo(() => {
    return STATS_BASE.map((s) => {
      if (s.dynamicCount) {
        return { ...s, value: String(monitoringTotal) }
      }
      if (s.statKey === 'newSignupsToday' && newSignupsToday != null) {
        return { ...s, value: String(newSignupsToday) }
      }
      if (s.statKey === 'votesToday' && votesToday != null) {
        return { ...s, value: String(votesToday) }
      }
      if (s.statKey === 'totalMembers' && totalMembers != null) {
        return { ...s, value: String(totalMembers) }
      }
      if (s.statKey === 'withdrawnToday' && withdrawnToday != null) {
        return { ...s, value: String(withdrawnToday) }
      }
      return s
    })
  }, [monitoringTotal, newSignupsToday, votesToday, totalMembers, withdrawnToday])

  const closeModal = () => setConfirmModal(null)

  const handleConfirmAction = async () => {
    if (!confirmModal || actionLoading) return
    const { action, alertId, matchupId } = confirmModal
    const rpcAction = action === 'restore' ? 'keep' : action

    setActionLoading(true)
    try {
      const result = await resolveModerationAlert(alertId, rpcAction)
      if (!result?.ok) {
        showToast(result?.error || '처리에 실패했어요.', 'error')
        return
      }
      if (action === 'keep' || action === 'restore') {
        showToast(`매치업 ${matchupId} — 유지(목록 제거) 처리되었습니다.`, 'success')
      } else if (action === 'block') {
        showToast(`매치업 ${matchupId} — 차단(종료) 처리되었습니다.`, 'success')
      } else if (action === 'delete') {
        showToast(`매치업 ${matchupId} — 삭제 처리되었습니다.`, 'success')
      }
      setConfirmModal(null)
      await loadMonitoring()
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <EmergencyMaintenanceControl />
      <section>
        <h2 className="text-lg font-bold text-[#22282E] mb-4">
          실시간 현황 <span className="text-sm font-normal text-gray-500">({formatToday()})</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {stats.map((stat) => {
            const inner = (
              <>
                <p className="text-xs font-medium text-gray-600 mb-1">{stat.label}</p>
                <p className="text-2xl font-black text-[#22282E]">
                  {stat.value != null ? stat.value : <span className="text-gray-400">-</span>}
                  {stat.value != null && (
                    <span className="text-sm font-normal text-gray-500 ml-1">{stat.unit}</span>
                  )}
                </p>
                {stat.badge && monitoringTotal > 0 && (
                  <span className="inline-block mt-1 text-[10px] font-bold text-red-600">🔴</span>
                )}
              </>
            )
            const cardClass = `p-5 rounded-xl border ${stat.color}${stat.href ? ' transition-shadow hover:shadow-md' : ''}`

            if (stat.href) {
              return (
                <Link key={stat.label} to={stat.href} className={cardClass}>
                  {inner}
                </Link>
              )
            }
            return (
              <div key={stat.label} className={cardClass}>
                {inner}
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-[#22282E] mb-1">긴급 모니터링 (AI 부적절 판정 알림)</h2>
        <p className="text-xs text-gray-500 mb-4">
          B측 신고 5건+ AI 판정 · 저유사도 도전 시 Supabase 큐에 쌓입니다. SQL 마이그레이션(
          <code className="text-[11px]">supabase_matchup_moderation_alerts.sql</code>) 실행 후 반영됩니다.
        </p>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm border-collapse border-spacing-0">
              <thead>
                <tr className={`bg-gray-50 ${MONITORING_HEAD_ROW}`}>
                  <th className="px-4 py-3 text-left font-bold text-gray-600 w-[14%]">ID</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-600 w-[18%]">카테고리</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-600 w-[17%]">유사도</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-600 w-[17%]">상태</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-600 w-[34%]">액션</th>
                </tr>
              </thead>
              <tbody>
                {monitoringLoading ? (
                  <tr className={MONITORING_BODY_ROW}>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                    </td>
                  </tr>
                ) : monitoringItems.length === 0 ? (
                  <tr className={MONITORING_BODY_ROW}>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                      긴급 모니터링 항목이 없습니다.
                    </td>
                  </tr>
                ) : (
                  monitoringItems.map((row) => {
                    const isPending = !row.autoActioned
                    return (
                      <tr key={row.id} className={cn('hover:bg-gray-50/50', MONITORING_BODY_ROW)}>
                        <td className="px-4 py-3">
                          <Link
                            to={`/matchup/${row.matchupId}`}
                            className="font-semibold text-blue-600 underline-offset-2 hover:text-blue-800 hover:underline break-all"
                            title={row.title}
                          >
                            {String(row.matchupId).slice(0, 8)}…
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                            [{row.category}]
                          </span>
                        </td>
                        <td className="px-4 py-3">{row.similarityLabel}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${row.statusUi.color}`}
                          >
                            {row.statusUi.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {isPending ? (
                              <>
                                <button
                                  type="button"
                                  className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-bold hover:bg-emerald-200"
                                  onClick={() =>
                                    setConfirmModal({
                                      action: 'keep',
                                      alertId: row.id,
                                      matchupId: row.matchupId,
                                    })
                                  }
                                >
                                  유지
                                </button>
                                <button
                                  type="button"
                                  className="px-2 py-1 rounded-md border-2 border-orange-500 bg-orange-50 text-orange-900 text-xs font-bold hover:bg-orange-100"
                                  onClick={() =>
                                    setConfirmModal({
                                      action: 'block',
                                      alertId: row.id,
                                      matchupId: row.matchupId,
                                    })
                                  }
                                >
                                  차단
                                </button>
                                <button
                                  type="button"
                                  className="px-2 py-1 rounded-md bg-red-600 text-white text-xs font-bold shadow-sm hover:bg-red-700"
                                  onClick={() =>
                                    setConfirmModal({
                                      action: 'delete',
                                      alertId: row.id,
                                      matchupId: row.matchupId,
                                    })
                                  }
                                >
                                  삭제
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-bold hover:bg-emerald-200"
                                  onClick={() =>
                                    setConfirmModal({
                                      action: 'restore',
                                      alertId: row.id,
                                      matchupId: row.matchupId,
                                    })
                                  }
                                >
                                  목록 제거
                                </button>
                                <button
                                  type="button"
                                  className="px-2 py-1 rounded-md bg-red-600 text-white text-xs font-bold shadow-sm hover:bg-red-700"
                                  onClick={() =>
                                    setConfirmModal({
                                      action: 'delete',
                                      alertId: row.id,
                                      matchupId: row.matchupId,
                                    })
                                  }
                                >
                                  삭제
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {monitoringTotal > 0 && monitoringTotalPages > 1 && (
            <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-500">
                총 <span className="font-bold text-gray-700">{monitoringTotal}</span>건
              </p>
              <MainPagination
                current={monitoringPageClamped}
                total={monitoringTotalPages}
                onPage={setMonitoringPage}
              />
            </div>
          )}
        </div>
      </section>

      <Modal
        isOpen={!!confirmModal}
        onClose={closeModal}
        title={confirmModal ? ACTION_MODAL[confirmModal.action].title : ''}
        className="border border-gray-200 shadow-2xl"
      >
        {confirmModal && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              매치업 ID:{' '}
              <span className="font-mono font-semibold text-gray-800">{confirmModal.matchupId}</span>
            </p>
            <div>{ACTION_MODAL[confirmModal.action].body}</div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={closeModal}
                disabled={actionLoading}
                className="flex-1 rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmAction()}
                disabled={actionLoading}
                className={cn(ACTION_MODAL[confirmModal.action].confirmClass, 'disabled:opacity-50')}
              >
                {actionLoading ? '처리 중…' : '확인'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
