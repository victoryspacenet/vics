import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Flame,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import {
  CATEGORY_HELP_ILLUSTRATIONS,
  getCategoryHelpMap,
  saveAllCategoryHelp,
} from '../../lib/inquiryCategoryHelp'
import {
  deleteInquiryHelpCategory,
  insertInquiryHelpCategory,
  isValidHelpCategorySlug,
  listInquiryHelpCategories,
} from '../../lib/inquiryHelpCategories'
import { useUIStore } from '../../store/uiStore'
import { cn } from '../../lib/utils'

const ILLUSTRATION_LABEL = {
  '': '없음',
  points: '포인트',
  vote: '투표',
  report: '신고',
  profile: '프로필',
  ranking: '랭킹',
  delete: '계정 삭제',
}

const emptySlot = () => ({ listed: [], pool: [] })

function newItem() {
  return {
    id: crypto.randomUUID(),
    title: '',
    answer: '',
    stepsText: '',
    body: '',
    actions: [{ text: '', to: '' }],
    illustration: '',
  }
}

export function InquiryCategoryFaqAdminPage() {
  const { showToast } = useUIStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  /** @type {{ slug: string, label: string, sort_order: number }[]} */
  const [categories, setCategories] = useState([])
  const [byCategory, setByCategory] = useState({})
  const [activeSlug, setActiveSlug] = useState(null)

  const [itemModal, setItemModal] = useState(null)
  const [removeConfirm, setRemoveConfirm] = useState(null)
  /** 풀(추가 가능한 도움말)에서 영구 삭제 확인 */
  const [poolDeleteConfirm, setPoolDeleteConfirm] = useState(null)
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)
  const [addAllConfirmOpen, setAddAllConfirmOpen] = useState(false)
  const [addOneConfirmId, setAddOneConfirmId] = useState(null)
  /** 수정 모달 — 반영 확인 */
  const [editApplyConfirmOpen, setEditApplyConfirmOpen] = useState(false)
  /** 추가 모달 — 목록에 넣기 확인 */
  const [addApplyConfirmOpen, setAddApplyConfirmOpen] = useState(false)
  /** 추가 모달 — 필수 항목 미입력 시 작은 경고 */
  const [itemRequiredWarning, setItemRequiredWarning] = useState(null)
  /** 카테고리 추가 */
  const [addCategoryOpen, setAddCategoryOpen] = useState(false)
  const [newCatLabel, setNewCatLabel] = useState('')
  const [newCatSlug, setNewCatSlug] = useState('')
  const [addCategoryConfirmOpen, setAddCategoryConfirmOpen] = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)
  /** 카테고리 삭제 확인 */
  const [deleteCategoryConfirm, setDeleteCategoryConfirm] = useState(null)
  const [deletingCategory, setDeletingCategory] = useState(false)

  const closeItemModal = () => {
    setItemModal(null)
    setEditApplyConfirmOpen(false)
    setAddApplyConfirmOpen(false)
    setItemRequiredWarning(null)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [map, cats] = await Promise.all([getCategoryHelpMap(), listInquiryHelpCategories()])
      if (cancelled) return
      const merged = {}
      for (const c of cats) {
        merged[c.slug] = map[c.slug] || emptySlot()
      }
      setCategories(cats)
      setByCategory(merged)
      if (cats.length) {
        setActiveSlug((prev) => (prev && cats.some((x) => x.slug === prev) ? prev : cats[0].slug))
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onCat = () => {
      listInquiryHelpCategories().then((cats) => {
        setCategories(cats)
        setByCategory((prev) => {
          const next = { ...prev }
          const slugSet = new Set(cats.map((c) => c.slug))
          for (const k of Object.keys(next)) {
            if (!slugSet.has(k)) delete next[k]
          }
          for (const c of cats) {
            if (!next[c.slug]) next[c.slug] = emptySlot()
          }
          return next
        })
        setActiveSlug((prev) => {
          if (!cats.length) return null
          if (prev && cats.some((c) => c.slug === prev)) return prev
          return cats[0].slug
        })
      })
    }
    window.addEventListener('vics:inquiry-help-categories:updated', onCat)
    return () => window.removeEventListener('vics:inquiry-help-categories:updated', onCat)
  }, [])

  useEffect(() => {
    setRemoveConfirm(null)
    setPoolDeleteConfirm(null)
    setItemModal(null)
    setAddAllConfirmOpen(false)
    setAddOneConfirmId(null)
    setEditApplyConfirmOpen(false)
    setAddApplyConfirmOpen(false)
    setItemRequiredWarning(null)
    setAddCategoryConfirmOpen(false)
    setAddCategoryOpen(false)
    setDeleteCategoryConfirm(null)
  }, [activeSlug])

  const activeLabel = useMemo(
    () => categories.find((c) => c.slug === activeSlug)?.label || '',
    [categories, activeSlug],
  )

  const slot = activeSlug ? byCategory[activeSlug] || emptySlot() : emptySlot()
  const listed = slot.listed || []
  const pool = slot.pool || []

  const updateSlot = (fn) => {
    if (!activeSlug) return
    setByCategory((prev) => {
      const cur = prev[activeSlug] || emptySlot()
      const next = fn({ listed: [...cur.listed], pool: [...cur.pool] })
      return { ...prev, [activeSlug]: next }
    })
  }

  const updateListed = (fn) => {
    updateSlot((s) => ({ ...s, listed: fn(s.listed) }))
  }

  const move = (index, dir) => {
    updateListed((items) => {
      const next = [...items]
      const j = index + dir
      if (j < 0 || j >= next.length) return items
      ;[next[index], next[j]] = [next[j], next[index]]
      return next
    })
  }

  const removeListedToPool = (id) => {
    updateSlot((s) => {
      const item = s.listed.find((x) => x.id === id)
      if (!item) return s
      return {
        listed: s.listed.filter((x) => x.id !== id),
        pool: [...s.pool, item],
      }
    })
  }

  const addFromPool = (id) => {
    updateSlot((s) => {
      const item = s.pool.find((x) => x.id === id)
      if (!item) return s
      return {
        listed: [...s.listed, item],
        pool: s.pool.filter((x) => x.id !== id),
      }
    })
  }

  const removePoolItem = (id) => {
    updateSlot((s) => ({
      ...s,
      pool: s.pool.filter((x) => x.id !== id),
    }))
  }

  const addAllFromPool = () => {
    updateSlot((s) => ({
      listed: [...s.listed, ...s.pool],
      pool: [],
    }))
  }

  const totalCount = useMemo(
    () =>
      categories.reduce((n, c) => {
        const sl = byCategory[c.slug] || emptySlot()
        return n + sl.listed.length + sl.pool.length
      }, 0),
    [byCategory, categories],
  )

  const requestAddCategoryConfirm = () => {
    const label = newCatLabel.trim()
    const slug = newCatSlug.trim().toLowerCase()
    if (!label) {
      showToast('표시 이름을 입력해 주세요.', 'error')
      return
    }
    if (!slug) {
      showToast('슬러그를 입력해 주세요.', 'error')
      return
    }
    if (!isValidHelpCategorySlug(slug)) {
      showToast('슬러그는 영문 소문자로 시작하고, 영문·숫자·하이픈만 사용할 수 있어요.', 'error')
      return
    }
    setAddCategoryConfirmOpen(true)
  }

  const submitNewCategory = async () => {
    const label = newCatLabel.trim()
    const slug = newCatSlug.trim().toLowerCase()
    if (!label || !slug || !isValidHelpCategorySlug(slug)) return
    setAddingCategory(true)
    try {
      await insertInquiryHelpCategory({ label, slug })
      const cats = await listInquiryHelpCategories()
      setCategories(cats)
      setByCategory((prev) => ({ ...prev, [slug]: prev[slug] || emptySlot() }))
      setActiveSlug(slug)
      setAddCategoryOpen(false)
      setAddCategoryConfirmOpen(false)
      setNewCatLabel('')
      setNewCatSlug('')
      showToast('카테고리가 추가됐어요. 도움말을 등록한 뒤 저장하기를 눌러 주세요.', 'success')
    } catch (e) {
      showToast(e?.message || '추가에 실패했어요.', 'error')
    } finally {
      setAddingCategory(false)
    }
  }

  const confirmDeleteCategory = async () => {
    const slug = deleteCategoryConfirm?.slug
    if (!slug) return
    setDeletingCategory(true)
    try {
      await deleteInquiryHelpCategory(slug)
      const cats = await listInquiryHelpCategories()
      setCategories(cats)
      setByCategory((prev) => {
        const next = { ...prev }
        delete next[slug]
        return next
      })
      setActiveSlug((prev) => {
        if (prev !== slug) return prev
        return cats[0]?.slug ?? null
      })
      setDeleteCategoryConfirm(null)
      showToast('카테고리와 해당 도움말 데이터를 삭제했어요.', 'success')
    } catch (e) {
      showToast(e?.message || '삭제에 실패했어요.', 'error')
    } finally {
      setDeletingCategory(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveAllCategoryHelp(byCategory)
      showToast('저장됐어요. 문의하기 카테고리별 도움말에 반영됩니다.', 'success')
      setSaveConfirmOpen(false)
    } catch (e) {
      showToast(e?.message || '저장에 실패했어요.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const openAdd = () => {
    setItemModal({ mode: 'add', ...newItem() })
  }

  const openEdit = (item) => {
    setItemModal({
      mode: 'edit',
      id: item.id,
      title: item.title,
      answer: item.answer ?? '',
      stepsText: (item.steps || []).join('\n'),
      body: item.body ?? '',
      actions: item.actions?.length ? item.actions.map((a) => ({ ...a })) : [{ text: '', to: '' }],
      illustration: item.illustration || '',
    })
  }

  /** @returns {{ payload: object } | { error: string }} */
  const getItemModalPayloadOrError = () => {
    if (!itemModal) return { error: '입력 정보가 없어요.' }
    const title = String(itemModal.title || '').trim()
    if (!title) return { error: '제목을 입력해 주세요.' }
    const answer = String(itemModal.answer || '').trim()
    if (!answer) return { error: '요약을 입력해 주세요.' }
    const steps = String(itemModal.stepsText || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    const body = String(itemModal.body || '').trim()
    const actions = (itemModal.actions || [])
      .filter((a) => String(a.text || '').trim() && String(a.to || '').trim())
      .map((a) => ({ text: String(a.text).trim(), to: String(a.to).trim() }))
    if (steps.length === 0) {
      return { error: '단계별 설명을 한 줄에 한 단계씩 입력해 주세요.' }
    }
    const illustration = itemModal.illustration && CATEGORY_HELP_ILLUSTRATIONS.includes(itemModal.illustration)
      ? itemModal.illustration
      : ''
    return {
      payload: {
        id: itemModal.id,
        title,
        answer,
        steps,
        actions,
        body,
        illustration,
      },
    }
  }

  /** @returns {null | { id: string, title: string, answer: string, steps: string[], actions: {text:string,to:string}[], body: string, illustration: string }} */
  const buildPayloadFromItemModal = () => {
    const r = getItemModalPayloadOrError()
    if ('error' in r) {
      showToast(r.error, 'error')
      return null
    }
    return r.payload
  }

  const performCommitItemModal = (payload, mode) => {
    if (mode === 'add') {
      updateListed((items) => [...items, payload])
    } else {
      setByCategory((prev) => {
        const sl = prev[activeSlug] || emptySlot()
        const inListed = sl.listed.some((x) => x.id === payload.id)
        if (inListed) {
          return {
            ...prev,
            [activeSlug]: {
              ...sl,
              listed: sl.listed.map((it) => (it.id === payload.id ? { ...it, ...payload } : it)),
            },
          }
        }
        return {
          ...prev,
          [activeSlug]: {
            ...sl,
            pool: sl.pool.map((it) => (it.id === payload.id ? { ...it, ...payload } : it)),
          },
        }
      })
    }
    setItemModal(null)
    setEditApplyConfirmOpen(false)
    setAddApplyConfirmOpen(false)
    showToast('목록에 반영했어요. 유저 화면에 적용하려면 저장하기를 눌러 주세요.', 'success')
  }

  const onClickCommitItemModal = () => {
    const r = getItemModalPayloadOrError()
    if ('error' in r) {
      if (itemModal?.mode === 'add') setItemRequiredWarning(r.error)
      else showToast(r.error, 'error')
      return
    }
    if (itemModal?.mode === 'edit') {
      setEditApplyConfirmOpen(true)
      return
    }
    setAddApplyConfirmOpen(true)
  }

  const onConfirmEditApply = () => {
    const payload = buildPayloadFromItemModal()
    if (!payload || itemModal?.mode !== 'edit') return
    performCommitItemModal(payload, 'edit')
  }

  const onConfirmAddApply = () => {
    const payload = buildPayloadFromItemModal()
    if (!payload || itemModal?.mode !== 'add') return
    performCommitItemModal(payload, 'add')
  }

  const previewSubtitle = (item) => {
    if (item.answer?.trim()) return item.answer
    if (item.steps?.[0]) return item.steps[0]
    return item.body?.trim() || ''
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
              <h1 className="text-lg font-black text-[#22282E]">카테고리별 도움말</h1>
              <p className="text-xs font-medium text-gray-500">
                유저 화면은 FAQ 상세와 같이 요약 → 단계 → 바로가기로 보입니다.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-gray-400" size={32} />
          </div>
        ) : (
          <div className="space-y-6">
            {categories.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
                <p className="text-sm font-medium text-gray-600 mb-4">
                  등록된 카테고리가 없어요. 먼저 카테고리를 추가해 주세요.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setNewCatLabel('')
                    setNewCatSlug('')
                    setAddCategoryOpen(true)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700"
                >
                  <Plus size={16} />
                  카테고리 추가
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex gap-2 overflow-x-auto pb-1 flex-1 min-w-0">
                    {categories.map((c) => (
                      <button
                        key={c.slug}
                        type="button"
                        onClick={() => setActiveSlug(c.slug)}
                        className={cn(
                          'shrink-0 rounded-xl px-4 py-2.5 text-sm font-black transition-colors',
                          activeSlug === c.slug
                            ? 'bg-violet-600 text-white shadow-md'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
                        )}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewCatLabel('')
                      setNewCatSlug('')
                      setAddCategoryOpen(true)
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-800 hover:bg-violet-100 shrink-0"
                  >
                    <Plus size={14} />
                    카테고리 추가
                  </button>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100">
                    <Flame size={18} className="text-orange-600" />
                  </div>
                  <h2 className="text-sm font-black text-[#22282E]">
                    {activeLabel || activeSlug} — 노출 중 (위에서부터 순서)
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      activeSlug &&
                      setDeleteCategoryConfirm({
                        slug: activeSlug,
                        label: activeLabel || activeSlug,
                      })
                    }
                    disabled={!activeSlug}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-40"
                  >
                    <Trash2 size={14} />
                    카테고리 삭제
                  </button>
                  <button
                    type="button"
                    onClick={openAdd}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#22282E] px-3 py-2 text-xs font-bold text-white hover:bg-[#363d46]"
                  >
                    <Plus size={14} />
                    새 항목 추가
                  </button>
                </div>
              </div>

              {listed.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">
                  아래 「추가 가능한 도움말」에서 항목을 넣거나, 「새 항목 추가」로 등록해 주세요.
                </p>
              ) : (
                <ul className="space-y-2">
                  {listed.map((item, index) => (
                    <li
                      key={item.id}
                      className="flex items-start gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5"
                    >
                      <span className="mt-0.5 text-xs font-black tabular-nums text-gray-400">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#22282E]">{item.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{previewSubtitle(item)}</p>
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
                          disabled={index === listed.length - 1}
                          className="rounded p-1 text-gray-500 hover:bg-white disabled:opacity-30"
                          aria-label="아래로"
                        >
                          <ChevronDown size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="rounded p-1 text-violet-600 hover:bg-violet-50"
                          aria-label="수정"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoveConfirm({ id: item.id, title: item.title })}
                          className="rounded p-1 text-red-500 hover:bg-red-50"
                          aria-label="목록에서 제거"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-black text-[#22282E]">추가 가능한 도움말</h2>
                {pool.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAddAllConfirmOpen(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                  >
                    <Plus size={14} />
                    풀 항목 모두 추가
                  </button>
                )}
              </div>
              <p className="mb-3 text-xs text-gray-500">
                노출 목록에서 제거한 항목이 여기로 이동합니다. 다시 추가하면 유저 화면에 표시돼요. 풀에서 삭제하면 DB에서도
                제거되며(저장 시), 복구할 수 없어요.
              </p>
              {pool.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-500">풀에 있는 도움말이 없어요.</p>
              ) : (
                <ul className="space-y-2">
                  {pool.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-gray-200 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{previewSubtitle(item)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="rounded-lg p-2 text-violet-600 hover:bg-violet-50"
                          aria-label="수정"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPoolDeleteConfirm({ id: item.id, title: item.title })}
                          className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                          aria-label="풀에서 삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddOneConfirmId(item.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#22282E] px-2.5 py-1.5 text-xs font-bold text-white hover:bg-[#363d46]"
                        >
                          <Plus size={14} />
                          추가
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSaveConfirmOpen(true)}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3.5 text-sm font-black text-white shadow-md transition hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              저장하기
            </button>
              </>
            )}

            <Modal
              isOpen={addCategoryOpen}
              onClose={() => {
                setAddCategoryOpen(false)
                setAddCategoryConfirmOpen(false)
              }}
              title="카테고리 추가"
            >
              <div className="space-y-4">
                <p className="text-xs text-gray-500">
                  유저 문의하기의 「카테고리별 도움말」에 탭으로 표시됩니다. 슬러그는 URL에 쓰이므로 영문·숫자·하이픈만
                  사용해 주세요.
                </p>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-gray-600">표시 이름</label>
                  <input
                    type="text"
                    value={newCatLabel}
                    onChange={(e) => setNewCatLabel(e.target.value)}
                    placeholder="예: 결제·환불"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold text-[#22282E] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-gray-600">슬러그 (URL)</label>
                  <input
                    type="text"
                    value={newCatSlug}
                    onChange={(e) => setNewCatSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="예: billing"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-mono text-[#22282E] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAddCategoryOpen(false)
                      setAddCategoryConfirmOpen(false)
                    }}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={requestAddCategoryConfirm}
                    className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700"
                  >
                    추가
                  </button>
                </div>
              </div>
            </Modal>

            <Modal
              isOpen={addCategoryConfirmOpen}
              onClose={() => !addingCategory && setAddCategoryConfirmOpen(false)}
              title="카테고리 추가 확인"
            >
              <div className="space-y-4">
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                  <p className="text-xs leading-relaxed text-amber-900">
                    아래 내용으로 카테고리 탭이 생깁니다. 유저 문의하기·도움말 URL에 반영되며, 이후{' '}
                    <strong>저장하기</strong>로 도움말을 서버에 올려 주세요.
                  </p>
                </div>
                <dl className="rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3 text-sm space-y-2">
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 font-bold text-gray-500">표시 이름</dt>
                    <dd className="font-semibold text-[#22282E]">{newCatLabel.trim() || '—'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 font-bold text-gray-500">슬러그</dt>
                    <dd className="font-mono text-[13px] text-[#22282E]">
                      {newCatSlug.trim().toLowerCase() || '—'}
                    </dd>
                  </div>
                </dl>
                <div className="flex justify-end gap-3 pt-1">
                  <button
                    type="button"
                    disabled={addingCategory}
                    onClick={() => setAddCategoryConfirmOpen(false)}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    disabled={addingCategory}
                    onClick={() => submitNewCategory()}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {addingCategory ? <Loader2 size={16} className="animate-spin" /> : null}
                    추가하기
                  </button>
                </div>
              </div>
            </Modal>

            <Modal
              isOpen={deleteCategoryConfirm != null}
              onClose={() => !deletingCategory && setDeleteCategoryConfirm(null)}
              title="카테고리 삭제"
            >
              {deleteCategoryConfirm != null && (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-600" />
                    <p className="text-xs leading-relaxed text-red-900">
                      이 카테고리 탭과 <strong>서버에 저장된</strong> 이 카테고리의 모든 도움말 행이 함께 삭제됩니다. 되돌릴
                      수 없어요.
                    </p>
                  </div>
                  <dl className="rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3 text-sm space-y-2">
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 font-bold text-gray-500">표시 이름</dt>
                      <dd className="font-semibold text-[#22282E]">{deleteCategoryConfirm.label || '—'}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 font-bold text-gray-500">슬러그</dt>
                      <dd className="font-mono text-[13px] text-[#22282E]">{deleteCategoryConfirm.slug || '—'}</dd>
                    </div>
                  </dl>
                  <div className="flex justify-end gap-3 pt-1">
                    <button
                      type="button"
                      disabled={deletingCategory}
                      onClick={() => setDeleteCategoryConfirm(null)}
                      className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      disabled={deletingCategory}
                      onClick={() => confirmDeleteCategory()}
                      className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {deletingCategory ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      삭제하기
                    </button>
                  </div>
                </div>
              )}
            </Modal>

            <Modal
              isOpen={itemModal != null}
              onClose={closeItemModal}
              title={itemModal?.mode === 'add' ? '도움말 항목 추가' : '도움말 항목 수정'}
              bodyClassName="p-0 overflow-hidden flex flex-col max-h-[min(85vh,640px)]"
            >
              {itemModal != null && (
                <div className="flex flex-col flex-1 min-h-0">
                  <div className="overflow-y-auto p-6 space-y-4 flex-1">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-gray-600">제목 (Q)</label>
                      <input
                        type="text"
                        value={itemModal.title}
                        onChange={(e) => setItemModal((m) => ({ ...m, title: e.target.value }))}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold text-[#22282E] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                        placeholder="예: 포인트는 언제 들어오나요?"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-gray-600">요약 (A 첫 문단)</label>
                      <textarea
                        value={itemModal.answer}
                        onChange={(e) => setItemModal((m) => ({ ...m, answer: e.target.value }))}
                        rows={3}
                        className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-[#22282E] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                        placeholder="한두 문장으로 핵심 답변을 적어 주세요."
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-gray-600">
                        단계별 설명 (한 줄에 한 단계)
                      </label>
                      <textarea
                        value={itemModal.stepsText}
                        onChange={(e) => setItemModal((m) => ({ ...m, stepsText: e.target.value }))}
                        rows={6}
                        className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-[#22282E] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 font-mono text-[13px]"
                        placeholder={'1단계 설명\n2단계 설명\n3단계 설명'}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-gray-600">일러스트 (선택)</label>
                      <select
                        value={itemModal.illustration}
                        onChange={(e) => setItemModal((m) => ({ ...m, illustration: e.target.value }))}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold text-[#22282E] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 bg-white"
                      >
                        <option value="">{ILLUSTRATION_LABEL['']}</option>
                        {CATEGORY_HELP_ILLUSTRATIONS.filter(Boolean).map((key) => (
                          <option key={key} value={key}>
                            {ILLUSTRATION_LABEL[key] || key}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-gray-600">추가 설명 (선택, 단계 아래)</label>
                      <textarea
                        value={itemModal.body}
                        onChange={(e) => setItemModal((m) => ({ ...m, body: e.target.value }))}
                        rows={3}
                        className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-[#22282E] focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                        placeholder="요약·단계 뒤에 덧붙일 안내가 있으면 입력하세요."
                      />
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <label className="text-xs font-bold text-gray-600">바로 가기 버튼</label>
                        <button
                          type="button"
                          onClick={() =>
                            setItemModal((m) => ({
                              ...m,
                              actions: [...(m.actions || []), { text: '', to: '' }],
                            }))
                          }
                          className="text-xs font-bold text-violet-600 hover:text-violet-800"
                        >
                          + 추가
                        </button>
                      </div>
                      <div className="space-y-2">
                        {(itemModal.actions || []).map((a, i) => (
                          <div key={i} className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                            <input
                              type="text"
                              value={a.text}
                              onChange={(e) =>
                                setItemModal((m) => {
                                  const next = [...(m.actions || [])]
                                  next[i] = { ...next[i], text: e.target.value }
                                  return { ...m, actions: next }
                                })
                              }
                              placeholder="버튼 문구"
                              className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                            />
                            <input
                              type="text"
                              value={a.to}
                              onChange={(e) =>
                                setItemModal((m) => {
                                  const next = [...(m.actions || [])]
                                  next[i] = { ...next[i], to: e.target.value }
                                  return { ...m, actions: next }
                                })
                              }
                              placeholder="/path 또는 /inquiry/..."
                              className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-mono"
                            />
                            {(itemModal.actions || []).length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setItemModal((m) => ({
                                    ...m,
                                    actions: (m.actions || []).filter((_, j) => j !== i),
                                  }))
                                }
                                className="text-xs text-red-500 shrink-0"
                              >
                                삭제
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 justify-end gap-3 border-t border-gray-100 bg-gray-50/80 px-6 py-4">
                    <button
                      type="button"
                      onClick={closeItemModal}
                      className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-white"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={onClickCommitItemModal}
                      className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700"
                    >
                      {itemModal.mode === 'add' ? '목록에 넣기' : '반영'}
                    </button>
                  </div>
                </div>
              )}
            </Modal>

            <Modal
              isOpen={itemRequiredWarning != null}
              onClose={() => setItemRequiredWarning(null)}
              title="필수 항목"
            >
              {itemRequiredWarning != null && (
                <div className="space-y-4">
                  <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/90 bg-amber-50 px-3.5 py-3">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" strokeWidth={2.2} />
                    <p className="text-sm font-medium leading-relaxed text-amber-950/90">{itemRequiredWarning}</p>
                  </div>
                  <div className="flex justify-end pt-0.5">
                    <button
                      type="button"
                      onClick={() => setItemRequiredWarning(null)}
                      className="rounded-xl bg-[#22282E] px-4 py-2 text-sm font-bold text-white hover:bg-[#363d46]"
                    >
                      확인
                    </button>
                  </div>
                </div>
              )}
            </Modal>

            <Modal
              isOpen={addApplyConfirmOpen}
              onClose={() => setAddApplyConfirmOpen(false)}
              title="새 항목을 목록에 추가"
            >
              {itemModal != null && itemModal.mode === 'add' && (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                    <p className="text-xs leading-relaxed text-amber-900">
                      새 도움말을 현재 카테고리 노출 목록 맨 아래에 붙입니다. 유저 화면에 적용하려면 이후{' '}
                      <strong>저장하기</strong>를 눌러 주세요.
                    </p>
                  </div>
                  <p className="text-sm text-gray-600">
                    <span className="font-bold text-[#22282E]">「{itemModal.title?.trim() || '항목'}」</span> 항목을
                    노출 목록에 넣을까요?
                  </p>
                  <div className="flex justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setAddApplyConfirmOpen(false)}
                      className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={onConfirmAddApply}
                      className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700"
                    >
                      목록에 넣기
                    </button>
                  </div>
                </div>
              )}
            </Modal>

            <Modal
              isOpen={editApplyConfirmOpen}
              onClose={() => setEditApplyConfirmOpen(false)}
              title="수정 내용 반영"
            >
              {itemModal != null && itemModal.mode === 'edit' && (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                    <p className="text-xs leading-relaxed text-amber-900">
                      입력한 내용으로 이 도움말 항목을 갱신합니다. 유저 화면에 적용하려면 이후{' '}
                      <strong>저장하기</strong>를 눌러 주세요.
                    </p>
                  </div>
                  <p className="text-sm text-gray-600">
                    <span className="font-bold text-[#22282E]">「{itemModal.title?.trim() || '항목'}」</span> 수정을
                    목록에 반영할까요?
                  </p>
                  <div className="flex justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditApplyConfirmOpen(false)}
                      className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={onConfirmEditApply}
                      className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700"
                    >
                      반영
                    </button>
                  </div>
                </div>
              )}
            </Modal>

            <Modal
              isOpen={addAllConfirmOpen}
              onClose={() => setAddAllConfirmOpen(false)}
              title="풀 항목 모두 추가"
            >
              <div className="space-y-4">
                <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <Plus size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                  <p className="text-xs leading-relaxed text-emerald-900">
                    아래 항목을 노출 목록 맨 아래 순서로 붙입니다. 적용하려면 화면 하단의 <strong>저장하기</strong>를 눌러
                    주세요.
                  </p>
                </div>
                <p className="text-sm text-gray-600">
                  총 <strong className="text-[#22282E]">{pool.length}</strong>개 항목을 한 번에 추가할까요?
                </p>
                <ul className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 text-xs text-gray-700">
                  {pool.map((p) => (
                    <li key={p.id} className="leading-snug">
                      · {p.title}
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
                        '노출 목록에 추가했어요. 유저 화면에 반영하려면 하단 저장하기를 눌러 주세요.',
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
                      이 항목을 노출 목록 맨 아래에 붙입니다. 적용하려면 화면 하단의 <strong>저장하기</strong>를 눌러
                      주세요.
                    </p>
                  </div>
                  <p className="text-sm text-gray-600">
                    <span className="font-bold text-[#22282E]">
                      「{pool.find((x) => x.id === addOneConfirmId)?.title || '항목'}」
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
                        addFromPool(id)
                        setAddOneConfirmId(null)
                        showToast('노출 목록에 추가했어요. 유저 화면에 반영하려면 하단 저장하기를 눌러 주세요.', 'success')
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
                    세 카테고리의 노출 목록·풀 상태를 서버에 저장하고, 유저 문의하기 화면에 반영합니다.
                  </p>
                </div>
                <p className="text-sm text-gray-600">
                  총 <strong className="text-[#22282E]">{totalCount}</strong>개 항목을 저장할까요?
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
              isOpen={poolDeleteConfirm != null}
              onClose={() => setPoolDeleteConfirm(null)}
              title="풀에서 삭제"
            >
              {poolDeleteConfirm != null && (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-600" />
                    <p className="text-xs leading-relaxed text-red-900">
                      「추가 가능한 도움말」에서 이 항목을 완전히 삭제합니다. 화면에서는 바로 빠지고, 서버에는 하단{' '}
                      <strong>저장하기</strong>를 눌렀을 때 반영됩니다. 삭제 후에는 복구할 수 없어요.
                    </p>
                  </div>
                  <p className="text-sm text-gray-600">
                    <span className="font-bold text-[#22282E]">「{poolDeleteConfirm.title || '(제목 없음)'}」</span>을
                    삭제할까요?
                  </p>
                  <div className="flex justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setPoolDeleteConfirm(null)}
                      className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const id = poolDeleteConfirm.id
                        removePoolItem(id)
                        setPoolDeleteConfirm(null)
                        if (itemModal?.id === id) closeItemModal()
                        showToast('풀에서 삭제했어요. 서버에 반영하려면 저장하기를 눌러 주세요.', 'success')
                      }}
                      className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              )}
            </Modal>

            <Modal
              isOpen={removeConfirm != null}
              onClose={() => setRemoveConfirm(null)}
              title="도움말 목록에서 제거"
            >
              {removeConfirm != null && (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                    <p className="text-xs leading-relaxed text-amber-900">
                      아래 항목을 노출 목록에서 뺍니다. 「추가 가능한 도움말」로 이동하며, 적용하려면 화면 하단의{' '}
                      <strong>저장하기</strong>를 눌러 주세요.
                    </p>
                  </div>
                  <p className="text-sm text-gray-600">
                    <span className="font-bold text-[#22282E]">「{removeConfirm.title}」</span> 항목을 노출 목록에서
                    제거할까요?
                  </p>
                  <div className="flex justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setRemoveConfirm(null)}
                      className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        removeListedToPool(removeConfirm.id)
                        setRemoveConfirm(null)
                        showToast(
                          '노출 목록에서 제거했어요. 「추가 가능한 도움말」로 옮겼습니다. 반영하려면 저장하기를 눌러 주세요.',
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
