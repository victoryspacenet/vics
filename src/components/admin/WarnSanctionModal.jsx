import { useState, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import {
  getWarningCount,
  getLastSanctionLabel,
  getLastSanctionDate,
  sendWarning,
  WARN_REASONS,
  RESTRICTION_TYPES,
  RESTRICTION_PERIODS,
} from '../../lib/warnSanctionStorage'

const DEFAULT_TEMPLATE = (reasonLabel) =>
  `안녕하세요. VICTORYSPACE 운영팀입니다.
회원님은 [${reasonLabel}] 사유로 인해 신고가 접수되어 경고 처분되었습니다.
이후 적발 시 이용이 제한됩니다.`

export function WarnSanctionModal({ isOpen, onClose, user, onSuccess }) {
  const [reasonId, setReasonId] = useState('bad_language')
  const [message, setMessage] = useState('')
  const [restrictions, setRestrictions] = useState([])
  const [periodId, setPeriodId] = useState('24h')
  const [customDays, setCustomDays] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [warningCount, setWarningCount] = useState(0)
  const [lastSanctionLabel, setLastSanctionLabel] = useState('없음')
  const [lastSanctionDate, setLastSanctionDate] = useState(null)

  useEffect(() => {
    if (!isOpen || !user?.id) return
    let cancelled = false
    ;(async () => {
      const [wc, lab, dt] = await Promise.all([
        getWarningCount(user.id),
        getLastSanctionLabel(user.id, user.sanctions),
        getLastSanctionDate(user.id, user.sanctions),
      ])
      if (!cancelled) {
        setWarningCount(wc)
        setLastSanctionLabel(lab)
        setLastSanctionDate(dt)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen, user?.id, user?.sanctions])

  const nextCount = warningCount + 1
  const selectedReason = WARN_REASONS.find((r) => r.id === reasonId)
  const periodOpt = RESTRICTION_PERIODS.find((p) => p.id === periodId)
  const periodHours = periodId === 'custom' && customDays
    ? Number(customDays) * 24
    : periodOpt?.hours ?? 24

  useEffect(() => {
    if (isOpen && selectedReason) {
      setMessage(DEFAULT_TEMPLATE(selectedReason.label))
    }
  }, [isOpen, reasonId, selectedReason?.label])

  useEffect(() => {
    if (!isOpen) {
      setReasonId('bad_language')
      setRestrictions([])
      setPeriodId('24h')
      setCustomDays('')
    }
  }, [isOpen])

  const toggleRestriction = (id) => {
    setRestrictions((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleSubmit = async () => {
    if (!user || !message.trim()) return
    setSubmitting(true)
    try {
      await sendWarning(user.id, {
        reasonId,
        reasonLabel: selectedReason?.label || reasonId,
        message: message.trim(),
        restrictions,
        periodHours: restrictions.length > 0 ? periodHours : 0,
        customDays: periodId === 'custom' ? Number(customDays) || 0 : undefined,
      })
      onSuccess?.()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="경고 발송 및 이용 제한 설정"
      className="max-w-[min(32rem,calc(100vw-2rem))]"
    >
      <div className="space-y-6">
        {/* [1] 대상 유저 정보 */}
        <section>
          <h3 className="text-sm font-bold text-[#22282E] mb-3">[1] 대상 유저 정보</h3>
          <div className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3 space-y-1.5 text-sm">
            <p>
              <strong>닉네임:</strong> {user.nickname} ({user.id})
            </p>
            <p>
              <strong>누적 경고 횟수:</strong>{' '}
              <strong className="text-amber-700">{warningCount}회</strong>
              {nextCount > 1 && (
                <span className="text-amber-700 ml-1">
                  (이번 발송 시 총 <strong>{nextCount}회</strong>)
                </span>
              )}
            </p>
            <p>
              <strong>최근 제재 이력:</strong> {lastSanctionLabel}
              {lastSanctionDate && (
                <span className="text-gray-500 ml-1">({lastSanctionDate})</span>
              )}
            </p>
          </div>
        </section>

        {/* [2] 경고 사유 선택 */}
        <section>
          <h3 className="text-sm font-bold text-[#22282E] mb-3">[2] 경고 사유 선택 (유저 통지용)</h3>
          <div className="flex flex-wrap gap-3 mb-3">
            {WARN_REASONS.map((r) => (
              <label key={r.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="reason"
                  checked={reasonId === r.id}
                  onChange={() => setReasonId(r.id)}
                  className="text-amber-500"
                />
                <span className="text-sm">{r.label}</span>
              </label>
            ))}
          </div>
          <p className="text-xs font-bold text-gray-600 mb-1.5">
            경고 상세 메시지 (유저에게 앱 푸시/쪽지로 전송됨)
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 resize-none"
            placeholder="경고 메시지를 입력하세요..."
          />
          <p className="text-[10px] text-gray-400 mt-1">(템플릿)</p>
        </section>

        {/* [3] 추가 이용 제한 설정 */}
        <section>
          <h3 className="text-sm font-bold text-[#22282E] mb-3">
            [3] 추가 이용 제한 설정 (선택 사항)
          </h3>
          <p className="text-xs text-gray-600 mb-2">제한 항목:</p>
          <div className="flex flex-wrap gap-4 mb-4">
            {RESTRICTION_TYPES.map((r) => (
              <label key={r.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={restrictions.includes(r.id)}
                  onChange={() => toggleRestriction(r.id)}
                  className="rounded text-amber-500"
                />
                <span className="text-sm">{r.label}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-600 mb-2">제한 기간:</p>
          <div className="flex flex-wrap items-center gap-3">
            {RESTRICTION_PERIODS.map((p) => (
              <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="period"
                  checked={periodId === p.id}
                  onChange={() => setPeriodId(p.id)}
                  className="text-amber-500"
                />
                <span className="text-sm">{p.label}</span>
              </label>
            ))}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="period"
                checked={periodId === 'custom'}
                onChange={() => setPeriodId('custom')}
                className="text-amber-500"
              />
              <span className="text-sm">직접 입력:</span>
              <input
                type="number"
                min={1}
                max={365}
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
                onClick={() => setPeriodId('custom')}
                className="w-14 px-2 py-1 rounded border border-gray-200 text-sm"
                placeholder="일"
              />
              <span className="text-sm">일</span>
            </label>
          </div>
        </section>

        {/* 버튼 */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 active:scale-[0.98] transition-all duration-200 shadow-sm"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !message.trim()}
            className="px-5 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '적용 중…' : '경고 및 제한 적용'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
