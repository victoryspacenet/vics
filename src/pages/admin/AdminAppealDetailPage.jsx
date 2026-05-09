import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useUIStore } from '../../store/uiStore'
import { ArrowLeft, ChevronDown, FileText, FileImage, X } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import {
  getAdminAppealById,
  updateAdminAppeal,
  getAppealTemplates,
  getTemplateBody,
  APPEAL_STATUS,
} from '../../lib/appealAdminStorage'
import { saveAppealResult } from '../../lib/appealResultStorage'
import { addAppealResultPush } from '../../lib/noticePushStorage'

const STATUS_LABELS = {
  [APPEAL_STATUS.pending]: '미처리',
}

const STATUS_DISPLAY = {
  [APPEAL_STATUS.pending]: '미처리',
  [APPEAL_STATUS.completed]: '답변 완료',
}

const DECISION_OPTIONS = [
  { id: 'reject', label: '기각 (제재 유지)', desc: '소명 근거 부족 및 반복적 가이드 위반' },
  { id: 'approve', label: '승인 (제재 해제)', desc: '정상 참작 가능 (제재 즉시 해제 및 알림 발송)' },
]

function formatFullDate(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const IMG_EXT = /\.(jpg|jpeg|png|gif|webp|bmp)$/i

function EvidenceViewerModal({ file, onClose }) {
  if (!file) return null
  const isImage = IMG_EXT.test(file)
  const placeholderSrc = `https://placehold.co/600x400/e5e7eb/6b7280?text=${encodeURIComponent(file)}`

  return (
    <Modal isOpen={!!file} onClose={onClose} title="첨부 증거">
      <div className="flex flex-col items-center gap-4">
        {isImage ? (
          <img
            src={placeholderSrc}
            alt={file}
            className="max-w-full max-h-[70vh] object-contain rounded-lg border border-gray-200"
          />
        ) : (
          <div className="w-full max-w-md aspect-video bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
            <FileImage size={48} className="opacity-50" />
            <span className="ml-2">{file}</span>
          </div>
        )}
        <p className="text-sm text-gray-500">{file}</p>
      </div>
    </Modal>
  )
}

export function AdminAppealDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { showToast } = useUIStore()

  const [appeal, setAppeal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(APPEAL_STATUS.pending)
  const [decision, setDecision] = useState(null)
  const [replyToUser, setReplyToUser] = useState('')
  const [templateOpen, setTemplateOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [evidenceFile, setEvidenceFile] = useState(null)
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    getAdminAppealById(id).then((data) => {
      if (cancelled) return
      setAppeal(data)
      if (data) {
        setStatus(data.status ?? APPEAL_STATUS.pending)
        setDecision(data.decision ?? null)
        setReplyToUser(data.replyToUser ?? '')
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [id])

  const templates = getAppealTemplates()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">불러오는 중...</p>
      </div>
    )
  }

  if (!appeal) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">이의 신청을 찾을 수 없어요.</p>
          <Link to="/admin/appeals" className="text-emerald-600 font-bold hover:underline">
            목록으로
          </Link>
        </div>
      </div>
    )
  }

  const handleLoadTemplate = (templateId) => {
    const body = getTemplateBody(templateId, appeal.nickname)
    setReplyToUser(body)
    setTemplateOpen(false)
  }

  const handleStatusChange = async (newStatus) => {
    setStatus(newStatus)
    setStatusOpen(false)
    await updateAdminAppeal(appeal.id, { status: newStatus })
  }

  const handleCancel = () => {
    navigate('/admin/appeals')
  }

  const handleCompleteClick = () => {
    if (!decision) {
      showToast('검토 결과(기각/승인)를 선택해 주세요.', 'error')
      return
    }
    if (!replyToUser.trim()) {
      showToast('유저에게 보낼 답변 문구를 입력해 주세요.', 'error')
      return
    }
    setConfirmCompleteOpen(true)
  }

  const handleCompleteConfirm = async () => {
    // 제재 종료 예정일 계산 (기각 시 통보용)
    let sanctionEndAt = null
    if (decision === 'reject') {
      const d = new Date(appeal.sanctionDate || appeal.createdAt)
      d.setDate(d.getDate() + 7) // 기본 7일
      sanctionEndAt = d.toISOString()
    }

    await updateAdminAppeal(appeal.id, {
      status: APPEAL_STATUS.completed,
      decision,
      reducedDays: null,
      replyToUser,
    })

    // 유저 결과 통보: 저장 + 푸시 알림
    await saveAppealResult({
      receiptId: appeal.receiptId,
      decision,
      replyToUser,
      userId: appeal.userId,
      nickname: appeal.nickname,
      sanctionDate: appeal.sanctionDate,
      reducedDays: null,
      sanctionEndAt,
    })
    await addAppealResultPush({ userId: appeal.userId, receiptId: appeal.receiptId, decision })

    setConfirmCompleteOpen(false)
    navigate('/admin/appeals', { replace: true, state: { appealCompleteToast: '통보완료' } })
  }

  const isCompleted = appeal.status === APPEAL_STATUS.completed

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/admin/appeals"
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#22282E]"
          >
            <ArrowLeft size={18} />
            목록으로 돌아가기
          </Link>
          <div className="relative">
            <button
              onClick={() => !isCompleted && setStatusOpen(!statusOpen)}
              disabled={isCompleted}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold ${
                status === APPEAL_STATUS.completed ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
              } ${isCompleted ? 'opacity-80 cursor-default' : ''}`}
            >
              상태: {STATUS_DISPLAY[status] ?? status}
              {!isCompleted && <ChevronDown size={14} className="inline ml-1" />}
            </button>
            {statusOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setStatusOpen(false)} />
                <div className="absolute right-0 top-full mt-1 py-1 bg-white rounded-lg border shadow-lg z-20 min-w-[120px]">
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => handleStatusChange(k)}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* [1][2] Side-by-Side: 제재 원인 vs 유저 소명 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <section className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-red-700 mb-4">[1] 제재 원인 (Violation Info)</h3>
            <ul className="space-y-2 text-sm">
              <li>
                제재 대상: <strong>{appeal.nickname}</strong> ({appeal.userId}) | 제재일: {appeal.sanctionDate}
              </li>
              <li>
                위반 사유: <strong>{appeal.violationReason}</strong>
              </li>
              <li>
                원본 데이터: &quot;{appeal.originalContent}&quot; ({appeal.originalType})
              </li>
            </ul>
          </section>
          <section className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-emerald-700 mb-4">[2] 유저 소명 (User&apos;s Appeal)</h3>
            <ul className="space-y-3 text-sm">
              <li>
                접수 일시: {formatFullDate(appeal.createdAt)}
              </li>
              <li>
                소명 제목: <strong>&quot;{appeal.appealTitle}&quot;</strong>
              </li>
              <li>
                소명 상세: <span className="whitespace-pre-wrap text-gray-700">{appeal.appealContent}</span>
              </li>
              {appeal.attachments?.length > 0 && (
                <li>
                  첨부 증거:{' '}
                  {appeal.attachments.map((file) => (
                    <button
                      key={file}
                      type="button"
                      onClick={() => setEvidenceFile(file)}
                      className="inline-flex items-center gap-1.5 mx-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium hover:bg-emerald-100"
                    >
                      <FileImage size={14} />
                      {file}
                    </button>
                  ))}
                </li>
              )}
            </ul>
          </section>
        </div>

        {/* [3] 검토 결과 결정 */}
        <section className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
          <h3 className="text-sm font-bold text-[#22282E] mb-4">[3] 검토 결과 결정 (Decision)</h3>
          <div className="space-y-3 mb-5">
            {DECISION_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  decision === opt.id ? 'border-emerald-500 bg-emerald-50/50' : 'border-gray-200 hover:bg-gray-50'
                } ${isCompleted ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <input
                  type="radio"
                  name="decision"
                  value={opt.id}
                  checked={decision === opt.id}
                  onChange={() => setDecision(opt.id)}
                  disabled={isCompleted}
                  className="mt-1"
                />
                <div>
                  <span className="font-medium">{opt.label}</span>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>

          <div className="mb-3">
            <label className="text-sm font-bold text-[#22282E] block mb-2">유저에게 보낼 답변 문구</label>
            <div className="relative mb-2">
              <button
                onClick={() => setTemplateOpen(!templateOpen)}
                disabled={isCompleted}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <FileText size={16} />
                답변 템플릿 불러오기
                <ChevronDown size={14} className={templateOpen ? 'rotate-180' : ''} />
              </button>
              {templateOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setTemplateOpen(false)} />
                  <div className="absolute top-full left-0 mt-1 py-1 bg-white rounded-lg border shadow-lg z-20 min-w-[180px]">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleLoadTemplate(t.id)}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <textarea
              value={replyToUser}
              onChange={(e) => setReplyToUser(e.target.value)}
              placeholder="소명하신 내용을 검토한 결과..."
              rows={6}
              disabled={isCompleted}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none disabled:bg-gray-50"
            />
          </div>
        </section>

        {/* 버튼 */}
        <div className="flex flex-wrap gap-3 justify-center">
          {!isCompleted && (
            <button
              onClick={handleCancel}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-gray-200 bg-white text-sm font-bold text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 transition-all duration-200"
            >
              <ArrowLeft size={16} />
              검토 취소
            </button>
          )}
          {!isCompleted && (
            <button
              onClick={handleCompleteClick}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500"
            >
              검토 완료 및 통보
            </button>
          )}
        </div>
      </div>

      <EvidenceViewerModal file={evidenceFile} onClose={() => setEvidenceFile(null)} />

      {/* 검토 완료 경고 모달 */}
      <Modal
        isOpen={confirmCompleteOpen}
        onClose={() => setConfirmCompleteOpen(false)}
        title="검토 완료 확인"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            검토를 완료하고 유저에게 통보합니다. <strong>이 작업은 되돌릴 수 없습니다.</strong> 계속할까요?
          </p>
          <div className="flex gap-3 justify-end items-center">
            <button
              onClick={() => setConfirmCompleteOpen(false)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-gray-200 bg-white text-sm font-bold text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 transition-all duration-200"
            >
              <X size={16} />
              취소
            </button>
            <button
              onClick={handleCompleteConfirm}
              className="px-6 py-3 rounded-xl bg-emerald-600 text-white text-base font-bold hover:bg-emerald-500 transition-colors duration-200"
            >
              확인
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
