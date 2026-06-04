import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  CalendarClock,
  ChevronDown,
  FileText,
  Loader2,
  Megaphone,
  Send,
  Smartphone,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react'
import { Modal } from '../components/ui/Modal'
import { RichTextEditor } from '../components/notice/RichTextEditor'
import { NoticeDeleteConfirmModal } from '../components/notice/NoticeDeleteConfirmModal'
import { useUIStore } from '../store/uiStore'
import { getNoticeById, updateNotice, deleteNotice } from '../lib/noticeStorage'
import { formatPushTitle, formatPushBody } from '../lib/noticePushFormat'
import { TIERS } from '../lib/tiers'
import { cn } from '../lib/utils'

const TITLE_MAX = 50

const CATEGORIES = [
  { id: 'notice', label: '공지', accent: 'from-sky-500/10 to-blue-600/10 border-sky-200/80 text-sky-800 ring-sky-200/50' },
  { id: 'event', label: '이벤트', accent: 'from-rose-500/10 to-pink-600/10 border-rose-200/80 text-rose-900 ring-rose-200/50' },
  { id: 'update', label: '업데이트', accent: 'from-emerald-500/10 to-teal-600/10 border-emerald-200/80 text-emerald-900 ring-emerald-200/50' },
  { id: 'winner', label: '당첨자', accent: 'from-amber-500/10 to-orange-500/10 border-amber-200/80 text-amber-950 ring-amber-200/50' },
]

function SectionCard({ step, icon, title, description, children, className }) {
  const SectionIcon = icon
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm shadow-gray-200/40',
        className
      )}
    >
      <div className="border-b border-gray-100/90 bg-gradient-to-r from-slate-50/95 via-white to-emerald-50/30 px-4 py-3.5 sm:px-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-700 shadow-sm ring-1 ring-emerald-200/50">
            <SectionIcon size={18} strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="shrink-0 rounded-lg bg-emerald-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                {step}
              </span>
              <h2 className="text-sm font-black tracking-tight text-[#22282E]">{title}</h2>
            </div>
            {description && (
              <p className="mt-1 text-xs font-medium leading-relaxed text-gray-500">{description}</p>
            )}
          </div>
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  )
}

const inputClass =
  'w-full rounded-xl border-2 border-gray-200/90 bg-white py-2.5 pl-4 pr-4 text-sm font-semibold text-[#22282E] shadow-sm transition-colors placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/30'

export function NoticeEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast, incrementNoticeListRefresh } = useUIStore()

  const [notice, setNotice] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [category, setCategory] = useState('update')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [isHighlighted, setIsHighlighted] = useState(false)
  const [targetAll, setTargetAll] = useState(true)
  const [targetTierId, setTargetTierId] = useState(TIERS[0]?.id || 'player')
  /** false: 이상 열람, true: 해당 티어만 */
  const [targetTierExact, setTargetTierExact] = useState(false)
  const [tierOpen, setTierOpen] = useState(false)
  const [sendPush, setSendPush] = useState(false)
  const [pushMessage, setPushMessage] = useState('')
  const [categoryOpen, setCategoryOpen] = useState(false)
  const categoryRef = useRef(null)
  const tierRef = useRef(null)

  // 공지 데이터 로드 및 pre-fill
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setNotFound(false)
      setNotice(null)
      const found = await getNoticeById(id)
      if (cancelled) return
      if (!found) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setNotice(found)
      setCategory(found.category || 'update')
      setTitle(found.title || '')
      setContent(found.content || '')
      setIsPinned(found.isBanner ?? false)
      setIsHighlighted(found.isHighlighted ?? false)
      setTargetAll(found.targetAll !== false)
      setTargetTierId(found.targetTierId || TIERS[0]?.id || 'player')
      setTargetTierExact(found.targetTierExact === true)
      setLoading(false)
    }
    void load()
    window.addEventListener('vics:notices:updated', load)
    return () => {
      cancelled = true
      window.removeEventListener('vics:notices:updated', load)
    }
  }, [id])

  useEffect(() => {
    const handler = (e) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target)) setCategoryOpen(false)
      if (tierRef.current && !tierRef.current.contains(e.target)) setTierOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const catMeta = CATEGORIES.find((c) => c.id === category)
  const selectedTier = TIERS.find((t) => t.id === targetTierId) || TIERS[0]

  const requestSave = () => {
    if (!title.trim()) {
      showToast('제목을 입력해 주세요.', 'error')
      return
    }
    if (!content.trim()) {
      showToast('본문 내용을 입력해 주세요.', 'error')
      return
    }
    setConfirmOpen(true)
  }

  const handleDeleteConfirm = async () => {
    setDeleting(true)
    try {
      await deleteNotice(id)
      incrementNoticeListRefresh()
      setDeleteOpen(false)
      showToast('삭제됐어요.', 'success')
      navigate('/admin/notice/list')
    } catch (e) {
      showToast(e?.message || '삭제에 실패했어요.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleSave = async () => {
    setConfirmOpen(false)
    setSaving(true)
    try {
      await new Promise((r) => setTimeout(r, 600))
      await updateNotice(id, {
        category,
        title,
        content,
        isPinned,
        isHighlighted,
        targetAll,
        ...(targetAll
          ? {}
          : {
              targetTierId,
              targetTierLabel: selectedTier ? `${selectedTier.emoji} ${selectedTier.name}` : undefined,
              targetTierExact,
            }),
      })
      incrementNoticeListRefresh()
      showToast('공지사항이 수정됐어요.', 'success')
      navigate(`/notice/${id}`)
    } finally {
      setSaving(false)
    }
  }

  const syncPushMessage = () => {
    if (!pushMessage && title) setPushMessage(formatPushTitle(category, title))
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-100/80 via-white to-emerald-50/30 px-4">
        <Loader2 className="h-9 w-9 animate-spin text-emerald-600" aria-label="불러오는 중" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-100/80 via-white to-emerald-50/30 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200/90 bg-white p-8 text-center shadow-sm">
          <p className="mb-4 text-sm font-medium text-gray-600">수정할 수 없는 공지입니다.<br />관리자가 게시한 공지만 수정할 수 있어요.</p>
          <Link
            to="/notice"
            className="text-sm font-black text-emerald-700 underline decoration-emerald-300/80 underline-offset-2 hover:text-emerald-900"
          >
            공지 목록으로
          </Link>
        </div>
      </div>
    )
  }

  if (!notice) return null

  return (
    <div className="min-h-full w-full min-w-0 bg-gradient-to-b from-slate-100/80 via-white to-emerald-50/30 pb-16">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        {/* 히어로 헤더 */}
        <div className="relative mb-8 overflow-hidden rounded-2xl border-2 border-emerald-200/70 bg-gradient-to-br from-emerald-50/95 via-white to-violet-50/50 px-5 py-6 shadow-sm sm:px-7 sm:py-7">
          <div
            className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-emerald-400/15 blur-2xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-violet-400/10 blur-2xl"
            aria-hidden
          />
          <div className="relative space-y-4">
            <Link
              to={`/notice/${id}`}
              className="inline-flex items-center gap-2 rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-xs font-bold text-gray-600 shadow-sm backdrop-blur-sm transition hover:border-emerald-200 hover:bg-white hover:text-emerald-800"
            >
              <ArrowLeft size={16} strokeWidth={2.25} />
              공지 상세로 돌아가기
            </Link>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5 min-w-0">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-600/30 ring-4 ring-white/80">
                  <Megaphone size={26} strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl font-black tracking-tight text-[#22282E] sm:text-2xl">공지사항 수정</h1>
                  <p className="mt-1 text-sm font-medium text-gray-600">
                    수정한 내용은 저장 즉시 유저 공지 화면에 반영됩니다.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-100 transition-colors"
              >
                <Trash2 size={16} />
                삭제
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Step 1: 기본 정보 */}
          <SectionCard
            step="Step 1"
            icon={FileText}
            title="기본 정보"
            description="카테고리·제목·목록에서의 강조 방식을 선택하세요."
          >
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500">
                  카테고리
                </label>
                <div ref={categoryRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setCategoryOpen((o) => !o)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border-2 border-gray-200/90 bg-white px-4 py-3 text-left text-sm font-bold shadow-sm transition hover:border-emerald-300"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex rounded-lg border px-2.5 py-1 text-xs font-black uppercase tracking-wide ring-1',
                          catMeta?.accent
                        )}
                      >
                        {catMeta?.label || '선택'}
                      </span>
                    </span>
                    <ChevronDown
                      size={18}
                      className={cn('shrink-0 text-gray-400 transition-transform', categoryOpen && 'rotate-180')}
                    />
                  </button>
                  {categoryOpen && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-gray-200/90 bg-white py-1 shadow-xl shadow-gray-200/50 ring-1 ring-black/5">
                      {CATEGORIES.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setCategory(c.id)
                            setCategoryOpen(false)
                          }}
                          className={cn(
                            'flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold transition',
                            category === c.id
                              ? 'bg-[#22282E] text-white'
                              : 'text-gray-700 hover:bg-gray-50'
                          )}
                        >
                          <span
                            className={cn(
                              'inline-flex rounded-md border px-2 py-0.5 text-[11px] font-black ring-1',
                              c.accent
                            )}
                          >
                            {c.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-2 flex items-center justify-between text-xs font-bold text-gray-700">
                  <span>제목</span>
                  <span className="tabular-nums text-gray-400">
                    {title.length}/{TITLE_MAX}
                  </span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
                  maxLength={TITLE_MAX}
                  placeholder="공지 제목을 입력하세요"
                  className={inputClass}
                />
              </div>

              <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50/80 to-white p-4">
                <p className="mb-3 text-xs font-black uppercase tracking-wide text-gray-400">중요 공지 옵션</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6">
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-1 py-1 transition hover:border-emerald-100 hover:bg-emerald-50/50">
                    <input
                      type="checkbox"
                      checked={isPinned}
                      onChange={(e) => setIsPinned(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500/40"
                    />
                    <span className="text-sm font-semibold text-gray-800">상단 고정</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-1 py-1 transition hover:border-violet-100 hover:bg-violet-50/50">
                    <input
                      type="checkbox"
                      checked={isHighlighted}
                      onChange={(e) => setIsHighlighted(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500/40"
                    />
                    <span className="text-sm font-semibold text-gray-800">리스트 강조 (N 표시)</span>
                  </label>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Step 2: 본문 */}
          <SectionCard
            step="Step 2"
            icon={Sparkles}
            title="본문 작성"
            description="이미지·링크·서식을 적용한 공지 본문을 작성합니다."
          >
            <div className="overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-inner">
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder="이미지 드래그 앤 드롭 또는 툴바로 서식 적용"
                onImageUploadError={(msg) => showToast(msg, 'error')}
              />
            </div>
          </SectionCard>

          {/* Step 3: 발송 및 노출 */}
          <SectionCard
            step="Step 3"
            icon={Send}
            title="발송 및 노출"
            description="노출 대상 및 푸시 알림을 설정합니다."
          >
            <div className="space-y-6">
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-xs font-bold text-gray-700">
                  <Users size={14} className="text-emerald-600" />
                  노출 대상
                </label>
                <div className="inline-flex rounded-xl border border-gray-200/90 bg-gray-50/80 p-1">
                  <button
                    type="button"
                    onClick={() => setTargetAll(true)}
                    className={cn(
                      'rounded-lg px-4 py-2 text-sm font-bold transition',
                      targetAll
                        ? 'bg-white text-[#22282E] shadow-sm ring-1 ring-gray-200/80'
                        : 'text-gray-500 hover:text-gray-800'
                    )}
                  >
                    전체 유저
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetAll(false)}
                    className={cn(
                      'rounded-lg px-4 py-2 text-sm font-bold transition',
                      !targetAll
                        ? 'bg-white text-[#22282E] shadow-sm ring-1 ring-gray-200/80'
                        : 'text-gray-500 hover:text-gray-800'
                    )}
                  >
                    특정 티어
                  </button>
                </div>

                {!targetAll && (
                  <div className="mt-3 max-w-md">
                    <label className="mb-1.5 block text-xs font-bold text-gray-600">노출 티어 선택</label>
                    <div ref={tierRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setTierOpen((o) => !o)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border-2 border-gray-200/90 bg-white px-4 py-3 text-left text-sm font-bold shadow-sm transition hover:border-emerald-300"
                        aria-expanded={tierOpen}
                        aria-haspopup="listbox"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="text-lg leading-none">{selectedTier?.emoji}</span>
                          <span className="truncate text-[#22282E]">{selectedTier?.name}</span>
                        </span>
                        <ChevronDown
                          size={18}
                          className={cn('shrink-0 text-gray-400 transition-transform', tierOpen && 'rotate-180')}
                        />
                      </button>
                      {tierOpen && (
                        <ul
                          role="listbox"
                          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-64 overflow-auto rounded-xl border border-gray-200/90 bg-white py-1 shadow-xl shadow-gray-200/50 ring-1 ring-black/5"
                        >
                          {TIERS.map((t) => (
                            <li key={t.id}>
                              <button
                                type="button"
                                role="option"
                                aria-selected={targetTierId === t.id}
                                onClick={() => {
                                  setTargetTierId(t.id)
                                  setTierOpen(false)
                                }}
                                className={cn(
                                  'flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold transition',
                                  targetTierId === t.id
                                    ? 'bg-[#22282E] text-white'
                                    : 'text-gray-800 hover:bg-gray-50'
                                )}
                              >
                                <span className="text-lg leading-none">{t.emoji}</span>
                                <span className="min-w-0 flex-1">
                                  <span className="block">{t.name}</span>
                                  <span
                                    className={cn(
                                      'mt-0.5 block text-[11px] font-medium',
                                      targetTierId === t.id ? 'text-white/80' : 'text-gray-500'
                                    )}
                                  >
                                    {t.benefit}
                                  </span>
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <p className="mt-1.5 text-[11px] font-medium text-gray-400">
                      랜딩 페이지 «등급·혜택» 표기와 동일한 Player · Star · Master · Vip · Goat 입니다.
                    </p>
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-bold text-gray-600">열람 범위</p>
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-gray-200/90 bg-white px-3 py-2.5 shadow-sm">
                          <input
                            type="radio"
                            name="tierExposureEdit"
                            checked={!targetTierExact}
                            onChange={() => setTargetTierExact(false)}
                            className="mt-0.5 h-4 w-4 border-gray-300 text-emerald-600 focus:ring-emerald-500/40"
                          />
                          <span className="min-w-0 text-sm font-semibold leading-snug text-gray-800">
                            대상 티어 이상 열람
                            <span className="mt-0.5 block text-[11px] font-medium text-gray-500">
                              선택한 티어와 그보다 높은 등급 유저에게 공개
                            </span>
                          </span>
                        </label>
                        <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-gray-200/90 bg-white px-3 py-2.5 shadow-sm">
                          <input
                            type="radio"
                            name="tierExposureEdit"
                            checked={targetTierExact}
                            onChange={() => setTargetTierExact(true)}
                            className="mt-0.5 h-4 w-4 border-gray-300 text-emerald-600 focus:ring-emerald-500/40"
                          />
                          <span className="min-w-0 text-sm font-semibold leading-snug text-gray-800">
                            해당 티어만 열람
                            <span className="mt-0.5 block text-[11px] font-medium text-gray-500">
                              선택한 티어와 정확히 일치할 때만 공개
                            </span>
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50/90 to-white p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={sendPush}
                    onChange={(e) => setSendPush(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500/40"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-black text-[#22282E]">
                      <Bell size={16} className="text-emerald-600" />
                      수정과 동시에 앱 푸시 재전송
                    </span>
                    <span className="mt-0.5 block text-xs font-medium text-gray-500">
                      체크 시 수정 내용을 푸시로 다시 발송합니다.
                    </span>
                  </span>
                </label>

                {sendPush && (
                  <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-gray-600">푸시 제목 (선택)</label>
                      <input
                        type="text"
                        value={pushMessage}
                        onChange={(e) => setPushMessage(e.target.value)}
                        onFocus={syncPushMessage}
                        placeholder={title || '공지 제목(기본값)'}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-gray-400">
                        <Smartphone size={12} className="text-gray-400" />
                        푸시 미리보기
                      </p>
                      <div className="relative mx-auto max-w-sm overflow-hidden rounded-[1.35rem] border border-gray-200/90 bg-gradient-to-b from-gray-900 to-gray-950 p-3 shadow-xl shadow-gray-900/20 ring-1 ring-white/10">
                        <div className="mb-2 flex items-center justify-between px-1">
                          <span className="text-[9px] font-bold text-white/90">VICTORYSPACE</span>
                          <span className="text-[9px] text-white/40">now</span>
                        </div>
                        <div className="rounded-2xl bg-white/95 p-3 shadow-lg backdrop-blur-sm">
                          <p className="text-[10px] font-bold leading-snug text-[#22282E]">
                            {pushMessage.trim() || formatPushTitle(category, title) || '제목 미리보기'}
                          </p>
                          <p className="mt-1 line-clamp-2 text-[9px] leading-relaxed text-gray-500">
                            {content
                              ? formatPushBody(content, category)
                              : '당신의 안목을 증명하고 한정판 배지를 획득하세요. 지금 바로 확인! ⚡'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          {/* 저장 버튼 */}
          <div className="pt-2">
            <button
              type="button"
              onClick={requestSave}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 py-3.5 text-sm font-black text-white shadow-lg shadow-violet-300/40 transition hover:from-violet-600 hover:to-purple-700 hover:shadow-violet-400/50 disabled:opacity-50"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : null}
              수정 완료
            </button>
          </div>
        </div>
      </div>

      {/* 수정 확인 모달 */}
      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        className="max-w-sm"
      >
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 ring-2 ring-violet-200/70">
            <AlertTriangle size={26} className="text-violet-500" strokeWidth={2.25} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-black tracking-tight text-[#22282E]">공지를 수정할까요?</h3>
            <p className="text-sm font-medium leading-relaxed text-gray-500">
              저장 즉시{' '}
              <span className="font-bold text-[#22282E]">
                {targetAll
                  ? '전체 유저에게'
                  : targetTierExact
                    ? `${selectedTier?.emoji} ${selectedTier?.name} 티어(동일 등급)에게만`
                    : `${selectedTier?.emoji} ${selectedTier?.name} 티어 이상에게`}
              </span>{' '}
              노출된 내용이 변경돼요.
              {sendPush && (
                <>
                  <br />
                  <span className="font-semibold text-emerald-600">앱 푸시도 함께 재전송</span>됩니다.
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="flex flex-1 items-center justify-center rounded-xl border-2 border-gray-200/90 bg-white py-2.5 text-sm font-black text-gray-600 transition hover:border-gray-300 hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 py-2.5 text-sm font-black text-white shadow-md shadow-violet-300/40 transition hover:from-violet-600 hover:to-purple-700"
            >
              <Send size={14} strokeWidth={2.5} />
              저장하기
            </button>
          </div>
        </div>
      </Modal>

      <NoticeDeleteConfirmModal
        isOpen={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        itemLabel={title || notice?.title}
        confirming={deleting}
      />
    </div>
  )
}
