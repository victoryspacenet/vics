import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Bot, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Save, X, Loader2 } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { useUIStore } from '../../store/uiStore'
import { supabase } from '../../lib/supabase'

/** 문의 폼·관리자 문의 카테고리와 동일 id 사용 */
const CATEGORY_OPTIONS = [
  { id: 'point', label: '포인트' },
  { id: 'account', label: '계정/인증' },
  { id: 'matchup', label: '매치업' },
  { id: 'report', label: '신고' },
  { id: 'bug', label: '버그/제보' },
  { id: 'suggestion', label: '건의' },
  { id: 'etc', label: '기타' },
  { id: 'appeal', label: '이의 신청' },
]

const EMPTY_FORM = { category: 'point', title: '', message: '' }

async function fetchBotEnabled() {
  const { data } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', 'bot_enabled')
    .single()
  return data?.value?.enabled ?? true
}

async function saveBotEnabled(enabled) {
  await supabase
    .from('admin_settings')
    .upsert({ key: 'bot_enabled', value: { enabled } }, { onConflict: 'key' })
}

async function fetchScenarios() {
  const { data, error } = await supabase
    .from('admin_bot_scenarios')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

function ScenarioCard({ scenario, onEdit, onDelete, onToggle }) {
  const [expanded, setExpanded] = useState(false)
  const cat = CATEGORY_OPTIONS.find((c) => c.id === scenario.category)

  return (
    <div className={`rounded-xl border ${scenario.active ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200 bg-gray-50/50'} overflow-hidden`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => onToggle(scenario.id, !scenario.active)}
          className="shrink-0 text-gray-400 hover:text-emerald-600 transition-colors"
          title={scenario.active ? '비활성화' : '활성화'}
        >
          {scenario.active
            ? <ToggleRight size={28} className="text-emerald-500" />
            : <ToggleLeft size={28} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-white border border-gray-200 text-gray-600">
              {cat?.label ?? scenario.category}
            </span>
            {!scenario.active && (
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-200 text-gray-500">비활성</span>
            )}
          </div>
          <p className="text-sm font-bold text-[#22282E] truncate">{scenario.title}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit(scenario)}
            className="p-2 rounded-lg hover:bg-white hover:text-emerald-600 text-gray-400 transition-colors"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => onDelete(scenario.id)}
            className="p-2 rounded-lg hover:bg-white hover:text-red-500 text-gray-400 transition-colors"
          >
            <Trash2 size={15} />
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-2 rounded-lg hover:bg-white text-gray-400 transition-colors"
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-1">자동 응대 메시지 미리보기</p>
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {scenario.message}
          </div>
        </div>
      )}
    </div>
  )
}

export function AdminAutoBotPage() {
  const { showToast } = useUIStore()
  const [loading, setLoading] = useState(true)
  const [botEnabled, setBotEnabled] = useState(true)
  const [scenarios, setScenarios] = useState([])
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [enabled, list] = await Promise.all([fetchBotEnabled(), fetchScenarios()])
        setBotEnabled(enabled)
        setScenarios(list)
      } catch {
        showToast('데이터를 불러오는 중 오류가 발생했어요.', 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleToggleBot = async () => {
    const next = !botEnabled
    setBotEnabled(next)
    await saveBotEnabled(next)
    showToast(next ? '자동 응대 봇이 활성화됐어요.' : '자동 응대 봇이 비활성화됐어요.', next ? 'success' : 'info')
  }

  const handleToggleScenario = async (id, nextActive) => {
    setScenarios((prev) =>
      prev.map((s) => s.id === id ? { ...s, active: nextActive } : s)
    )
    await supabase
      .from('admin_bot_scenarios')
      .update({ active: nextActive, updated_at: new Date().toISOString() })
      .eq('id', id)
  }

  const handleEdit = (scenario) => {
    setEditTarget(scenario)
    setForm({ category: scenario.category, title: scenario.title, message: scenario.message })
  }

  const handleNew = () => {
    setEditTarget('new')
    setForm(EMPTY_FORM)
  }

  const handleSave = () => {
    if (!form.title.trim()) { showToast('시나리오 제목을 입력해 주세요.', 'error'); return }
    if (!form.message.trim()) { showToast('자동 응대 메시지를 입력해 주세요.', 'error'); return }
    setSaveConfirmOpen(true)
  }

  const handleSaveConfirm = async () => {
    setSaveConfirmOpen(false)
    setSaving(true)
    try {
      if (editTarget === 'new') {
        const { data, error } = await supabase
          .from('admin_bot_scenarios')
          .insert({ ...form, active: true })
          .select()
          .single()
        if (error) throw error
        setScenarios((prev) => [...prev, data])
        showToast('시나리오가 추가됐어요.', 'success')
      } else {
        const { data, error } = await supabase
          .from('admin_bot_scenarios')
          .update({ ...form, updated_at: new Date().toISOString() })
          .eq('id', editTarget.id)
          .select()
          .single()
        if (error) throw error
        setScenarios((prev) =>
          prev.map((s) => s.id === editTarget.id ? data : s)
        )
        showToast('시나리오가 수정됐어요.', 'success')
      }
    } catch {
      showToast('저장 중 오류가 발생했어요.', 'error')
    } finally {
      setSaving(false)
      setEditTarget(null)
    }
  }

  const handleDeleteConfirm = async () => {
    try {
      await supabase.from('admin_bot_scenarios').delete().eq('id', deleteTarget)
      setScenarios((prev) => prev.filter((s) => s.id !== deleteTarget))
      showToast('시나리오가 삭제됐어요.', 'success')
    } catch {
      showToast('삭제 중 오류가 발생했어요.', 'error')
    } finally {
      setDeleteTarget(null)
    }
  }

  const isEditing = editTarget !== null

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* 브레드크럼 */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link to="/admin/settings" className="hover:text-[#22282E] flex items-center gap-1">
            <ArrowLeft size={15} />
            설정 센터
          </Link>
          <span>/</span>
          <span className="text-[#22282E] font-semibold">자동 답변/봇 설정</span>
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Bot size={20} className="text-emerald-600" />
            </div>
            <div>
              <h1 className="text-lg font-black text-[#22282E]">자동 답변/봇 설정</h1>
              <p className="text-xs text-gray-500">유저 문의 시 1차 자동 응대 시나리오를 관리합니다.</p>
            </div>
          </div>
        </div>

        {/* 봇 전체 ON/OFF */}
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 mb-6 flex items-center justify-between">
          <div>
            <p className="font-bold text-[#22282E]">자동 응대 봇 사용</p>
            <p className="text-xs text-gray-500 mt-0.5">
              끄면 시나리오가 있어도 자동 답변이 붙지 않아요. 켜 두면 문의 INSERT 시 DB 트리거와 접수 보강 로직이 동일 규칙으로 동작합니다.
            </p>
          </div>
          <button onClick={handleToggleBot} className="shrink-0">
            {botEnabled
              ? <ToggleRight size={36} className="text-emerald-500" />
              : <ToggleLeft size={36} className="text-gray-400" />}
          </button>
        </div>

        {/* 시나리오 목록 */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-[#22282E]">
            시나리오 목록 <span className="text-gray-400 font-normal">({scenarios.length}건)</span>
          </h2>
          <button
            onClick={handleNew}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500"
          >
            <Plus size={15} />
            새 시나리오 추가
          </button>
        </div>

        <div className={`space-y-3 ${!botEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          {scenarios.length === 0 ? (
            <div className="py-16 text-center text-gray-400 bg-white rounded-xl border border-gray-100">
              <Bot size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">등록된 시나리오가 없어요.</p>
            </div>
          ) : (
            scenarios.map((s) => (
              <ScenarioCard
                key={s.id}
                scenario={s}
                onEdit={handleEdit}
                onDelete={(id) => setDeleteTarget(id)}
                onToggle={handleToggleScenario}
              />
            ))
          )}
        </div>
      </div>

      {/* 편집/추가 모달 */}
      <Modal
        isOpen={isEditing}
        onClose={() => setEditTarget(null)}
        title={editTarget === 'new' ? '새 시나리오 추가' : '시나리오 편집'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">문의 유형</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">시나리오 제목</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="예: 포인트 관련 자동 응대"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">자동 응대 메시지</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              placeholder="유저에게 자동으로 발송될 1차 응대 메시지를 입력하세요."
              rows={6}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button
              onClick={() => setEditTarget(null)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold hover:bg-gray-50"
            >
              <X size={15} />
              취소
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500"
            >
              <Save size={15} />
              저장
            </button>
          </div>
        </div>
      </Modal>

      {/* 저장 확인 모달 */}
      <Modal
        isOpen={saveConfirmOpen}
        onClose={() => setSaveConfirmOpen(false)}
        title={editTarget === 'new' ? '시나리오 추가 확인' : '시나리오 수정 확인'}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            아래 내용으로 시나리오를{editTarget === 'new' ? ' 추가' : ' 저장'}하시겠습니까?
          </p>
          <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-2 text-sm">
            <div className="flex gap-2">
              <span className="text-gray-500 shrink-0">문의 유형</span>
              <span className="font-bold text-[#22282E]">
                {CATEGORY_OPTIONS.find((c) => c.id === form.category)?.label}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 shrink-0">제목</span>
              <span className="font-bold text-[#22282E]">{form.title}</span>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setSaveConfirmOpen(false)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={handleSaveConfirm}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={15} />}
              {editTarget === 'new' ? '추가하기' : '저장하기'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 삭제 확인 모달 */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="시나리오 삭제"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            이 시나리오를 삭제하면 복구할 수 없습니다.<br />
            <span className="text-red-500 font-bold">정말 삭제하시겠습니까?</span>
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={handleDeleteConfirm}
              className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-400"
            >
              삭제
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
