import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MainPagination } from '../../components/main/MainPagination'
import { Modal } from '../../components/ui/Modal'
import { useUIStore } from '../../store/uiStore'
import { cn } from '../../lib/utils'

const STATS_BASE = [
  { label: '진행중 매치업', value: null, unit: '건', color: 'border-blue-200 bg-blue-50' },
  { label: '오늘의 투표', value: null, unit: '표', color: 'border-emerald-200 bg-emerald-50' },
  { label: '신규 가입', value: null, unit: '명', color: 'border-violet-200 bg-violet-50' },
  { label: '긴급신고', value: null, unit: '건', color: 'border-red-200 bg-red-50', badge: true, dynamicCount: true },
]

/** 가상 매치업 ID — 클릭 시 `/matchup/:matchupId` 이동 (DB에 없으면 상세에서 오류/빈 화면 가능) */
const INITIAL_MONITORING_ITEMS = [
  { matchupId: '910001', category: 'OOTD',   similarity: 15, similarityLabel: '15% ⚠️', status: '검토대기', statusColor: 'bg-amber-100 text-amber-700' },
  { matchupId: '910002', category: '음식',   similarity: 5,  similarityLabel: '05% 🚨', status: '즉시차단', statusColor: 'bg-red-100 text-red-700' },
  { matchupId: '910003', category: '연예',   similarity: 22, similarityLabel: '22% ⚠️', status: '검토대기', statusColor: 'bg-amber-100 text-amber-700' },
  { matchupId: '910004', category: '게임',   similarity: 8,  similarityLabel: '08% 🚨', status: '즉시차단', statusColor: 'bg-red-100 text-red-700' },
  { matchupId: '910005', category: '스포츠', similarity: 31, similarityLabel: '31% ⚠️', status: '검토대기', statusColor: 'bg-amber-100 text-amber-700' },
]

const MONITORING_PAGE_SIZE = 5

/** 긴급 모니터링 테이블 — 가로줄만 (세로선 없음) */
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
          해당 매치업을 <strong className="text-orange-700">차단</strong>합니다. 작성자·노출에 제한이 적용될 수 있어요.
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
    title: '복구 경고',
    body: (
      <>
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-900">
          ⚠️ 확인 시 이 항목이 긴급 모니터링 목록에서 제거됩니다.
        </div>
        <p className="mt-3 text-sm leading-relaxed text-gray-700">
          차단·신고 이력이 있었을 수 있어요. <strong className="text-amber-800">목록에서만 사라지며</strong>, 실제 매치업 노출·제재 상태는 별도 확인이 필요할 수 있습니다.
        </p>
        <p className="mt-2 text-xs text-amber-800/90">진행하시겠습니까?</p>
      </>
    ),
    confirmClass:
      'flex-1 rounded-xl border-2 border-amber-500 bg-amber-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-600',
  },
}

export function AdminDashboardPage() {
  const { showToast } = useUIStore()
  const [confirmModal, setConfirmModal] = useState(null)
  const [monitoringItems, setMonitoringItems] = useState(() => [...INITIAL_MONITORING_ITEMS])
  const [monitoringPage, setMonitoringPage] = useState(1)

  const monitoringTotalPages = useMemo(() => {
    if (monitoringItems.length === 0) return 0
    return Math.ceil(monitoringItems.length / MONITORING_PAGE_SIZE)
  }, [monitoringItems.length])

  const monitoringPageClamped = useMemo(() => {
    if (monitoringItems.length === 0) return 1
    return Math.min(Math.max(1, monitoringPage), monitoringTotalPages)
  }, [monitoringItems.length, monitoringPage, monitoringTotalPages])

  useEffect(() => {
    if (monitoringPage !== monitoringPageClamped) setMonitoringPage(monitoringPageClamped)
  }, [monitoringPage, monitoringPageClamped])

  const pagedMonitoringItems = useMemo(() => {
    if (monitoringItems.length === 0) return []
    const start = (monitoringPageClamped - 1) * MONITORING_PAGE_SIZE
    return monitoringItems.slice(start, start + MONITORING_PAGE_SIZE)
  }, [monitoringItems, monitoringPageClamped])

  const stats = useMemo(() => {
    return STATS_BASE.map((s) => {
      if (s.dynamicCount) {
        return { ...s, value: String(monitoringItems.length) }
      }
      return s
    })
  }, [monitoringItems.length])

  const closeModal = () => setConfirmModal(null)

  const handleConfirmAction = () => {
    if (!confirmModal) return
    const { action, matchupId } = confirmModal

    if (action === 'keep') {
      showToast(`매치업 ${matchupId} — 유지 처리되었습니다.`, 'success')
      setMonitoringItems((prev) => prev.filter((r) => r.matchupId !== matchupId))
    } else if (action === 'block') {
      showToast(`매치업 ${matchupId} — 차단 처리되었습니다.`, 'success')
      setMonitoringItems((prev) =>
        prev.map((r) =>
          r.matchupId === matchupId
            ? { ...r, status: '즉시차단', statusColor: 'bg-red-100 text-red-700' }
            : r
        )
      )
    } else if (action === 'delete') {
      showToast(`매치업 ${matchupId} — 삭제 처리되었습니다.`, 'success')
      setMonitoringItems((prev) => prev.filter((r) => r.matchupId !== matchupId))
    } else if (action === 'restore') {
      showToast(`매치업 ${matchupId} — 복구 처리되었습니다.`, 'success')
      setMonitoringItems((prev) => prev.filter((r) => r.matchupId !== matchupId))
    }
    setConfirmModal(null)
  }

  return (
    <div className="space-y-6">
      {/* 실시간 현황 */}
      <section>
        <h2 className="text-lg font-bold text-[#22282E] mb-4">
          실시간 현황 <span className="text-sm font-normal text-gray-500">({formatToday()})</span>
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={`p-5 rounded-xl border ${stat.color}`}
            >
              <p className="text-xs font-medium text-gray-600 mb-1">{stat.label}</p>
              <p className="text-2xl font-black text-[#22282E]">
                {stat.value != null ? stat.value : <span className="text-gray-400">-</span>}
                {stat.value != null && (
                  <span className="text-sm font-normal text-gray-500 ml-1">{stat.unit}</span>
                )}
              </p>
              {stat.badge && (
                <span className="inline-block mt-1 text-[10px] font-bold text-red-600">🔴</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 긴급 모니터링 */}
      <section>
        <h2 className="text-lg font-bold text-[#22282E] mb-4">긴급 모니터링 (AI 부적절 판정 알림)</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm border-collapse border-spacing-0">
              <thead>
                <tr className={`bg-gray-50 ${MONITORING_HEAD_ROW}`}>
                  <th className="px-4 py-3 text-left font-bold text-gray-600 w-[14%]">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left font-bold text-gray-600 w-[18%]">
                    카테고리
                  </th>
                  <th className="px-4 py-3 text-left font-bold text-gray-600 w-[17%]">
                    유사도
                  </th>
                  <th className="px-4 py-3 text-left font-bold text-gray-600 w-[17%]">
                    상태
                  </th>
                  <th className="px-4 py-3 text-left font-bold text-gray-600 w-[34%]">
                    액션
                  </th>
                </tr>
              </thead>
              <tbody>
                {monitoringItems.length === 0 && (
                  <tr className={MONITORING_BODY_ROW}>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-sm text-gray-500"
                    >
                      긴급 모니터링 항목이 없습니다.
                    </td>
                  </tr>
                )}
                {pagedMonitoringItems.map((row) => (
                  <tr key={row.matchupId} className={cn('hover:bg-gray-50/50', MONITORING_BODY_ROW)}>
                    <td className="px-4 py-3">
                      <Link
                        to={`/matchup/${row.matchupId}`}
                        className="font-semibold text-blue-600 underline-offset-2 hover:text-blue-800 hover:underline"
                      >
                        {row.matchupId}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">[{row.category}]</span>
                    </td>
                    <td className="px-4 py-3">
                      {row.similarityLabel}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${row.statusColor}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {row.status === '검토대기' ? (
                          <>
                            <button
                              type="button"
                              className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-bold hover:bg-emerald-200"
                              onClick={() => setConfirmModal({ action: 'keep', matchupId: row.matchupId })}
                            >
                              유지
                            </button>
                            <button
                              type="button"
                              className="px-2 py-1 rounded-md border-2 border-orange-500 bg-orange-50 text-orange-900 text-xs font-bold hover:bg-orange-100"
                              onClick={() => setConfirmModal({ action: 'block', matchupId: row.matchupId })}
                            >
                              차단
                            </button>
                            <button
                              type="button"
                              className="px-2 py-1 rounded-md bg-red-600 text-white text-xs font-bold shadow-sm hover:bg-red-700"
                              onClick={() => setConfirmModal({ action: 'delete', matchupId: row.matchupId })}
                            >
                              삭제
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-bold hover:bg-emerald-200"
                              onClick={() => setConfirmModal({ action: 'restore', matchupId: row.matchupId })}
                            >
                              복구
                            </button>
                            <button
                              type="button"
                              className="px-2 py-1 rounded-md bg-red-600 text-white text-xs font-bold shadow-sm hover:bg-red-700"
                              onClick={() => setConfirmModal({ action: 'delete', matchupId: row.matchupId })}
                            >
                              삭제
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {monitoringItems.length > 0 && monitoringTotalPages > 1 && (
            <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-500">
                총 <span className="font-bold text-gray-700">{monitoringItems.length}</span>건 ·{' '}
                <span className="font-mono tabular-nums">
                  {(monitoringPageClamped - 1) * MONITORING_PAGE_SIZE + 1}
                </span>
                –
                <span className="font-mono tabular-nums">
                  {Math.min(monitoringPageClamped * MONITORING_PAGE_SIZE, monitoringItems.length)}
                </span>
                번째 항목
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
              매치업 ID: <span className="font-mono font-semibold text-gray-800">{confirmModal.matchupId}</span>
            </p>
            <div>{ACTION_MODAL[confirmModal.action].body}</div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className={cn(ACTION_MODAL[confirmModal.action].confirmClass)}
              >
                확인
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
