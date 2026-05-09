import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
  Users,
} from 'lucide-react'
import { Modal } from '../components/ui/Modal'
import { RichTextEditor } from '../components/notice/RichTextEditor'
import { useUIStore } from '../store/uiStore'
import { saveNotice } from '../lib/noticeStorage'
import { formatPushTitle, formatPushBody } from '../lib/noticePushFormat'
import { addNoticePush } from '../lib/noticePushStorage'
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

export function NoticeAdminPage() {
  const navigate = useNavigate()
  const { showToast, incrementNoticePushRefresh, incrementNoticeListRefresh } = useUIStore()
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

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
  const [publishNow, setPublishNow] = useState(true)
  const [scheduledDate, setScheduledDate] = useState('2026-01-30')
  const [scheduledTime, setScheduledTime] = useState('21:00')
  const [sendPush, setSendPush] = useState(true)
  const [pushMessage, setPushMessage] = useState('')
  const [categoryOpen, setCategoryOpen] = useState(false)
  const categoryRef = useRef(null)
  const tierRef = useRef(null)

  const catMeta = CATEGORIES.find((c) => c.id === category)
  const selectedTier = TIERS.find((t) => t.id === targetTierId) || TIERS[0]

  useEffect(() => {
    const handler = (e) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target)) setCategoryOpen(false)
      if (tierRef.current && !tierRef.current.contains(e.target)) setTierOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSaveDraft = async () => {
    setSaving(true)
    try {
      await new Promise((r) => setTimeout(r, 500))
      showToast('임시 저장됐어요.', 'success')
    } finally {
      setSaving(false)
    }
  }

  const requestPublish = () => {
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

  const handlePublish = async () => {
    setConfirmOpen(false)
    setSaving(true)
    try {
      await new Promise((r) => setTimeout(r, 800))
      const notice = await saveNotice({
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
      showToast('공지사항이 성공적으로 게시됐어요.', 'success')

      const tierLabel =
        !targetAll && selectedTier ? `${selectedTier.emoji} ${selectedTier.name}` : undefined

      if (sendPush) {
        const pushTitle = pushMessage.trim() ? pushMessage : formatPushTitle(category, title)
        const pushBody = formatPushBody(content, category)
        try {
          const pushCount = await addNoticePush({ noticeId: notice.id, title: pushTitle, body: pushBody })
          incrementNoticePushRefresh()
          navigate('/admin/notice/complete', {
            state: {
              title,
              category,
              publishedAt: new Date().toLocaleString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              }) + ' (KST)',
              targetAll,
              targetTierId: targetAll ? undefined : targetTierId,
              targetTierLabel: tierLabel,
              targetTierExact: targetAll ? false : targetTierExact,
              sendPush,
              pushCount: typeof pushCount === 'number' ? pushCount : 0,
            },
          })
        } catch (e) {
          console.error(e)
          showToast('푸시 발송에 실패했어요. 공지는 게시되었습니다.', 'error')
          navigate('/admin/notice/complete', {
            state: {
              title,
              category,
              publishedAt: new Date().toLocaleString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              }) + ' (KST)',
              targetAll,
              targetTierId: targetAll ? undefined : targetTierId,
              targetTierLabel: tierLabel,
              targetTierExact: targetAll ? false : targetTierExact,
              sendPush,
              pushCount: 0,
            },
          })
        }
        return
      }

      navigate('/admin/notice/complete', {
        state: {
          title,
          category,
          publishedAt: new Date().toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }) + ' (KST)',
          targetAll,
          targetTierId: targetAll ? undefined : targetTierId,
          targetTierLabel: tierLabel,
          targetTierExact: targetAll ? false : targetTierExact,
          sendPush,
          pushCount: 0,
        },
      })
    } finally {
      setSaving(false)
    }
  }

  const syncPushMessage = () => {
    if (!pushMessage && title) setPushMessage(formatPushTitle(category, title))
  }

  return (
    <div className="min-h-full w-full min-w-0 bg-gradient-to-b from-slate-100/80 via-white to-emerald-50/30 pb-16">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
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
              to="/admin/notice/popup/list"
              className="inline-flex items-center gap-2 rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-xs font-bold text-gray-600 shadow-sm backdrop-blur-sm transition hover:border-emerald-200 hover:bg-white hover:text-emerald-800"
            >
              <ArrowLeft size={16} strokeWidth={2.25} />
              팝업 목록으로
            </Link>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-600/30 ring-4 ring-white/80">
                <Megaphone size={26} strokeWidth={2.25} />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-black tracking-tight text-[#22282E] sm:text-2xl">공지사항 작성</h1>
                <p className="mt-1 text-sm font-medium text-gray-600">
                  앱 공지 화면에 반영되며, 옵션에 따라 푸시 알림까지 발송할 수 있어요.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
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
              />
            </div>
          </SectionCard>

          <SectionCard
            step="Step 3"
            icon={Send}
            title="발송 및 노출"
            description="노출 대상·예약·푸시 알림을 설정합니다."
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
                            name="tierExposure"
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
                            name="tierExposure"
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

              <div>
                <label className="mb-1.5 flex items-center gap-2 text-xs font-bold text-gray-700">
                  <CalendarClock size={14} className="text-violet-600" />
                  발송 시점
                </label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-transparent px-3 py-2 transition hover:border-emerald-100 hover:bg-emerald-50/40">
                    <input
                      type="radio"
                      name="publish"
                      checked={publishNow}
                      onChange={() => setPublishNow(true)}
                      className="h-4 w-4 border-gray-300 text-emerald-600 focus:ring-emerald-500/40"
                    />
                    <span className="text-sm font-semibold text-gray-800">즉시 노출</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-transparent px-3 py-2 transition hover:border-violet-100 hover:bg-violet-50/40">
                    <input
                      type="radio"
                      name="publish"
                      checked={!publishNow}
                      onChange={() => setPublishNow(false)}
                      className="h-4 w-4 border-gray-300 text-violet-600 focus:ring-violet-500/40"
                    />
                    <span className="text-sm font-semibold text-gray-800">예약 노출</span>
                  </label>
                </div>
                {!publishNow && (
                  <div className="mt-3 flex flex-wrap gap-2 pl-6 sm:pl-8">
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="rounded-xl border-2 border-gray-200/90 bg-white px-3 py-2 text-sm font-semibold shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                    />
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="rounded-xl border-2 border-gray-200/90 bg-white px-3 py-2 text-sm font-semibold shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                    />
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
                      등록과 동시에 앱 푸시 전송
                    </span>
                    <span className="mt-0.5 block text-xs font-medium text-gray-500">
                      푸시 제목·본문은 아래에서 수정할 수 있어요.
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
                      <p className="mt-1.5 text-[11px] font-medium text-gray-400">
                        [카테고리] 이모지 + 제목 형식 (예: [이벤트] 🎁 역대급 보상이 쏟아져요!)
                      </p>
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

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-stretch">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-amber-200/90 bg-gradient-to-br from-amber-50 to-white py-3.5 text-sm font-black text-amber-900 shadow-sm transition hover:border-amber-300 hover:shadow-md disabled:opacity-50"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : null}
              임시 저장
            </button>
            <button
              type="button"
              onClick={requestPublish}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-lime-400 to-emerald-500 py-3.5 text-sm font-black text-[#0f1f0f] shadow-lg shadow-emerald-300/40 transition hover:from-lime-500 hover:to-emerald-600 hover:shadow-emerald-400/50 disabled:opacity-50"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : null}
              최종 게시
            </button>
          </div>
        </div>
      </div>

      {/* 게시 확인 모달 */}
      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        className="max-w-sm"
      >
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 ring-2 ring-amber-200/70">
            <AlertTriangle size={26} className="text-amber-500" strokeWidth={2.25} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-black tracking-tight text-[#22282E]">공지를 게시할까요?</h3>
            <p className="text-sm font-medium leading-relaxed text-gray-500">
              게시 즉시{' '}
              <span className="font-bold text-[#22282E]">
                {targetAll
                  ? '전체 유저에게'
                  : targetTierExact
                    ? `${selectedTier?.emoji} ${selectedTier?.name} 티어(동일 등급)에게만`
                    : `${selectedTier?.emoji} ${selectedTier?.name} 티어 이상에게`}
              </span>{' '}
              노출돼요.
              {sendPush && (
                <>
                  <br />
                  <span className="text-emerald-600 font-semibold">앱 푸시도 함께 전송</span>됩니다.
                </>
              )}
            </p>
            <p className="mt-2 text-xs font-medium text-amber-600/80">
              게시 후에는 내용을 수정할 수 없어요.
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
              onClick={handlePublish}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-lime-400 to-emerald-500 py-2.5 text-sm font-black text-[#0f1f0f] shadow-md shadow-emerald-300/40 transition hover:from-lime-500 hover:to-emerald-600"
            >
              <Send size={14} strokeWidth={2.5} />
              게시하기
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
