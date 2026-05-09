import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChevronLeft, CheckCircle, AlertTriangle, XCircle, UserX, EyeOff, RotateCcw } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { cn } from '../../lib/utils'
import {
  getMatchupDetail,
  updateMatchupStatus,
  recordMatchupAdminWarningSent,
  recordMatchupAdminSuspensionSent,
  getReportedParticipantUserIdsForWarning,
} from '../../lib/matchupsAdminStorage'
import { applyMatchupAdminUserSuspension, sendWarning } from '../../lib/warnSanctionStorage'
import { Modal } from '../../components/ui/Modal'
import { VsBadge } from '../../components/ui/VsBadge'

const STATUS_LABEL = {
  active: '진행 중',
  review: '검토 대기',
  ended: '종료',
  blocked: '차단',
}

const ADMIN_ACTION_MODAL = {
  approve: {
    title: '유지/승인',
    warning: '이 매치업을 정상 노출 상태(진행 중)로 승인합니다.',
    detail: '신고·AI 판정 내용을 검토했으며, 커뮤니티 가이드에 부합한다고 판단한 경우에만 진행하세요.',
    confirmLabel: '승인',
    confirmClass:
      'flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700',
  },
  warn: {
    title: '경고쪽지',
    warning: '신고가 접수된 작성자에게만 경고쪽지를 발송합니다.',
    detail:
      '한쪽만 신고된 경우 해당 작성자에게만 발송되며, 양쪽 모두 신고된 경우에는 USER A·B 모두에게 발송됩니다. 확인 시 경고 이력·매치업 발송 로그에 기록됩니다.',
    confirmLabel: '발송',
    confirmClass:
      'flex-1 rounded-xl border-2 border-amber-500 bg-amber-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-600',
  },
  end: {
    title: '강제 종료',
    warning: '이 매치업을 즉시 종료합니다.',
    detail: '종료 후에는 더 이상 투표할 수 없으며, 필요 시 목록에서 상태를 확인할 수 있어요.',
    confirmLabel: '강제 종료',
    confirmClass:
      'flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700',
  },
  suspend: {
    title: '유저 정지',
    warning: '신고가 접수된 작성자에게만 투표·댓글·매치업 생성 제한(기본 7일)을 적용합니다.',
    detail:
      '확인 시 사용자별 경고 이력과 Supabase 이용 제한에 기록됩니다. 양쪽 모두 신고된 경우 USER A·B 모두에게 적용됩니다.',
    confirmLabel: '적용',
    confirmClass:
      'flex-1 rounded-xl bg-gray-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-gray-700',
  },
  block: {
    title: '블라인드/차단',
    warning: '이 매치업을 블라인드(목록 비노출) 및 차단 상태로 전환합니다.',
    detail: '사용자에게 노출되지 않으며, 상태는 목록에서 차단으로 표시됩니다. 되돌리려면 별도 복구 절차가 필요할 수 있어요.',
    confirmLabel: '블라인드/차단',
    confirmClass:
      'flex-1 rounded-xl bg-rose-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-900',
  },
  restore: {
    title: '차단 해제(복구)',
    warning: '이 매치업의 블라인드·차단을 해제하고 진행 중 상태로 되돌립니다.',
    detail: '피드 등에 다시 노출될 수 있어요. 복구 전 신고·AI 판정 내용을 다시 확인해 주세요.',
    confirmLabel: '복구',
    confirmClass:
      'flex-1 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-700',
  },
}

export function AdminMatchupDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useUIStore()
  const [matchup, setMatchup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirmAction, setConfirmAction] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void getMatchupDetail(id).then((m) => {
      if (!cancelled) {
        setMatchup(m)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <div className="max-w-3xl w-full px-3 sm:px-0 py-8">
        <p className="text-gray-500">불러오는 중…</p>
      </div>
    )
  }

  if (!matchup) {
    return (
      <div className="max-w-3xl w-full px-3 sm:px-0">
        <p className="text-gray-500">매치업을 찾을 수 없어요.</p>
        <Link to="/admin/matchups" className="mt-4 inline-block text-emerald-600 font-bold hover:underline">
          목록으로
        </Link>
      </div>
    )
  }

  const statusLabel = STATUS_LABEL[matchup.status] ?? matchup.status
  const isReported = matchup.reports > 0 && matchup.status === 'review'
  const isBlocked = matchup.status === 'blocked'

  const closeModal = () => setConfirmAction(null)

  const executeAction = async (action) => {
    switch (action) {
      case 'approve':
        await updateMatchupStatus(matchup.id, 'active')
        showToast('매치업이 유지/승인됐어요.', 'success')
        navigate('/admin/matchups')
        break
      case 'warn': {
        const recipients = getReportedParticipantUserIdsForWarning(matchup)
        if (recipients.length === 0) {
          showToast('신고 접수된 작성자가 없어 경고쪽지를 보낼 수 없어요.', 'error')
          break
        }
        const msg = `매치업 #${matchup.id} 「${matchup.title}」에 대한 관리자 경고입니다. 커뮤니티 가이드를 준수해 주세요.`
        const payload = {
          reasonId: 'etc',
          reasonLabel: '매치업 관리자 경고',
          message: msg,
          restrictions: [],
        }
        for (const userId of recipients) {
          await sendWarning(userId, payload)
        }
        await recordMatchupAdminWarningSent(matchup.id, {
          title: matchup.title,
          recipientUserIds: recipients,
        })
        const n = recipients.length
        showToast(
          n === 2
            ? '경고쪽지를 USER A·B 모두에게 발송·기록했어요.'
            : `경고쪽지를 ${n}명에게 발송·기록했어요.`,
          'success'
        )
        break
      }
      case 'end':
        await updateMatchupStatus(matchup.id, 'ended')
        showToast('매치업이 강제 종료됐어요.', 'success')
        navigate('/admin/matchups')
        break
      case 'suspend': {
        const recipients = getReportedParticipantUserIdsForWarning(matchup)
        if (recipients.length === 0) {
          showToast('신고 접수된 작성자가 없어 유저 정지를 적용할 수 없어요.', 'error')
          break
        }
        await applyMatchupAdminUserSuspension({
          recipientUserIds: recipients,
          matchupId: matchup.id,
          title: matchup.title,
        })
        await recordMatchupAdminSuspensionSent(matchup.id, {
          title: matchup.title,
          recipientUserIds: recipients,
        })
        const sn = recipients.length
        showToast(
          sn === 2
            ? 'USER A·B에게 유저 정지(제한)를 적용·기록했어요.'
            : `${sn}명에게 유저 정지(제한)를 적용·기록했어요.`,
          'success'
        )
        break
      }
      case 'block':
        await updateMatchupStatus(matchup.id, 'blocked')
        showToast('매치업이 블라인드·차단 처리됐어요.', 'success')
        navigate('/admin/matchups')
        break
      case 'restore':
        await updateMatchupStatus(matchup.id, 'active')
        showToast('매치업 차단을 해제·복구했어요.', 'success')
        navigate('/admin/matchups')
        break
      default:
        break
    }
  }

  const handleConfirmModal = async () => {
    if (!confirmAction) return
    await executeAction(confirmAction)
    setConfirmAction(null)
  }

  return (
    <div className="max-w-3xl w-full px-3 sm:px-0">
      {/* 헤더 - 모바일: 세로 스택, 데스크톱: 가로 */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            to="/admin/matchups"
            className="p-2 sm:p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 shrink-0 touch-manipulation"
            aria-label="목록으로"
          >
            <ChevronLeft size={24} className="sm:w-[22px] sm:h-[22px]" />
          </Link>
          <h1 className="text-base sm:text-xl font-black text-[#22282E] truncate">
            매치업 상세 검토 (ID: #{matchup.id})
          </h1>
        </div>
        <span
          className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-bold ${
            isReported ? 'bg-amber-100 text-amber-700' :
            matchup.status === 'active' ? 'bg-blue-100 text-blue-700' :
            matchup.status === 'ended' ? 'bg-gray-100 text-gray-700' :
            'bg-red-100 text-red-700'
          }`}
        >
          상태: {statusLabel}
        </span>
      </div>

      {/* User A vs User B - 모바일: 세로 스택, 데스크톱: 3열 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4 sm:mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 sm:gap-4 p-4 sm:p-6 items-stretch">
          <div className="flex flex-col items-center p-4 rounded-xl bg-gray-50 border border-gray-100">
            <p className="text-xs font-bold text-gray-500 mb-2">USER A</p>
            <p className="text-base font-black text-[#22282E] mb-3 truncate max-w-full">{matchup.userA?.name ?? '-'}</p>
            <div className="w-full aspect-square max-w-[120px] sm:max-w-[140px] rounded-xl overflow-hidden bg-gray-200 mb-3">
              <img
                src={matchup.userA?.imageUrl ?? '/logo.png'}
                alt={matchup.userA?.name}
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-sm font-medium text-gray-600 text-center break-words max-w-full">"{matchup.userA?.title ?? '-'}"</p>
          </div>
          <div className="flex items-center justify-center sm:justify-center py-2 sm:py-0">
            <VsBadge size="lg" />
          </div>
          <div className="flex flex-col items-center p-4 rounded-xl bg-gray-50 border border-gray-100">
            <p className="text-xs font-bold text-gray-500 mb-2">USER B</p>
            <p className="text-base font-black text-[#22282E] mb-3 truncate max-w-full">{matchup.userB?.name ?? '-'}</p>
            <div className="w-full aspect-square max-w-[120px] sm:max-w-[140px] rounded-xl overflow-hidden bg-gray-200 mb-3">
              <img
                src={matchup.userB?.imageUrl ?? '/logo.png'}
                alt={matchup.userB?.name}
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-sm font-medium text-gray-600 text-center break-words max-w-full">"{matchup.userB?.title ?? '-'}"</p>
          </div>
        </div>
      </div>

      {/* AI 판정 결과 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4 sm:mb-6">
        <h3 className="px-4 py-3 bg-gray-50 border-b border-gray-100 text-sm font-bold text-[#22282E]">
          AI 판정 결과
        </h3>
        <div className="p-4 space-y-2">
          <p className="text-sm text-gray-600 break-words">
            <strong>유사도 점수:</strong> {matchup.aiVerdict?.score ?? 0}점 ({matchup.aiVerdict?.label ?? '-'})
          </p>
          <p className="text-sm text-gray-600 break-words">
            <strong>판정 사유:</strong> {matchup.aiVerdict?.reason ?? '-'}
          </p>
        </div>
      </div>

      {/* 관리자 조치 - 모바일: 2x2 그리드 큰 터치 영역 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4 sm:mb-6">
        <h3 className="px-4 py-3 bg-gray-50 border-b border-gray-100 text-sm font-bold text-[#22282E]">
          관리자 조치
        </h3>
        <div className="p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:justify-center gap-2 sm:gap-3">
          {!isBlocked && (
            <button
              type="button"
              onClick={() => setConfirmAction('approve')}
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 sm:py-2.5 rounded-xl bg-emerald-100 text-emerald-700 text-xs sm:text-sm font-bold hover:bg-emerald-200 active:scale-[0.98] transition-all touch-manipulation min-h-[44px]"
            >
              <CheckCircle size={18} className="shrink-0" />
              <span>유지/승인</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmAction('warn')}
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 sm:py-2.5 rounded-xl bg-amber-100 text-amber-700 text-xs sm:text-sm font-bold hover:bg-amber-200 active:scale-[0.98] transition-all touch-manipulation min-h-[44px]"
          >
            <AlertTriangle size={18} className="shrink-0" />
            <span>경고쪽지</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmAction('end')}
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 sm:py-2.5 rounded-xl bg-red-100 text-red-700 text-xs sm:text-sm font-bold hover:bg-red-200 active:scale-[0.98] transition-all touch-manipulation min-h-[44px]"
          >
            <XCircle size={18} className="shrink-0" />
            <span>강제종료</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmAction('suspend')}
            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 sm:py-2.5 rounded-xl bg-gray-700 text-white text-xs sm:text-sm font-bold hover:bg-gray-600 active:scale-[0.98] transition-all touch-manipulation min-h-[44px]"
          >
            <UserX size={18} className="shrink-0" />
            <span>유저정지</span>
          </button>
          {isBlocked ? (
            <button
              type="button"
              onClick={() => setConfirmAction('restore')}
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 sm:py-2.5 rounded-xl bg-sky-100 text-sky-800 border-2 border-sky-300 text-xs sm:text-sm font-bold hover:bg-sky-200 active:scale-[0.98] transition-all touch-manipulation min-h-[44px] col-span-2 sm:col-span-1 lg:col-auto"
            >
              <RotateCcw size={18} className="shrink-0" />
              <span>복구 (차단 해제)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmAction('block')}
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 sm:py-2.5 rounded-xl border-2 border-rose-800/80 bg-rose-950 text-white text-xs sm:text-sm font-bold hover:bg-rose-900 active:scale-[0.98] transition-all touch-manipulation min-h-[44px] col-span-2 sm:col-span-1 lg:col-auto"
            >
              <EyeOff size={18} className="shrink-0" />
              <span>블라인드/차단</span>
            </button>
          )}
        </div>
      </div>

      {/* 확인 (목록으로) — 모바일: 컴팩트+터치 여유, sm+: 원래 크기 */}
      <div className="flex justify-center pb-6 sm:pb-0">
        <Link
          to="/admin/matchups"
          className="inline-flex w-1/2 max-w-[10rem] items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-center text-xs font-bold text-white transition-all hover:bg-emerald-700 active:scale-[0.98] touch-manipulation sm:w-auto sm:min-w-[13rem] sm:max-w-none sm:rounded-xl sm:px-12 sm:py-3 sm:text-sm"
        >
          확인
        </Link>
      </div>

      <Modal
        isOpen={!!confirmAction}
        onClose={closeModal}
        title={confirmAction ? ADMIN_ACTION_MODAL[confirmAction].title : ''}
        className="border border-gray-200 shadow-2xl"
      >
        {confirmAction && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              매치업 ID:{' '}
              <span className="font-mono font-semibold text-gray-800">#{matchup.id}</span>
            </p>
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-950">
              ⚠️ {ADMIN_ACTION_MODAL[confirmAction].warning}
            </div>
            <p className="text-sm leading-relaxed text-gray-700">
              {ADMIN_ACTION_MODAL[confirmAction].detail}
            </p>
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
                onClick={handleConfirmModal}
                className={cn(ADMIN_ACTION_MODAL[confirmAction].confirmClass)}
              >
                {ADMIN_ACTION_MODAL[confirmAction].confirmLabel}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
