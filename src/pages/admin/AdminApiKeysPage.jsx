import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, KeyRound, Plus, Copy, Eye, EyeOff,
  Trash2, Loader2, RefreshCw, CheckCircle2,
  Clock, AlertTriangle,
} from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { useUIStore } from '../../store/uiStore'
import { supabase } from '../../lib/supabase'

// ── 권한 범위(Scope) 정의 ─────────────────────────────────────────
const SCOPE_GROUPS = [
  {
    label: '매치업',
    scopes: [
      { id: 'read:matchups',  label: '매치업 조회' },
      { id: 'write:matchups', label: '매치업 생성/수정' },
    ],
  },
  {
    label: '유저',
    scopes: [
      { id: 'read:users',     label: '유저 정보 조회' },
      { id: 'write:users',    label: '유저 정보 수정' },
    ],
  },
  {
    label: '알림',
    scopes: [
      { id: 'read:notifications',  label: '알림 조회' },
      { id: 'write:notifications', label: '알림 발송' },
    ],
  },
  {
    label: '통계',
    scopes: [
      { id: 'read:stats',    label: '통계 데이터 조회' },
    ],
  },
  {
    label: '관리자',
    scopes: [
      { id: 'admin:full',    label: '전체 관리자 권한 (주의)' },
    ],
  },
]

const ALL_SCOPES = SCOPE_GROUPS.flatMap((g) => g.scopes)

// ── 유틸 ─────────────────────────────────────────────────────────
function generateApiKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const rand = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `vics_${rand(8)}_${rand(16)}_${rand(8)}`
}

async function hashKey(key) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function formatDate(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function relativeTime(iso) {
  if (!iso) return '사용 기록 없음'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금 전'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

function maskKey(prefix) {
  return `${prefix}${'•'.repeat(28)}`
}

export function AdminApiKeysPage() {
  const { showToast } = useUIStore()
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)

  // 생성 모달
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newScopes, setNewScopes] = useState(new Set())
  const [newExpiry, setNewExpiry] = useState('')   // '' = 무기한
  const [creating, setCreating] = useState(false)
  const [createConfirmOpen, setCreateConfirmOpen] = useState(false)

  // 생성 완료 모달 (키 1회 노출)
  const [createdKey, setCreatedKey] = useState(null)
  const [keyVisible, setKeyVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  // 삭제 모달
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('admin_api_keys')
        .select('*')
        .order('created_at', { ascending: false })
      setKeys(data || [])
    } catch {
      showToast('API 키를 불러오는 중 오류가 발생했어요.', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])


  // ── 키 생성 (유효성 검사 → 확인 모달) ──────────────────────────
  const handleCreateClick = () => {
    if (!newName.trim()) { showToast('키 이름을 입력해 주세요.', 'error'); return }
    if (newScopes.size === 0) { showToast('권한 범위를 하나 이상 선택해 주세요.', 'error'); return }
    setCreateConfirmOpen(true)
  }

  const handleCreate = async () => {
    setCreateConfirmOpen(false)
    setCreating(true)
    try {
      const rawKey = generateApiKey()
      const hash = await hashKey(rawKey)
      const prefix = rawKey.slice(0, 9)   // "vics_XXXX" (9자)
      const expires = newExpiry ? new Date(newExpiry).toISOString() : null

      const { data, error } = await supabase
        .from('admin_api_keys')
        .insert({
          name: newName.trim(),
          key_prefix: prefix,
          key_hash: hash,
          scopes: [...newScopes],
          expires_at: expires,
          created_by: '운영자',
        })
        .select()
        .single()

      if (error) throw error

      setKeys((prev) => [data, ...prev])
      setCreatedKey({ ...data, raw: rawKey })
      setCreateOpen(false)
      setNewName('')
      setNewScopes(new Set())
      setNewExpiry('')
    } catch {
      showToast('키 생성 중 오류가 발생했어요.', 'error')
    } finally {
      setCreating(false)
    }
  }

  // ── 클립보드 복사 ──────────────────────────────────────────────
  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      showToast('클립보드에 복사됐어요.', 'success')
    } catch {
      showToast('복사에 실패했어요.', 'error')
    }
  }

  // ── 키 삭제 ────────────────────────────────────────────────────
  const handleDelete = async () => {
    setActing(true)
    try {
      await supabase.from('admin_api_keys').delete().eq('id', deleteTarget.id)
      setKeys((prev) => prev.filter((k) => k.id !== deleteTarget.id))
      showToast(`'${deleteTarget.name}' 키가 삭제됐어요.`, 'success')
    } catch {
      showToast('삭제 중 오류가 발생했어요.', 'error')
    } finally {
      setActing(false)
      setDeleteTarget(null)
    }
  }

  const activeCount = keys.length

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
          <span className="text-[#22282E] font-semibold">API 키 관리</span>
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
              <KeyRound size={20} className="text-violet-600" />
            </div>
            <div>
              <h1 className="text-lg font-black text-[#22282E]">API 키 관리</h1>
              <p className="text-xs text-gray-500">외부 서비스 연동을 위한 인증키를 발급하고 관리합니다.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="p-2 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#22282E] text-white text-sm font-bold hover:bg-[#363d46]"
            >
              <Plus size={15} />
              새 API 키 발급
            </button>
          </div>
        </div>

        {/* 현황 카드 */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { label: '전체 키', value: keys.length,   color: 'text-[#22282E]',   border: 'border-gray-200' },
            { label: '활성',    value: activeCount,   color: 'text-emerald-600', border: 'border-emerald-100' },
          ].map((s) => (
            <div key={s.label} className={`bg-white rounded-xl border ${s.border} p-4 text-center`}>
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* 보안 안내 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            API 키는 발급 시 <strong>단 1회만</strong> 전체 값이 표시됩니다. 안전한 곳에 반드시 저장해 두세요.
            유출된 키는 즉시 취소하고 재발급하세요.
          </p>
        </div>

        {/* 키 수 */}
        <p className="text-xs text-gray-400 mb-3">{keys.length}개</p>

        {/* 키 목록 */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-gray-400" />
          </div>
        ) : keys.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 py-16 text-center text-gray-400">
            <KeyRound size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">API 키가 없어요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => (
              <div key={key.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* 키 이름 + 활성 배지 */}
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-black text-[#22282E]">{key.name}</p>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">활성</span>
                        </div>

                        {/* 키 값 (마스킹) */}
                        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 mb-2">
                          <code className="text-xs font-mono text-gray-600 flex-1 truncate">
                            {maskKey(key.key_prefix)}
                          </code>
                          <button
                            onClick={() => handleCopy(key.key_prefix)}
                            className="shrink-0 text-gray-400 hover:text-gray-600"
                            title="프리픽스 복사"
                          >
                            <Copy size={13} />
                          </button>
                        </div>

                        {/* 메타 정보 */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            발급: {formatDate(key.created_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            최근 사용: {relativeTime(key.last_used_at)}
                          </span>
                          {key.expires_at && (
                            <span className="flex items-center gap-1">
                              <Clock size={11} />
                              만료: {formatDate(key.expires_at)}
                            </span>
                          )}
                          {key.created_by && (
                            <span>발급자: {key.created_by}</span>
                          )}
                        </div>
                      </div>

                      {/* 삭제 버튼 */}
                      <button
                        onClick={() => setDeleteTarget(key)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 shrink-0"
                      >
                        <Trash2 size={12} />
                        삭제
                      </button>
                    </div>

                    {/* 권한 범위 */}
                    {key.scopes?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {key.scopes.map((sc) => (
                          <span
                            key={sc}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              sc === 'admin:full'
                                ? 'bg-red-50 text-red-600 border-red-200'
                                : 'bg-violet-50 text-violet-600 border-violet-100'
                            }`}
                          >
                            {ALL_SCOPES.find((s) => s.id === sc)?.label || sc}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 새 API 키 생성 모달 ── */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="새 API 키 발급">
        <div className="space-y-4">
          {/* 키 이름 */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">
              키 이름 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="예: Analytics 대시보드, Slack 알림 봇"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              autoFocus
            />
          </div>

          {/* 만료일 */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">만료일 (선택)</label>
            <input
              type="date"
              value={newExpiry}
              min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
              onChange={(e) => setNewExpiry(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            />
            <p className="text-[11px] text-gray-400 mt-1">비워두면 만료 없이 무기한 사용됩니다.</p>
          </div>

          {/* 권한 범위 */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-2">
              권한 범위 <span className="text-red-400">*</span>
            </label>
            <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
              {SCOPE_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">{group.label}</p>
                  <div className="space-y-1.5">
                    {group.scopes.map((sc) => (
                      <div key={sc.id} className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          id={`scope-${sc.id}`}
                          checked={newScopes.has(sc.id)}
                          onChange={(e) => {
                            const next = new Set(newScopes)
                            e.target.checked ? next.add(sc.id) : next.delete(sc.id)
                            setNewScopes(next)
                          }}
                          className={`w-4 h-4 cursor-pointer shrink-0 ${sc.id === 'admin:full' ? 'accent-red-500' : 'accent-violet-600'}`}
                        />
                        <div>
                          <span className={`text-sm font-bold ${sc.id === 'admin:full' ? 'text-red-600' : 'text-gray-700'}`}>
                            {sc.label}
                          </span>
                          {sc.id === 'admin:full' && (
                            <span className="ml-1.5 text-[10px] font-bold text-red-400 bg-red-50 px-1.5 py-0.5 rounded-full">주의</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-1">
            <button onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold hover:bg-gray-50">취소</button>
            <button
              onClick={handleCreateClick}
              disabled={creating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#22282E] text-white text-sm font-bold hover:bg-[#363d46] disabled:opacity-50"
            >
              {creating && <Loader2 size={14} className="animate-spin" />}
              발급하기
            </button>
          </div>
        </div>
      </Modal>

      {/* ── 발급 확인 모달 ── */}
      <Modal isOpen={createConfirmOpen} onClose={() => setCreateConfirmOpen(false)} title="API 키 발급 확인">
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-2">
            <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              발급된 키는 <strong>이 화면에서만 1회</strong> 전체 값이 표시됩니다.<br />
              발급 후 반드시 안전한 곳에 저장해 두세요.
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 text-xs">키 이름</span>
              <span className="font-bold text-gray-700">{newName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 text-xs">만료일</span>
              <span className="font-bold text-gray-700">{newExpiry || '무기한'}</span>
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {[...newScopes].map((sc) => (
                <span key={sc} className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  sc === 'admin:full'
                    ? 'bg-red-50 text-red-600 border-red-200'
                    : 'bg-violet-50 text-violet-600 border-violet-100'
                }`}>
                  {ALL_SCOPES.find((s) => s.id === sc)?.label || sc}
                </span>
              ))}
            </div>
          </div>
          <p className="text-sm text-gray-600">위 정보로 API 키를 발급하시겠습니까?</p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setCreateConfirmOpen(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold hover:bg-gray-50">취소</button>
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#22282E] text-white text-sm font-bold hover:bg-[#363d46]"
            >
              발급하기
            </button>
          </div>
        </div>
      </Modal>

      {/* ── 키 발급 완료 (1회 노출) 모달 ── */}
      <Modal isOpen={!!createdKey} onClose={() => { setCreatedKey(null); setKeyVisible(false); setCopied(false) }} title="API 키 발급 완료">
        {createdKey && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-2">
              <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 font-bold">
                이 키는 지금 이 화면에서만 전체 값을 확인할 수 있습니다.<br />
                반드시 안전한 곳에 복사해 저장하세요.
              </p>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-600 mb-1.5">발급된 API 키</p>
              <div className="flex items-center gap-2 bg-gray-900 rounded-xl px-4 py-3">
                <code className="text-sm font-mono text-emerald-400 flex-1 break-all">
                  {keyVisible ? createdKey.raw : maskKey(createdKey.key_prefix)}
                </code>
                <button
                  onClick={() => setKeyVisible((v) => !v)}
                  className="shrink-0 text-gray-400 hover:text-white"
                >
                  {keyVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <button
                  onClick={() => handleCopy(createdKey.raw)}
                  className="shrink-0 text-gray-400 hover:text-white"
                >
                  {copied ? <CheckCircle2 size={15} className="text-emerald-400" /> : <Copy size={15} />}
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-600 mb-1.5">키 정보</p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-gray-500">이름</span><span className="font-bold text-gray-700">{createdKey.name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">만료일</span><span className="font-bold text-gray-700">{createdKey.expires_at ? formatDate(createdKey.expires_at) : '무기한'}</span></div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {createdKey.scopes?.map((sc) => (
                    <span key={sc} className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-100 text-[10px] font-bold">
                      {ALL_SCOPES.find((s) => s.id === sc)?.label || sc}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => { setCreatedKey(null); setKeyVisible(false); setCopied(false) }}
                className="px-5 py-2 rounded-xl bg-[#22282E] text-white text-sm font-bold hover:bg-[#363d46]"
              >
                확인했어요
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── 키 삭제 확인 모달 ── */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="API 키 삭제">
        {deleteTarget && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2">
              <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-800">
                삭제 즉시 해당 키로의 모든 API 요청이 차단됩니다.<br />
                삭제된 키는 복구할 수 없습니다.
              </p>
            </div>
            <p className="text-sm text-gray-600">
              <strong className="text-[#22282E]">'{deleteTarget.name}'</strong> 키를 삭제하시겠습니까?
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold hover:bg-gray-50">취소</button>
              <button
                onClick={handleDelete}
                disabled={acting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-400 disabled:opacity-50"
              >
                {acting && <Loader2 size={14} className="animate-spin" />}
                삭제
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
