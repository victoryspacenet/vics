import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronUp, Flame, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { FAQ_ITEMS, FAQ_ALL_IDS } from '../../lib/faqData'
import {
  getHotFaqIds,
  saveHotFaqIds,
  filterHotFaqIdsByListedCategoryHelp,
  fetchCategoryHelpRowsForHotFilter,
} from '../../lib/inquiryHotFaq'
import { useUIStore } from '../../store/uiStore'

export function InquiryHotFaqAdminPage() {
  const { showToast } = useUIStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [orderedIds, setOrderedIds] = useState([])
  const [helpRows, setHelpRows] = useState(null)
  /** 노출 목록에서 제거 확인 — FAQ id */
  const [removeConfirmId, setRemoveConfirmId] = useState(null)
  /** 저장 전 확인 */
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)
  /** 풀 → 나머지 전부 추가 확인 */
  const [addAllConfirmOpen, setAddAllConfirmOpen] = useState(false)
  /** 풀 → 개별 추가 확인 — FAQ id */
  const [addOneConfirmId, setAddOneConfirmId] = useState(null)

  const reloadLists = useCallback(() => {
    setLoading(true)
    Promise.all([getHotFaqIds(), fetchCategoryHelpRowsForHotFilter()])
      .then(([ids, rows]) => {
        setOrderedIds(ids)
        setHelpRows(rows)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    reloadLists()
  }, [reloadLists])

  useEffect(() => {
    const onSync = () => reloadLists()
    window.addEventListener('vics:inquiry-hot-faq:updated', onSync)
    window.addEventListener('vics:inquiry-category-help:updated', onSync)
    return () => {
      window.removeEventListener('vics:inquiry-hot-faq:updated', onSync)
      window.removeEventListener('vics:inquiry-category-help:updated', onSync)
    }
  }, [reloadLists])

  const poolIds = useMemo(() => {
    const unordered = FAQ_ALL_IDS.filter((id) => !orderedIds.includes(id))
    if (helpRows === null) return []
    return filterHotFaqIdsByListedCategoryHelp(unordered, helpRows)
  }, [orderedIds, helpRows])

  const addId = (id) => {
    setOrderedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }

  /** poolIds에 있으면서 아직 노출 목록에 없는 id를 id 순서대로 한 번에 추가 */
  const addAllFromPool = () => {
    setOrderedIds((prev) => {
      const inList = new Set(prev)
      const toAdd = poolIds.filter((id) => !inList.has(id))
      if (toAdd.length === 0) return prev
      return [...prev, ...toAdd]
    })
  }

  const removeById = (id) => {
    setOrderedIds((prev) => prev.filter((x) => x !== id))
  }

  const move = (index, dir) => {
    setOrderedIds((prev) => {
      const next = [...prev]
      const j = index + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[index], next[j]] = [next[j], next[index]]
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveHotFaqIds(orderedIds)
      showToast('저장됐어요. 문의 메인에 반영됩니다.', 'success')
      setSaveConfirmOpen(false)
      return true
    } catch (e) {
      showToast(e?.message || '저장에 실패했어요.', 'error')
      return false
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/admin/inquiry"
              className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              aria-label="뒤로"
            >
              <ArrowLeft size={20} />
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg font-black text-[#22282E]">문의 메인 — 자주 묻는 질문</h1>
              <p className="text-xs font-medium text-gray-500">유저 앱 문의하기 화면 중단에 노출되는 항목과 순서입니다.</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-gray-400" size={32} />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100">
                  <Flame size={18} className="text-orange-600" />
                </div>
                <h2 className="text-sm font-black text-[#22282E]">노출 중 (위에서부터 순서)</h2>
              </div>
              {orderedIds.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">아래 풀에서 항목을 추가해 주세요.</p>
              ) : (
                <ul className="space-y-2">
                  {orderedIds.map((id, index) => {
                    const item = FAQ_ITEMS[id]
                    if (!item) return null
                    return (
                      <li
                        key={id}
                        className="flex items-start gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5"
                      >
                        <span className="mt-0.5 text-xs font-black tabular-nums text-gray-400">{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-[#22282E]">{item.question}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{item.answer}</p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => move(index, -1)}
                            disabled={index === 0}
                            className="rounded p-1 text-gray-500 hover:bg-white disabled:opacity-30"
                            aria-label="위로"
                          >
                            <ChevronUp size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => move(index, 1)}
                            disabled={index === orderedIds.length - 1}
                            className="rounded p-1 text-gray-500 hover:bg-white disabled:opacity-30"
                            aria-label="아래로"
                          >
                            <ChevronDown size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRemoveConfirmId(id)}
                            className="rounded p-1 text-red-500 hover:bg-red-50"
                            aria-label="목록에서 제거"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-black text-[#22282E]">추가 가능한 FAQ</h2>
                {poolIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAddAllConfirmOpen(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                  >
                    <Plus size={14} />
                    나머지 항목 모두 추가
                  </button>
                )}
              </div>
              <p className="mb-3 text-xs text-gray-500">
                <strong className="text-gray-700">src/lib/faqData.js</strong>의 FAQ_ITEMS(id·질문·본문)에만 등록된 항목이 여기 풀에 나옵니다.
                카테고리별 도움말(관리자 &gt; 카테고리 FAQ)에서 만든 글은 문의 메인 풀과 별도예요. 새 질문을 메인 FAQ에 넣으려면 먼저 faqData에 항목을 추가한 뒤 이 화면에서 노출 순서를 정해 주세요.
                <span className="mt-1 block text-[11px] text-gray-400">
                  카테고리 도움말 DB에 동일 카테고리·동일 제목이 있으면, 그 항목을 노출 목록에서 빼면 문의 메인 자주 묻는 질문에서도 자동으로 빠지며, 아래 「추가 가능한 FAQ」에도 나오지 않습니다.
                </span>
              </p>
              {poolIds.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-500">모든 FAQ가 목록에 포함됐어요.</p>
              ) : (
                <ul className="space-y-2">
                  {poolIds.map((id) => {
                    const item = FAQ_ITEMS[id]
                    const title = item?.question || `FAQ ${id}`
                    return (
                      <li
                        key={id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-gray-200 px-3 py-2"
                      >
                        <span className="text-sm font-semibold text-gray-800">{title}</span>
                        <button
                          type="button"
                          onClick={() => setAddOneConfirmId(id)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#22282E] px-2.5 py-1.5 text-xs font-bold text-white hover:bg-[#363d46]"
                        >
                          <Plus size={14} />
                          추가
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSaveConfirmOpen(true)}
              disabled={saving || orderedIds.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3.5 text-sm font-black text-white shadow-md transition hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              저장하기
            </button>

            <Modal
              isOpen={addAllConfirmOpen}
              onClose={() => setAddAllConfirmOpen(false)}
              title="나머지 항목 모두 추가"
            >
              <div className="space-y-4">
                <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <Plus size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                  <p className="text-xs leading-relaxed text-emerald-900">
                    아래 항목을 노출 목록 맨 아래 순서로 붙입니다. 적용하려면 화면 하단의 <strong>저장하기</strong>를 눌러 주세요.
                  </p>
                </div>
                <p className="text-sm text-gray-600">
                  총 <strong className="text-[#22282E]">{poolIds.length}</strong>개 항목을 한 번에 추가할까요?
                </p>
                <ul className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 text-xs text-gray-700">
                  {poolIds.map((pid) => (
                    <li key={pid} className="leading-snug">
                      · {FAQ_ITEMS[pid]?.question || `FAQ ${pid}`}
                    </li>
                  ))}
                </ul>
                <div className="flex justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setAddAllConfirmOpen(false)}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      addAllFromPool()
                      setAddAllConfirmOpen(false)
                      showToast(
                        '나머지 항목을 노출 목록에 추가했어요. 문의 메인에 반영하려면 하단 저장하기를 눌러 주세요.',
                        'success',
                      )
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#22282E] px-4 py-2 text-sm font-bold text-white hover:bg-[#363d46]"
                  >
                    <Plus size={16} />
                    모두 추가
                  </button>
                </div>
              </div>
            </Modal>

            <Modal
              isOpen={addOneConfirmId != null}
              onClose={() => setAddOneConfirmId(null)}
              title="노출 목록에 추가"
            >
              {addOneConfirmId != null && (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <Plus size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                    <p className="text-xs leading-relaxed text-emerald-900">
                      이 항목을 노출 목록 맨 아래에 붙입니다. 적용하려면 화면 하단의 <strong>저장하기</strong>를 눌러 주세요.
                    </p>
                  </div>
                  <p className="text-sm text-gray-600">
                    <span className="font-bold text-[#22282E]">
                      「{FAQ_ITEMS[addOneConfirmId]?.question || `FAQ ${addOneConfirmId}`}」
                    </span>{' '}
                    항목을 노출 목록에 추가할까요?
                  </p>
                  <div className="flex justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setAddOneConfirmId(null)}
                      className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const id = addOneConfirmId
                        addId(id)
                        setAddOneConfirmId(null)
                        showToast(
                          '노출 목록에 추가했어요. 문의 메인에 반영하려면 하단 저장하기를 눌러 주세요.',
                          'success',
                        )
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#22282E] px-4 py-2 text-sm font-bold text-white hover:bg-[#363d46]"
                    >
                      <Plus size={16} />
                      추가
                    </button>
                  </div>
                </div>
              )}
            </Modal>

            <Modal
              isOpen={saveConfirmOpen}
              onClose={() => !saving && setSaveConfirmOpen(false)}
              title="설정 저장"
            >
              <div className="space-y-4">
                <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <Save size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                  <p className="text-xs leading-relaxed text-emerald-900">
                    현재 노출 목록과 순서를 서버에 저장하고, 유저 문의하기 메인 화면의 자주 묻는 질문에 반영합니다.
                  </p>
                </div>
                <p className="text-sm text-gray-600">
                  총 <strong className="text-[#22282E]">{orderedIds.length}</strong>개 항목을 저장할까요?
                </p>
                <div className="flex justify-end gap-3 pt-1">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setSaveConfirmOpen(false)}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSave()}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-sm font-bold text-white hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    저장하기
                  </button>
                </div>
              </div>
            </Modal>

            <Modal
              isOpen={removeConfirmId != null}
              onClose={() => setRemoveConfirmId(null)}
              title="노출 목록에서 제거"
            >
              {removeConfirmId != null && (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                    <p className="text-xs leading-relaxed text-amber-900">
                      아래 항목을 노출 목록에서 뺍니다. 적용하려면 화면 하단의 <strong>저장하기</strong>를 눌러 주세요.
                    </p>
                  </div>
                  <p className="text-sm text-gray-600">
                    <span className="font-bold text-[#22282E]">
                      「{FAQ_ITEMS[removeConfirmId]?.question || `FAQ ${removeConfirmId}`}」
                    </span>{' '}
                    항목을 노출 목록에서 제거할까요?
                  </p>
                  <div className="flex justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setRemoveConfirmId(null)}
                      className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const id = removeConfirmId
                        removeById(id)
                        setRemoveConfirmId(null)
                        showToast(
                          '노출 목록에서 제거했어요. 문의 메인에 반영하려면 하단 저장하기를 눌러 주세요.',
                          'success',
                        )
                      }}
                      className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600"
                    >
                      제거
                    </button>
                  </div>
                </div>
              )}
            </Modal>
          </div>
        )}
      </div>
    </div>
  )
}
