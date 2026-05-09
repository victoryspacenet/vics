import { useState, useMemo, useCallback } from 'react'
import { FolderOpen, ChevronRight, X, Sparkles, Smile, AlertTriangle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { cn } from '../../lib/utils'
import { suggestEnglishCategoryCode, addActiveCategory } from '../../lib/categoryAdminStorage'

const NAME_MAX = 10

const EMOJI_PRESETS = [
  '🎈', '🎮', '🍕', '🍜', '⚖️', '💼', '💕', '🤝', '👗', '✨', '🔥', '⭐', '🎯', '🏆', '🎬', '🎵',
  '📷', '🌿', '✈️', '⚽', '🏀', '🎸', '📚', '💡', '🌙', '☀️', '🌈', '🦄', '🐱', '🐶', '🍀', '🎁',
  '💎', '🚀', '🎨', '🧩', '🎪', '🏖️', '🍔', '☕', '🧋', '🎂', '🎭', '📱', '💻', '🎧', '🧠',
]

export function NewCategoryCreatorPanel({ existingIds, onNotify, className }) {
  const [expanded, setExpanded] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [manualEnglishCode, setManualEnglishCode] = useState('')
  const [codeTouched, setCodeTouched] = useState(false)
  const [iconEmoji, setIconEmoji] = useState('🎈')
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const suggestedEnglishCode = useMemo(
    () => suggestEnglishCategoryCode(displayName, existingIds),
    [displayName, existingIds]
  )
  const englishCodeValue = codeTouched ? manualEnglishCode : suggestedEnglishCode

  const resetForm = useCallback(() => {
    setDisplayName('')
    setManualEnglishCode('')
    setCodeTouched(false)
    setIconEmoji('🎈')
    setEmojiPickerOpen(false)
  }, [])

  const getValidationError = () => {
    const name = displayName.trim()
    if (!name || name.length > NAME_MAX) {
      return `카테고리 명을 1~${NAME_MAX}자로 입력해 주세요.`
    }
    const id = englishCodeValue.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+/, '')
    if (!id || !/^[a-z][a-z0-9_]*$/.test(id)) {
      return '영문 코드명을 확인해 주세요. (영문 소문자, 숫자, 밑줄)'
    }
    return null
  }

  const requestCreate = () => {
    const err = getValidationError()
    if (err) {
      onNotify?.({ type: 'error', message: err })
      return
    }
    setConfirmOpen(true)
  }

  const confirmCreate = () => {
    const err = getValidationError()
    if (err) {
      onNotify?.({ type: 'error', message: err })
      setConfirmOpen(false)
      return
    }
    const name = displayName.trim()
    const id = englishCodeValue.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+/, '')
    const result = addActiveCategory({
      id,
      slug: name,
      label: name,
      pinned: false,
      iconEmoji: iconEmoji || undefined,
    })
    if (!result) {
      onNotify?.({ type: 'error', message: '이미 같은 이름 또는 코드의 카테고리가 있어요.' })
      setConfirmOpen(false)
      return
    }
    setConfirmOpen(false)
    onNotify?.({ type: 'success' })
    resetForm()
  }

  const previewIcon = (
    <span className="text-3xl leading-none drop-shadow-sm">{iconEmoji || '📁'}</span>
  )

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm',
        className
      )}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-100/90 bg-gradient-to-r from-slate-50/95 via-white to-violet-50/30 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 ring-1 ring-violet-200/60">
            <FolderOpen size={18} strokeWidth={2.25} />
          </span>
          <span className="flex min-w-0 items-center gap-1 text-sm font-bold text-gray-500">
            <span className="truncate">카테고리 설정</span>
            <ChevronRight size={14} className="shrink-0 opacity-60" />
            <span className="truncate font-black text-[#22282E]">신규 카테고리 추가</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setExpanded(false)
            resetForm()
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          aria-label="패널 닫기"
        >
          <X size={18} strokeWidth={2.25} />
        </button>
      </div>

      {expanded && (
        <div className="space-y-6 p-4 sm:p-6">
          <div className="rounded-xl border border-emerald-100/80 bg-gradient-to-br from-emerald-50/80 to-white px-4 py-3">
            <p className="text-sm font-black text-[#22282E]">
              <Sparkles className="mr-1 inline h-4 w-4 text-amber-500" />
              새로운 카테고리 정보를 입력해주세요.
            </p>
            <p className="mt-1 text-xs font-medium text-gray-600">
              설정된 내용은 저장 즉시 앱 내 필터 및 생성 화면에 반영됩니다.
            </p>
          </div>

          {/* [1] 기본 정보 */}
          <section>
            <h3 className="mb-3 text-xs font-black uppercase tracking-wide text-gray-400">[1] 기본 정보 설정</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 flex items-center justify-between text-xs font-bold text-gray-700">
                  <span>카테고리 명</span>
                  <span className="tabular-nums text-gray-400">
                    {displayName.length}/{NAME_MAX}
                  </span>
                </label>
                <input
                  type="text"
                  value={displayName}
                  maxLength={NAME_MAX}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="예: 밸런스 게임"
                  className="w-full rounded-xl border-2 border-gray-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-[#22282E] shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-gray-700">영문 코드명</label>
                <input
                  type="text"
                  value={englishCodeValue}
                  onChange={(e) => {
                    setCodeTouched(true)
                    setManualEnglishCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                  }}
                  placeholder="category_new_01"
                  className="w-full rounded-xl border-2 border-violet-200/80 bg-violet-50/40 px-4 py-2.5 font-mono text-sm font-semibold text-violet-950 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400/25"
                />
                <p className="mt-1 text-[11px] text-gray-500">시스템·DB 식별용입니다. 비우면 이름 기준으로 자동 제안되며 직접 수정할 수 있어요.</p>
              </div>
            </div>
          </section>

          {/* [2] 비주얼 */}
          <section>
            <h3 className="mb-3 text-xs font-black uppercase tracking-wide text-gray-400">[2] 비주얼 요소 (UI)</h3>
            <div className="space-y-4">
              <div>
                <span className="mb-1.5 block text-xs font-bold text-gray-700">대표 아이콘</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEmojiPickerOpen((o) => !o)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-2 text-xs font-bold transition',
                      emojiPickerOpen
                        ? 'border-amber-400 bg-amber-50 text-amber-900'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-amber-300'
                    )}
                  >
                    <Smile size={16} />
                    이모지 선택
                  </button>
                </div>
                {emojiPickerOpen && (
                  <div className="mt-3 max-h-40 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-inner">
                    <div className="grid grid-cols-8 gap-1 sm:grid-cols-10">
                      {EMOJI_PRESETS.map((em) => (
                        <button
                          key={em}
                          type="button"
                          className="flex h-9 items-center justify-center rounded-lg text-lg hover:bg-amber-50"
                          onClick={() => {
                            setIconEmoji(em)
                            setEmojiPickerOpen(false)
                          }}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <p className="mt-2 text-xs text-gray-600">
                  미리보기:{' '}
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                    {previewIcon}
                  </span>
                </p>
              </div>
            </div>
          </section>

          {/* [3] 미리보기 */}
          <section>
            <h3 className="mb-3 text-xs font-black uppercase tracking-wide text-gray-400">[3] 앱 내 적용 미리보기</h3>
            <div className="rounded-2xl border-2 border-gray-200/90 bg-gradient-to-br from-white to-gray-50/90 p-4 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-md ring-2 ring-white">
                  <span className="text-2xl">{iconEmoji || '📁'}</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-[#22282E]">
                    {displayName.trim() || '입력한 이름'}
                  </p>
                  <p className="text-[10px] font-medium text-gray-400">홈 LNB · 매치업 생성 드롭다운 예시</p>
                </div>
              </div>
            </div>
          </section>

          <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => {
                resetForm()
              }}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-100"
            >
              취소
            </button>
            <button
              type="button"
              onClick={requestCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-2.5 text-sm font-black text-white shadow-md shadow-emerald-600/25 transition hover:from-emerald-700 hover:to-teal-700"
            >
              생성완료
            </button>
          </div>
        </div>
      )}

      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full px-4 py-3 text-left text-sm font-bold text-violet-700 hover:bg-violet-50/50"
        >
          신규 카테고리 폼 펼치기 →
        </button>
      )}

      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="카테고리 생성 확인"
      >
        <div className="space-y-4">
          <div className="flex gap-3 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-3 text-sm text-amber-950">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
            <p className="leading-relaxed">
              저장 즉시 홈·랭킹 필터와 매치업 생성 화면에 이 카테고리가 반영됩니다. 영문 코드명은 이후 변경이 어려울 수 있으니 한 번 더 확인해 주세요.
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100"
            >
              취소
            </button>
            <button
              type="button"
              onClick={confirmCreate}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
            >
              생성완료
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
