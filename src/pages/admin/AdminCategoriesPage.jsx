import { useState } from 'react'
import { X, Pin, PinOff, LayoutGrid, AlertTriangle } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { Modal } from '../../components/ui/Modal'
import { NewCategoryCreatorPanel } from '../../components/admin/NewCategoryCreatorPanel'
import { cn } from '../../lib/utils'
import {
  DEFAULT_CATEGORY_EMOJI_BY_ID,
  getCategoryConfig,
  removeActiveCategory,
  updateCategoryPinned,
} from '../../lib/categoryAdminStorage'

function categoryRowIcon(c) {
  if (c.iconEmoji) return { kind: 'emoji', value: c.iconEmoji }
  if (c.iconImageDataUrl) return { kind: 'img', value: c.iconImageDataUrl }
  return { kind: 'emoji', value: DEFAULT_CATEGORY_EMOJI_BY_ID[c.id] || '📌' }
}

function SectionHeader({ icon, title, description }) {
  const Icon = icon
  return (
    <div className="border-b border-gray-100/90 bg-gradient-to-r from-slate-50/95 via-white to-emerald-50/40 px-4 py-3.5 sm:px-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100/90 text-emerald-700 shadow-sm ring-1 ring-emerald-200/50">
          <Icon size={18} strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-black tracking-tight text-[#22282E]">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs font-medium text-gray-500">{description}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export function AdminCategoriesPage() {
  const { showToast } = useUIStore()
  const [config, setConfig] = useState(getCategoryConfig())
  const [deleteTarget, setDeleteTarget] = useState(null)

  const handleRemoveCategory = (id) => {
    removeActiveCategory(id)
    setConfig(getCategoryConfig())
    showToast('카테고리가 제거됐어요.', 'success')
  }

  const confirmRemoveCategory = () => {
    if (!deleteTarget?.id) return
    handleRemoveCategory(deleteTarget.id)
    setDeleteTarget(null)
  }

  const handleTogglePinned = (id) => {
    const data = getCategoryConfig()
    const cat = data.activeCategories.find((c) => c.id === id)
    if (!cat) return
    const wasPinned = !!cat.pinned
    const updated = updateCategoryPinned(id, !wasPinned)
    if (updated) {
      setConfig(updated)
      showToast(wasPinned ? '상단 고정이 해제됐어요.' : '상단에 고정됐어요.', 'success')
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* 페이지 헤더 */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-200/70 bg-gradient-to-br from-emerald-50/95 via-white to-teal-50/60 px-5 py-6 shadow-sm">
        <div
          className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-emerald-400/15 blur-2xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-600/30 ring-4 ring-white/80">
            <LayoutGrid size={26} strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-black tracking-tight text-[#22282E]">추천 카테고리 설정</h1>
          </div>
        </div>
      </div>

      {/* 현재 활성화된 카테고리 */}
      <div className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm">
        <SectionHeader
          icon={LayoutGrid}
          title="현재 활성화된 카테고리"
          description="홈·랭킹의 카테고리 탭/사이드바에서 목록 순서만 바뀝니다. 고정한 항목이 ‘전체’ 바로 아래에 먼저 나와요."
        />
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap gap-2.5">
            {config.activeCategories.map((c) => {
              const vis = categoryRowIcon(c)
              return (
              <div
                key={c.id}
                className={cn(
                  'group inline-flex max-w-full flex-col gap-2 rounded-xl border px-3 py-2.5 shadow-sm transition-all sm:inline-flex sm:flex-row sm:items-center sm:gap-2',
                  c.pinned
                    ? 'border-amber-200/90 bg-gradient-to-br from-amber-50/90 to-white ring-1 ring-amber-100/80'
                    : 'border-gray-200/90 bg-gradient-to-br from-gray-50/80 to-white hover:border-emerald-200/80'
                )}
              >
                <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-sm font-bold text-[#22282E]">
                  <span className="shrink-0 text-fuchsia-600">#</span>
                  {vis.kind === 'img' ? (
                    <img
                      src={vis.value}
                      alt=""
                      className="h-4 w-4 shrink-0 rounded object-cover ring-1 ring-gray-200/80"
                    />
                  ) : (
                    <span className="shrink-0 text-base leading-none" aria-hidden>
                      {vis.value}
                    </span>
                  )}
                  <span className="min-w-0 truncate">{c.label}</span>
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleTogglePinned(c.id)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold transition-colors',
                      c.pinned
                        ? 'bg-amber-500 text-white shadow-sm hover:bg-amber-600'
                        : 'bg-gray-200/90 text-gray-600 hover:bg-gray-300'
                    )}
                    title={c.pinned ? '상단 고정 해제' : '상단 고정'}
                  >
                    {c.pinned ? <Pin size={12} strokeWidth={2.5} /> : <PinOff size={12} strokeWidth={2.5} />}
                    {c.pinned ? '고정됨' : '고정'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ id: c.id, label: c.label })}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
                    aria-label="삭제"
                  >
                    <X size={16} strokeWidth={2.25} />
                  </button>
                </div>
              </div>
              )
            })}
          </div>
        </div>
      </div>

      <NewCategoryCreatorPanel
        existingIds={config.activeCategories.map((c) => c.id)}
        onNotify={(payload) => {
          if (payload.type === 'error') {
            showToast(payload.message || '저장에 실패했어요.', 'error')
            return
          }
          setConfig(getCategoryConfig())
          showToast('카테고리가 추가됐어요.', 'success')
        }}
      />

      {/* 삭제 확인 */}
      <Modal
        isOpen={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        title="카테고리 삭제"
      >
        <div className="space-y-4">
          <div className="flex gap-3 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-3 text-sm text-amber-950">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
            <p className="leading-relaxed">
              <span className="font-bold">#{deleteTarget?.label}</span> 카테고리를 목록에서 제거할까요?
              홈·랭킹에서 해당 탭이 사라지며, 매치업 생성 시에도 선택할 수 없게 돼요.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100"
            >
              취소
            </button>
            <button
              type="button"
              onClick={confirmRemoveCategory}
              className="rounded-xl bg-red-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-red-700"
            >
              삭제
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
