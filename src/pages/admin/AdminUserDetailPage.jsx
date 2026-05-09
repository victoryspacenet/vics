import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  MessageCircle,
  Clock,
  Ban,
  Coins,
  RotateCcw,
  User,
  Mail,
  Calendar,
  BarChart3,
  AlertTriangle,
  ClipboardList,
  Shield,
} from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { Modal } from '../../components/ui/Modal'
import { Avatar } from '../../components/ui/Avatar'
import { WarnSanctionModal } from '../../components/admin/WarnSanctionModal'
import { cn } from '../../lib/utils'
import {
  getUserDetail,
  updateUserStatus,
  addAdminMemo,
  getAdminMemos,
  revokeActivityPoints,
  REVOKE_POINTS_MODES,
} from '../../lib/userAdminStorage'
import { getWarningHistory } from '../../lib/warnSanctionStorage'

const STATUS_LABEL = {
  active: '활성',
  caution: '활동 주의',
  suspended: '정지',
  blocked: '차단',
  withdrawn: '탈퇴',
}

function statusBadgeClass(status) {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-800 ring-emerald-200/80'
    case 'caution':
      return 'bg-amber-100 text-amber-900 ring-amber-200/80'
    case 'suspended':
      return 'bg-red-100 text-red-800 ring-red-200/80'
    case 'blocked':
      return 'bg-neutral-900 text-white ring-neutral-700/80'
    default:
      return 'bg-gray-100 text-gray-700 ring-gray-200/80'
  }
}

function SectionCard({ icon: Icon, title, subtitle, children, className }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-gray-200/90 bg-white shadow-sm overflow-hidden',
        className
      )}
    >
      <div className="px-4 py-3.5 sm:px-5 bg-gradient-to-r from-slate-50/95 via-white to-emerald-50/40 border-b border-gray-100/90">
        <div className="flex items-start gap-3">
          {Icon && (
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100/90 text-emerald-700 shadow-sm ring-1 ring-emerald-200/50">
              <Icon size={18} strokeWidth={2.25} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black tracking-tight text-[#22282E]">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs font-medium text-gray-500">{subtitle}</p>}
          </div>
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  )
}

function InfoRow({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 py-3 first:pt-0 last:pb-0 border-b border-gray-100/90 last:border-0">
      <span className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</span>
      <div className="text-sm font-semibold text-[#22282E] sm:text-right">{children}</div>
    </div>
  )
}

export function AdminUserDetailPage() {
  const { id } = useParams()
  const { showToast } = useUIStore()
  const [user, setUser] = useState(null)
  const [memos, setMemos] = useState([])
  const [newMemo, setNewMemo] = useState('')
  const [banConfirmOpen, setBanConfirmOpen] = useState(false)
  const [suspend7ConfirmOpen, setSuspend7ConfirmOpen] = useState(false)
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false)
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false)
  const [revokeAmount, setRevokeAmount] = useState('')
  const [revokeMode, setRevokeMode] = useState('vote_only')
  const [warnModalOpen, setWarnModalOpen] = useState(false)
  const [sanctionRefreshKey, setSanctionRefreshKey] = useState(0)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      try {
        const u = await getUserDetail(id)
        const memoList = await getAdminMemos(id)
        if (!cancelled) {
          setUser(u)
          setMemos(memoList)
        }
      } catch (err) {
        console.error('[AdminUserDetail]', err)
        if (!cancelled) {
          setUser(null)
          setMemos([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  const [displaySanctions, setDisplaySanctions] = useState([])

  useEffect(() => {
    if (!user?.id) {
      setDisplaySanctions([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const base = Array.isArray(user?.sanctions) ? user.sanctions : []
        const warnings = (await getWarningHistory(user.id)).map((w) => ({
          date: w?.date ?? '',
          text: `경고 발송: ${w?.reasonLabel ?? '(사유)'}`,
        }))
        const merged = [...base, ...warnings].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        if (!cancelled) setDisplaySanctions(merged)
      } catch {
        if (!cancelled) setDisplaySanctions(Array.isArray(user?.sanctions) ? user.sanctions : [])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id, user?.sanctions, sanctionRefreshKey])

  if (!user) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
          <User size={28} />
        </div>
        <p className="text-sm font-semibold text-gray-700">유저를 찾을 수 없어요.</p>
        <p className="mt-1 text-xs text-gray-500">목록에서 다시 선택해 주세요.</p>
        <Link
          to="/admin/users"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
        >
          유저 목록으로
        </Link>
      </div>
    )
  }

  const handleSaveMemo = async () => {
    if (!newMemo.trim()) {
      showToast('메모를 입력해주세요.', 'error')
      return
    }
    if (!(await addAdminMemo(user.id, newMemo))) return
    setMemos(await getAdminMemos(user.id))
    setNewMemo('')
    showToast('메모가 추가됐어요.', 'success')
  }

  const handleAction = async (action) => {
    switch (action) {
      case 'restore':
        setRestoreConfirmOpen(false)
        await updateUserStatus(user.id, 'active')
        showToast('계정이 복구됐어요.', 'success')
        setUser((prev) => ({ ...prev, status: 'active' }))
        break
      case 'warn':
        setWarnModalOpen(true)
        break
      case 'suspend7':
        await updateUserStatus(user.id, 'suspended')
        setSuspend7ConfirmOpen(false)
        showToast('7일 정지 처리됐어요.', 'success')
        setUser((prev) => ({ ...prev, status: 'suspended' }))
        break
      case 'ban':
        await updateUserStatus(user.id, 'blocked')
        setBanConfirmOpen(false)
        showToast('영구 차단 처리됐어요.', 'success')
        setUser((prev) => ({ ...prev, status: 'blocked' }))
        break
      default:
        break
    }
  }

  const statusLabel = STATUS_LABEL[user.status] ?? user.status

  const activityPointsSum =
    (user.voteParticipationPoints ?? 0) + (user.matchupResultPoints ?? 0)
  const profilePoints =
    activityPointsSum > 0 ? activityPointsSum : (typeof user.points === 'number' ? user.points : 0)

  const handleRevokePoints = async () => {
    const raw = String(revokeAmount).replace(/,/g, '').trim()
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) {
      showToast('회수할 포인트를 1 이상 숫자로 입력해 주세요.', 'error')
      return
    }
    const res = await revokeActivityPoints(user.id, n, revokeMode)
    if (!res.ok) {
      showToast('포인트 회수에 실패했어요.', 'error')
      return
    }
    if (res.revoked === 0) {
      showToast('회수할 수 있는 포인트가 없어요.', 'info')
      setRevokeConfirmOpen(false)
      setRevokeAmount('')
      setRevokeMode('vote_only')
      return
    }
    setRevokeConfirmOpen(false)
    setRevokeAmount('')
    setRevokeMode('vote_only')
    showToast(
      `${res.revoked.toLocaleString()}P를 회수했어요. (잔여 ${res.totalAfter.toLocaleString()}P)`,
      'success'
    )
    const refreshed = await getUserDetail(id)
    if (refreshed) setUser(refreshed)
  }

  const handleWarnSuccess = async () => {
    showToast('경고가 발송되었어요. (푸시·제한·주의 상태 반영)', 'success')
    setSanctionRefreshKey((k) => k + 1)
    const refreshed = await getUserDetail(id)
    if (refreshed) setUser(refreshed)
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-3 pb-10 sm:px-0">
      {/* 히어로 */}
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/95 via-white to-teal-50/60 shadow-sm ring-1 ring-emerald-100/60">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-200/25 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-teal-200/20 blur-2xl" />
        <div className="relative p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Link
              to="/admin/users"
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200/80 bg-white/80 px-2.5 py-1.5 text-xs font-bold text-emerald-800 shadow-sm backdrop-blur-sm hover:bg-white"
              aria-label="목록으로"
            >
              <ChevronLeft size={18} className="text-emerald-700" />
              유저 관리
            </Link>
          </div>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 gap-4">
              <Avatar
                size="xl"
                alt={user.nickname}
                className="ring-4 ring-white shadow-md ring-offset-2 ring-offset-emerald-50/50"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700/80">
                  유저 상세 프로필
                </p>
                <h1 className="mt-1 truncate text-xl font-black tracking-tight text-[#22282E] sm:text-2xl">
                  {user.nickname}
                </h1>
                {user.email && (
                  <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-gray-600">
                    <Mail size={14} className="shrink-0 text-gray-400" />
                    {user.email}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ring-1',
                      statusBadgeClass(user.status)
                    )}
                  >
                    <Shield size={12} strokeWidth={2.5} />
                    {statusLabel}
                  </span>
                  {user.joinedAt && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-bold text-gray-600 ring-1 ring-gray-200/80">
                      <Calendar size={11} />
                      가입 {user.joinedAt}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard icon={User} title="회원 정보" subtitle="기본 프로필 및 연동">
          <div>
            <InfoRow label="닉네임">{user.nickname}</InfoRow>
            <InfoRow label="소셜 로그인">{user.social ?? '—'}</InfoRow>
            <InfoRow label="포인트 합계">
              <span className="tabular-nums">{profilePoints.toLocaleString()}P</span>
            </InfoRow>
            <InfoRow label="신고 받은 수">
              <span
                className={
                  (user.reportsCount ?? 0) >= 10 ? 'font-bold text-red-600 tabular-nums' : 'tabular-nums'
                }
              >
                {(user.reportsCount ?? 0).toLocaleString()}건
              </span>
            </InfoRow>
          </div>
        </SectionCard>

        <SectionCard icon={BarChart3} title="활동 통계" subtitle="생성·투표 활동 요약">
          <div className="space-y-4">
            <div className="rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-3 sm:px-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-sky-800/80">
                매치업 · 생성
              </p>
              <p className="mt-1 text-sm font-bold text-[#22282E]">
                생성 {(user.matchupsCreated ?? 0).toLocaleString()}회
                <span className="mx-1.5 text-gray-300">·</span>
                <span className="tabular-nums text-emerald-700">
                  {(user.matchupResultPoints ?? 0).toLocaleString()}P
                </span>
              </p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/40 px-3 py-3 sm:px-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-amber-900/80">
                투표 참여
              </p>
              <p className="mt-1 text-sm font-bold text-[#22282E]">
                {(user.totalVotes ?? 0).toLocaleString()}회 참여
                <span className="mx-1.5 text-gray-300">·</span>
                <span className="tabular-nums text-amber-800">
                  {(user.voteParticipationPoints ?? 0).toLocaleString()}P
                </span>
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-3 sm:px-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                주요 카테고리
              </p>
              <p className="mt-1 text-sm font-semibold text-[#22282E]">
                {(Array.isArray(user.topCategories) ? user.topCategories : []).join(', ') || '—'}
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      {user.reportReasons &&
        typeof user.reportReasons === 'object' &&
        !Array.isArray(user.reportReasons) &&
        Object.keys(user.reportReasons).length > 0 && (
          <div className="mb-6">
            <SectionCard icon={AlertTriangle} title="신고 사유별 분류" subtitle="누적 신고 유형">
              <div className="flex flex-wrap gap-2">
                {Object.entries(user.reportReasons).map(([reason, count]) => (
                  <span
                    key={reason}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50/70 px-3 py-2 text-sm font-black text-amber-950 shadow-sm"
                  >
                    {reason}
                    <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-xs font-black tabular-nums text-amber-900 ring-1 ring-amber-200/60">
                      {count}건
                    </span>
                  </span>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

      <div className="mb-6">
        <SectionCard
          icon={ClipboardList}
          title="제재 및 신고 이력"
          subtitle="관리 기록과 경고 이력"
        >
          {displaySanctions.length > 0 ? (
            <ul className="space-y-0">
              {displaySanctions.map((s, i) => (
                <li
                  key={i}
                  className="relative border-l-2 border-emerald-200/80 pl-4 pb-4 last:pb-0"
                >
                  <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                  <p className="text-xs font-bold text-emerald-700/90">{s.date}</p>
                  <p className="mt-1 text-sm leading-relaxed text-gray-700">{s.text}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-8 text-center text-sm font-medium text-gray-500">
              등록된 이력이 없습니다.
            </p>
          )}
        </SectionCard>
      </div>

      <div className="mb-6">
        <SectionCard icon={MessageCircle} title="관리자 메모" subtitle="내부 공유용 · 유저에게 노출되지 않아요">
          {(memos.length > 0 || user.adminMemo) && (
            <div className="mb-5 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">저장된 메모</p>
              <ul className="space-y-2">
                {memos.length > 0 ? (
                  memos.map((m, i) => (
                    <li
                      key={i}
                      className="rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50/90 to-white px-3 py-2.5 shadow-sm"
                    >
                      <span className="text-[11px] font-bold text-gray-400">{m.date}</span>
                      <p className="mt-1 text-sm leading-relaxed text-gray-800">{m.text}</p>
                    </li>
                  ))
                ) : (
                  <li className="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5 text-sm text-gray-800">
                    {user.adminMemo}
                  </li>
                )}
              </ul>
            </div>
          )}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">
              새 메모 추가
            </p>
            <textarea
              value={newMemo}
              onChange={(e) => setNewMemo(e.target.value)}
              placeholder="메모를 입력하고 저장하면 기존 메모에 추가됩니다..."
              rows={3}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-inner placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
            />
            <button
              type="button"
              onClick={handleSaveMemo}
              className="mt-3 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
            >
              메모 추가
            </button>
          </div>
        </SectionCard>
      </div>

      {user.status !== 'withdrawn' && (
      <div className="mb-8">
        <SectionCard icon={Shield} title="관리 액션" subtitle="신중하게 선택해 주세요">
          <div className="flex flex-wrap justify-center gap-2.5 sm:justify-start sm:gap-3">
            {(user.status === 'suspended' || user.status === 'blocked') && (
              <button
                type="button"
                onClick={() => setRestoreConfirmOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800 shadow-sm hover:bg-emerald-100"
              >
                <RotateCcw size={18} />
                복구
              </button>
            )}
            {user.status !== 'blocked' && (
              <>
                <button
                  type="button"
                  onClick={() => handleAction('warn')}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-900 shadow-sm hover:bg-amber-100"
                >
                  <MessageCircle size={18} />
                  경고 발송
                </button>
                {user.status !== 'suspended' && (
                  <button
                    type="button"
                    onClick={() => setSuspend7ConfirmOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-bold text-orange-900 shadow-sm hover:bg-orange-100"
                  >
                    <Clock size={18} />
                    7일 정지
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setBanConfirmOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-800 shadow-sm hover:bg-red-100"
                >
                  <Ban size={18} />
                  영구 차단
                </button>
                <button
                  type="button"
                  onClick={() => setRevokeConfirmOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-gray-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-gray-800"
                >
                  <Coins size={18} />
                  강제 포인트 회수
                </button>
              </>
            )}
          </div>
        </SectionCard>
      </div>
      )}

      <Modal
        isOpen={restoreConfirmOpen}
        onClose={() => setRestoreConfirmOpen(false)}
        title="계정 복구"
      >
        <div className="space-y-4">
          <div className="flex gap-3 rounded-xl border border-amber-300/90 bg-amber-50 px-3 py-3 text-sm text-amber-950">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
              strokeWidth={2.25}
              aria-hidden
            />
            <div>
              <p className="font-bold text-amber-900">복구 전 확인해 주세요</p>
              <p className="mt-1.5 text-xs font-medium leading-relaxed text-amber-900/90">
                정지·차단 상태였던 계정이 <strong>활성</strong>으로 바뀝니다. 서비스 이용이 다시 허용되며,
                필요 시 별도 제재·모니터링 정책을 확인해 주세요.
              </p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-gray-700">
            <strong className="text-[#22282E]">{user?.nickname}</strong> 유저를{' '}
            <strong className="text-emerald-700">복구(활성)</strong>하시겠습니까?
          </p>
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setRestoreConfirmOpen(false)}
              className="rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-600 transition-all duration-200 hover:bg-gray-200 active:scale-[0.98]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => handleAction('restore')}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
            >
              복구 진행
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={banConfirmOpen}
        onClose={() => setBanConfirmOpen(false)}
        title="영구 차단 확인"
      >
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            <strong>{user?.nickname}</strong> 유저를 <strong>영구 차단</strong>하시겠습니까?
            <br />
            영구 차단된 유저는 서비스 이용이 제한되며, 복구하려면 관리자 조치가 필요합니다.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setBanConfirmOpen(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] transition-all duration-200"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => handleAction('ban')}
              className="px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700"
            >
              영구 차단
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={suspend7ConfirmOpen}
        onClose={() => setSuspend7ConfirmOpen(false)}
        title="7일 정지 확인"
      >
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            <strong>{user?.nickname}</strong> 유저를 <strong>7일 정지</strong>하시겠습니까?
            <br />
            정지된 유저는 7일간 서비스 이용이 제한됩니다.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setSuspend7ConfirmOpen(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] transition-all duration-200"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => handleAction('suspend7')}
              className="px-5 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700"
            >
              7일 정지
            </button>
          </div>
        </div>
      </Modal>

      <WarnSanctionModal
        isOpen={warnModalOpen}
        onClose={() => setWarnModalOpen(false)}
        user={user}
        onSuccess={handleWarnSuccess}
      />

      <Modal
        isOpen={revokeConfirmOpen}
        onClose={() => {
          setRevokeConfirmOpen(false)
          setRevokeAmount('')
          setRevokeMode('vote_only')
        }}
        title="강제 포인트 회수"
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-gray-700">
            <strong className="text-[#22282E]">{user?.nickname}</strong> 유저의 활동 포인트를 회수합니다.{' '}
            아래에서 <strong>차감 항목</strong>을 선택한 뒤 금액을 입력해 주세요. 회수된 포인트는 복구할 수
            없습니다.
          </p>
          <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5 text-xs text-gray-600">
            <p>
              현재 합계:{' '}
              <strong className="tabular-nums text-[#22282E]">{profilePoints.toLocaleString()}P</strong>{' '}
              (투표 {(user?.voteParticipationPoints ?? 0).toLocaleString()}P · 생성{' '}
              {(user?.matchupResultPoints ?? 0).toLocaleString()}P)
            </p>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold text-gray-500">차감 항목</p>
            <div className="space-y-2.5">
              {REVOKE_POINTS_MODES.map((m) => (
                <label
                  key={m.id}
                  className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-gray-100 bg-white px-3 py-2 text-sm text-[#22282E] has-[:checked]:border-gray-300 has-[:checked]:bg-gray-50/80"
                >
                  <input
                    type="radio"
                    name="revokeMode"
                    checked={revokeMode === m.id}
                    onChange={() => setRevokeMode(m.id)}
                    className="mt-0.5 text-gray-800"
                  />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="revoke-points" className="mb-1.5 block text-xs font-bold text-gray-500">
              회수할 포인트 (P)
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="revoke-points"
                type="number"
                min={1}
                step={1}
                value={revokeAmount}
                onChange={(e) => setRevokeAmount(e.target.value)}
                placeholder="예: 500"
                className="min-w-[8rem] flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold tabular-nums focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300/40"
              />
              <button
                type="button"
                onClick={() => {
                  const v = user?.voteParticipationPoints ?? 0
                  const m = user?.matchupResultPoints ?? 0
                  setRevokeAmount(
                    String(Math.max(0, revokeMode === 'matchup_only' ? m : v))
                  )
                }}
                className="shrink-0 rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
              >
                전액
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-gray-400">
              「전액」은 선택한 항목(투표 또는 생성) 풀의 최대치로 채웁니다.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setRevokeConfirmOpen(false)
                setRevokeAmount('')
                setRevokeMode('vote_only')
              }}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] transition-all duration-200"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleRevokePoints}
              className="px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800"
            >
              포인트 회수
            </button>
          </div>
        </div>
      </Modal>

      <div className="flex justify-center pb-2">
        <Link
          to="/admin/users"
          className="inline-flex min-w-[12rem] items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-3 text-sm font-black text-white shadow-md shadow-emerald-600/20 hover:from-emerald-700 hover:to-teal-700"
        >
          목록으로 돌아가기
        </Link>
      </div>
    </div>
  )
}
