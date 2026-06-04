import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronUp, Flame, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import {
  getHotFaqIds,
  getHotFaqAddablePool,
  resolveHotFaqRefs,
  saveHotFaqIds,
} from '../../lib/inquiryHotFaq'
import { useUIStore } from '../../store/uiStore'

export function InquiryHotFaqAdminPage() {
  const { showToast } = useUIStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [orderedIds, setOrderedIds] = useState([])
  const [resolvedOrdered, setResolvedOrdered] = useState([])
  const [pool, setPool] = useState([])
  /** 노출 목록에서 제거 확인 — ref (faq id 또는 help:uuid) */
  const [removeConfirmId, setRemoveConfirmId] = useState(null)
  /** 저장 전 확인 */
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)
  /** 풀 → 나머지 전부 추가 확인 */
  const [addAllConfirmOpen, setAddAllConfirmOpen] = useState(false)
  /** 풀 → 개별 추가 확인 — ref */
  const [addOneConfirmId, setAddOneConfirmId] = useState(null)

  const refreshPool = useCallback((ids) => {
    void getHotFaqAddablePool(ids).then(setPool)
  }, [])

  const refreshResolved = useCallback((ids) => {
    void resolveHotFaqRefs(ids).then(setResolvedOrdered)
  }, [])

  const reloadLists = useCallback(() => {
    setLoading(true)
    void getHotFaqIds()
      .then((ids) => {
        setOrderedIds(ids)
        refreshResolved(ids)
        refreshPool(ids)
      })
      .finally(() => setLoading(false))
  }, [refreshPool, refreshResolved])

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

  useEffect(() => {
    if (loading) return
    refreshPool(orderedIds)
    refreshResolved(orderedIds)
  }, [orderedIds, loading, refreshPool, refreshResolved])

  const resolvedById = useMemo(
    () => new Map(resolvedOrdered.map((r) => [r.id, r])),
    [resolvedOrdered],
  )

  const poolLabel = useCallback(
    (ref) =>
      pool.find((p) => p.ref === ref)?.question ||
      resolvedById.get(ref)?.question ||
      ref,
    [pool, resolvedById],
  )

  const addId = (ref) => {
    setOrderedIds((prev) => (prev.includes(ref) ? prev : [...prev, ref]))
  }

  const addAllFromPool = () => {
    setOrderedIds((prev) => {
      const inList = new Set(prev)
      const toAdd = pool.map((p) => p.ref).filter((ref) => !inList.has(ref))
      if (toAdd.length === 0) return prev
      return [...prev, ...toAdd]
    })
  }

  const removeById = (ref) => {
    setOrderedIds((prev) => prev.filter((x) => x !== ref))
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
                  {orderedIds.map((ref, index) => {
                    const item = resolvedById.get(ref)
                    if (!item) return null
                    return (
                      <li
                        key={item.id}
                        className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5"
                      >
                        <span className="shrink-0 text-xs font-black tabular-nums text-gray-400">{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="min-w-0 text-sm font-bold text-[#22282E]">{item.question}</p>
                            <span className="shrink-0 whitespace-nowrap rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-800">
                              {item.kind === 'help' ? `카테고리 · ${item.categoryLabel}` : '기본 FAQ'}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-gray-500">{item.answer}</p>
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
                            onClick={() => setRemoveConfirmId(item.id)}
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
                {pool.length > 0 && (
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
                <strong className="text-gray-700">카테고리 FAQ</strong>에 저장된 도움말이 자동으로 여기에 나타납니다.
                위 <strong className="text-gray-700">노출 중</strong>에 이미 있는 질문(같은 제목의 기본 FAQ·카테고리 도움말 포함)은 풀에 나오지 않습니다.
                빼려면 노출 목록에서 삭제한 뒤 <strong>저장하기</strong>를 누르세요.
              </p>
              {orderedIds.length > 0 && pool.length === 0 && (
                <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  지금은 노출 중인 항목만 있어 추가 가능한 FAQ가 비어 있어요. 「계정 삭제…」「랭킹 축하…」 등이
                  이미 위 노출 목록에 있으면 정상입니다.
                </p>
              )}
              {pool.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-500">추가할 항목이 없어요. 카테고리 FAQ에서 도움말을 등록해 주세요.</p>
              ) : (
                <ul className="space-y-2">
                  {pool.map((entry) => (
                      <li
                        key={entry.ref}
                        className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-gray-200 px-3 py-2"
                      >
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-sm font-semibold text-gray-800">{entry.question}</span>
                          <span className="shrink-0 whitespace-nowrap text-[10px] font-bold text-violet-700">
                            {entry.kind === 'help' ? `카테고리 · ${entry.categoryLabel}` : '기본 FAQ'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAddOneConfirmId(entry.ref)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#22282E] px-2.5 py-1.5 text-xs font-bold text-white hover:bg-[#363d46]"
                        >
                          <Plus size={14} />
                          추가
                        </button>
                      </li>
                  ))}
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
                  총 <strong className="text-[#22282E]">{pool.length}</strong>개 항목을 한 번에 추가할까요?
                </p>
                <ul className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 text-xs text-gray-700">
                  {pool.map((entry) => (
                    <li key={entry.ref} className="leading-snug">
                      · {entry.question}
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
                      「{poolLabel(addOneConfirmId)}」
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
                      「{poolLabel(removeConfirmId)}」
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
