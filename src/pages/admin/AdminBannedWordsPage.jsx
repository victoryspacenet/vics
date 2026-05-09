import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldAlert, Plus, Trash2, Search, X, Loader2, RefreshCw } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { useUIStore } from '../../store/uiStore'
import { supabase } from '../../lib/supabase'

const CATEGORY_ORDER = ['hate', 'spam', 'adult', 'general']

const CATEGORIES = [
  { id: 'all',     label: '전체' },
  { id: 'hate',    label: '혐오/욕설',    color: 'bg-red-100 text-red-700 border-red-200' },
  { id: 'spam',    label: '스팸/광고',    color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { id: 'adult',   label: '성인/부적절', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { id: 'general', label: '일반',         color: 'bg-gray-100 text-gray-700 border-gray-200' },
]

function getCategoryColor(cat) {
  return CATEGORIES.find((c) => c.id === cat)?.color ?? 'bg-gray-100 text-gray-700 border-gray-200'
}
function getCategoryLabel(cat) {
  return CATEGORIES.find((c) => c.id === cat)?.label ?? cat
}

export function AdminBannedWordsPage() {
  const { showToast } = useUIStore()
  const [words, setWords] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [addWord, setAddWord] = useState('')
  const [addCategory, setAddCategory] = useState('general')
  const [addConfirmOpen, setAddConfirmOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [bulkSelectMode, setBulkSelectMode] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false)

  const loadWords = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('admin_banned_words')
        .select('*')
        .order('created_at', { ascending: false })
      setWords(data || [])
    } catch {
      showToast('데이터를 불러오는 중 오류가 발생했어요.', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadWords() }, [loadWords])

  const filtered = useMemo(() => {
    return words
      .filter((w) => {
        if (categoryFilter !== 'all' && w.category !== categoryFilter) return false
        if (searchQuery.trim() && !w.word.includes(searchQuery.trim())) return false
        return true
      })
      .sort((a, b) => {
        const ai = CATEGORY_ORDER.indexOf(a.category)
        const bi = CATEGORY_ORDER.indexOf(b.category)
        if (ai !== bi) return ai - bi
        return a.word.localeCompare(b.word, 'ko')
      })
  }, [words, categoryFilter, searchQuery])

  const stats = useMemo(() => ({
    total:   words.length,
    hate:    words.filter((w) => w.category === 'hate').length,
    spam:    words.filter((w) => w.category === 'spam').length,
    adult:   words.filter((w) => w.category === 'adult').length,
    general: words.filter((w) => w.category === 'general').length,
  }), [words])

  // 추가
  const handleAddClick = () => {
    if (!addWord.trim()) { showToast('금칙어를 입력해 주세요.', 'error'); return }
    if (words.some((w) => w.word === addWord.trim())) {
      showToast('이미 등록된 금칙어예요.', 'error'); return
    }
    setAddConfirmOpen(true)
  }

  const handleAddConfirm = async () => {
    setAddConfirmOpen(false)
    const { data, error } = await supabase
      .from('admin_banned_words')
      .insert({ word: addWord.trim(), category: addCategory, active: true })
      .select()
      .single()
    if (error) { showToast('추가 중 오류가 발생했어요.', 'error'); return }
    setWords((prev) => [data, ...prev])
    setAddWord('')
    setAddCategory('general')
    setAddOpen(false)
    showToast(`'${data.word}' 금칙어가 등록됐어요.`, 'success')
  }

  // 단일 삭제
  const handleDeleteConfirm = async () => {
    await supabase.from('admin_banned_words').delete().eq('id', deleteTarget.id)
    setWords((prev) => prev.filter((w) => w.id !== deleteTarget.id))
    showToast(`'${deleteTarget.word}' 금칙어가 삭제됐어요.`, 'success')
    setDeleteTarget(null)
  }

  // 일괄 삭제
  const handleBulkDelete = async () => {
    const ids = [...selected]
    await supabase.from('admin_banned_words').delete().in('id', ids)
    setWords((prev) => prev.filter((w) => !selected.has(w.id)))
    showToast(`${ids.length}개 금칙어가 삭제됐어요.`, 'success')
    setSelected(new Set())
    setBulkSelectMode(false)
    setBulkDeleteConfirmOpen(false)
  }

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* 브레드크럼 */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link to="/admin/settings" className="hover:text-[#22282E] flex items-center gap-1">
            <ArrowLeft size={15} />
            설정 센터
          </Link>
          <span>/</span>
          <span className="text-[#22282E] font-semibold">금칙어 관리</span>
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <ShieldAlert size={20} className="text-red-600" />
            </div>
            <div>
              <h1 className="text-lg font-black text-[#22282E]">금칙어 관리</h1>
              <p className="text-xs text-gray-500">서비스 내 부적절한 단어 필터링 리스트를 관리합니다.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadWords}
              disabled={loading}
              className="p-2 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => { setBulkSelectMode((v) => !v); setSelected(new Set()) }}
              className={`px-3 py-1.5 rounded-lg border text-sm font-bold transition-colors ${
                bulkSelectMode ? 'bg-gray-200 border-gray-300 text-gray-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {bulkSelectMode ? '선택 취소' : '일괄 선택'}
            </button>
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#22282E] text-white text-sm font-bold hover:bg-[#363d46]"
            >
              <Plus size={15} />
              금칙어 추가
            </button>
          </div>
        </div>

        {/* 현황 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: '전체',      value: stats.total,   color: 'text-[#22282E]',  border: 'border-gray-200' },
            { label: '혐오/욕설', value: stats.hate,    color: 'text-red-600',    border: 'border-red-100' },
            { label: '스팸/광고', value: stats.spam,    color: 'text-amber-600',  border: 'border-amber-100' },
            { label: '성인',      value: stats.adult,   color: 'text-pink-600',   border: 'border-pink-100' },
            { label: '일반',      value: stats.general, color: 'text-gray-600',   border: 'border-gray-100' },
          ].map((s) => (
            <div key={s.label} className={`bg-white rounded-xl border ${s.border} p-3 text-center`}>
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className={`text-xl font-black ${s.color}`}>{s.value}건</p>
            </div>
          ))}
        </div>

        {/* 필터 + 검색 */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(c.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  categoryFilter === c.id
                    ? 'bg-[#22282E] text-white border-[#22282E]'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="금칙어 검색..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* 일괄삭제 액션바 */}
        {bulkSelectMode && selected.size > 0 && (
          <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mb-4">
            <span className="text-sm font-bold text-red-700">{selected.size}개 선택됨</span>
            <button
              onClick={() => setBulkDeleteConfirmOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-bold hover:bg-red-400"
            >
              <Trash2 size={14} />
              선택 삭제
            </button>
          </div>
        )}

        {/* 금칙어 목록 */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 py-16 text-center text-gray-400">
            <ShieldAlert size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">
              {searchQuery ? `'${searchQuery}'에 해당하는 금칙어가 없어요.` : '등록된 금칙어가 없어요.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-5">
            <p className="text-xs text-gray-400">{filtered.length}건</p>
            {CATEGORY_ORDER.filter((cat) =>
              categoryFilter === 'all' ? filtered.some((w) => w.category === cat) : cat === categoryFilter
            ).map((cat) => {
              const group = filtered.filter((w) => w.category === cat)
              if (group.length === 0) return null
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${getCategoryColor(cat)}`}>
                      {getCategoryLabel(cat)}
                    </span>
                    <span className="text-xs text-gray-400">{group.length}건</span>
                    <div className="flex-1 border-t border-gray-100" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.map((w) => (
                      <div
                        key={w.id}
                        onClick={() => bulkSelectMode && toggleSelect(w.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-bold transition-all cursor-default ${
                          bulkSelectMode ? 'cursor-pointer' : ''
                        } ${
                          selected.has(w.id)
                            ? 'bg-red-500 text-white border-red-500'
                            : getCategoryColor(w.category)
                        }`}
                      >
                        {bulkSelectMode && (
                          <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                            selected.has(w.id) ? 'border-white bg-white' : 'border-current'
                          }`}>
                            {selected.has(w.id) && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                          </span>
                        )}
                        <span>{w.word}</span>
                        {!bulkSelectMode && (
                          <button
                            onClick={() => setDeleteTarget(w)}
                            className="ml-0.5 rounded-full hover:bg-black/10 p-0.5 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 금칙어 추가 모달 */}
      <Modal isOpen={addOpen} onClose={() => { setAddOpen(false); setAddWord(''); setAddCategory('general') }} title="금칙어 추가">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">금칙어</label>
            <input
              type="text"
              value={addWord}
              onChange={(e) => setAddWord(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddClick()}
              placeholder="등록할 금칙어를 입력하세요."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-2">카테고리</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                <button
                  key={c.id}
                  onClick={() => setAddCategory(c.id)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                    addCategory === c.id ? 'bg-[#22282E] text-white border-[#22282E]' : `${c.color} hover:opacity-80`
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button
              onClick={() => { setAddOpen(false); setAddWord(''); setAddCategory('general') }}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={handleAddClick}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#22282E] text-white text-sm font-bold hover:bg-[#363d46]"
            >
              <Plus size={15} />
              추가
            </button>
          </div>
        </div>
      </Modal>

      {/* 추가 확인 모달 */}
      <Modal isOpen={addConfirmOpen} onClose={() => setAddConfirmOpen(false)} title="금칙어 등록 확인">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">아래 금칙어를 등록하시겠습니까?</p>
          <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center gap-3">
            <span className={`px-3 py-1.5 rounded-xl border text-sm font-bold ${getCategoryColor(addCategory)}`}>
              {addWord}
            </span>
            <span className="text-xs text-gray-500">{getCategoryLabel(addCategory)}</span>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setAddConfirmOpen(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold hover:bg-gray-50">취소</button>
            <button onClick={handleAddConfirm} className="px-4 py-2 rounded-xl bg-[#22282E] text-white text-sm font-bold hover:bg-[#363d46]">등록하기</button>
          </div>
        </div>
      </Modal>

      {/* 단일 삭제 확인 모달 */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="금칙어 삭제">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            아래 금칙어를 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.
          </p>
          <div className="bg-gray-50 rounded-lg px-4 py-3">
            <span className={`px-3 py-1.5 rounded-xl border text-sm font-bold ${getCategoryColor(deleteTarget?.category)}`}>
              {deleteTarget?.word}
            </span>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold hover:bg-gray-50">취소</button>
            <button onClick={handleDeleteConfirm} className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-400">삭제</button>
          </div>
        </div>
      </Modal>

      {/* 일괄 삭제 확인 모달 */}
      <Modal isOpen={bulkDeleteConfirmOpen} onClose={() => setBulkDeleteConfirmOpen(false)} title="일괄 삭제 확인">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            선택한 <strong className="text-red-500">{selected.size}개</strong> 금칙어를 모두 삭제하시겠습니까?<br />
            삭제 후 복구할 수 없습니다.
          </p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setBulkDeleteConfirmOpen(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold hover:bg-gray-50">취소</button>
            <button onClick={handleBulkDelete} className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-400">
              {selected.size}개 삭제
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
