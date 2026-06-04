import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Plus, X, Scale } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { supabase } from '../lib/supabase'
import { uploadMatchupMediaValidated } from '../lib/matchupMediaBucketUpload'
import { compressAndCropImage } from '../lib/mediaCrop'
import { generateReceiptId } from '../lib/inquiryStorage'
import { Modal } from '../components/ui/Modal'
import { cn } from '../lib/utils'
import { parseBannedWordError, reportSuspiciousInputIfNeeded } from '../lib/sanitize'
import { getClipboardMediaFiles } from '../lib/clipboardPasteFiles'
import {
  MATCHUP_IMAGE_INPUT_ACCEPT,
  validateSelectableRasterImageUpload,
  validatePipelineJpegOutput,
} from '../lib/uploadMediaValidation'
import { LAYOUT_CONTENT_MAX_WIDTH_CLASS } from '../lib/layoutShellClasses'
import { runWhenIdle } from '../lib/runDeferred'
import { resolveSiteUrl } from '../lib/siteApiBase'
import {
  fetchSanctionWarningForAppeal,
  getLatestAppealableSanctionWarning,
  getSanctionAppealUiState,
  userHasSanctionAppealForWarning,
  mapSanctionAppealInsertError,
} from '../lib/sanctionResultAppeal'

const MAX_IMAGES = 3
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB

/** MZ 파스텔 — 문의·삭제 안내 페이지 계열 */
const PAGE_BG =
  'bg-gradient-to-br from-rose-50/98 via-fuchsia-50/35 to-cyan-50/50'
const SECTION_CARD =
  'rounded-2xl border border-pink-100/60 bg-white/92 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px]'
const HEADER_GLASS =
  'bg-gradient-to-b from-white/90 via-rose-50/40 to-fuchsia-50/20 backdrop-blur-md border-b border-pink-100/55'

function formatSanctionSummary(payload) {
  const p = payload && typeof payload === 'object' ? payload : {}
  const label = p.reasonLabel ? String(p.reasonLabel) : ''
  const msg = p.message ? String(p.message) : ''
  if (label && msg) return `${label} — ${msg.slice(0, 200)}`
  if (label) return label
  if (msg) return msg.slice(0, 240)
  return '제재 통보'
}

export function AppealFormPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sanctionWarningParam = searchParams.get('sanctionWarningId')?.trim() || null
  const { user, profile, loading: authLoading } = useAuthStore()
  const { showToast, openLoginModal } = useUIStore()
  const fileInputRef = useRef(null)

  const [content, setContent] = useState('')
  const [images, setImages] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sanctionCtx, setSanctionCtx] = useState(null)
  const [sanctionResolving, setSanctionResolving] = useState(true)
  const [sanctionParamInvalid, setSanctionParamInvalid] = useState(false)

  const imagesRef = useRef([])
  useEffect(() => {
    imagesRef.current = images
  }, [images])

  useEffect(() => {
    let cancelled = false
    if (authLoading) {
      setSanctionResolving(true)
      return
    }
    if (!user?.id) {
      setSanctionCtx(null)
      setSanctionParamInvalid(false)
      setSanctionResolving(false)
      return
    }
    setSanctionResolving(true)
    setSanctionParamInvalid(false)
    ;(async () => {
      let w = null
      if (sanctionWarningParam) {
        w = await fetchSanctionWarningForAppeal(sanctionWarningParam, user.id)
        if (cancelled) return
        if (!w) {
          setSanctionParamInvalid(true)
          setSanctionCtx(null)
          setSanctionResolving(false)
          return
        }
      } else {
        w = await getLatestAppealableSanctionWarning(user.id)
        if (cancelled) return
        if (!w) {
          setSanctionCtx(null)
          setSanctionResolving(false)
          return
        }
      }
      const dup = await userHasSanctionAppealForWarning(w.id, user.id)
      if (cancelled) return
      setSanctionCtx({ warning: w, hasAppeal: dup })
      setSanctionResolving(false)
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id, sanctionWarningParam, authLoading])

  const sanctionUi = useMemo(
    () =>
      getSanctionAppealUiState(
        sanctionCtx?.warning?.createdAt ?? null,
        Boolean(sanctionCtx?.hasAppeal),
      ),
    [sanctionCtx?.warning?.createdAt, sanctionCtx?.hasAppeal],
  )

  const sanctionSummary = sanctionCtx?.warning
    ? formatSanctionSummary(sanctionCtx.warning.payload)
    : ''

  const addImageFilesFromList = async (files) => {
    const list = Array.from(files || []).filter((f) => f?.type?.startsWith?.('image/'))
    if (!list.length) return
    const prev = imagesRef.current
    if (prev.length >= MAX_IMAGES) {
      showToast(`최대 ${MAX_IMAGES}장까지 첨부할 수 있어요.`, 'error')
      return
    }
    if (prev.length + list.length > MAX_IMAGES) {
      showToast(`최대 ${MAX_IMAGES}장까지 첨부할 수 있어요.`, 'error')
      return
    }
    const newImages = []
    for (const file of list) {
      if (newImages.length + prev.length >= MAX_IMAGES) break
      if (file.size > MAX_IMAGE_BYTES) {
        showToast('이미지는 5MB 이하로 올려 주세요.', 'error')
        continue
      }
      const sniff = await validateSelectableRasterImageUpload(file)
      if (!sniff.ok) {
        showToast(sniff.message, 'error')
        continue
      }
      try {
        const compressed = await compressAndCropImage(file)
        const pj = await validatePipelineJpegOutput(compressed)
        if (!pj.ok) {
          showToast(pj.message, 'error')
          continue
        }
        newImages.push({ file: compressed, preview: URL.createObjectURL(compressed) })
      } catch {
        newImages.push({ file, preview: URL.createObjectURL(file) })
      }
    }
    if (!newImages.length) return
    setImages((p) => [...p, ...newImages].slice(0, MAX_IMAGES))
  }

  const handleAddImage = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    await addImageFilesFromList(files)
  }

  const handleFormPaste = async (e) => {
    const fileArr = getClipboardMediaFiles(e, { images: true })
    if (!fileArr.length) return
    if (e.target?.closest?.('textarea, input[type="text"]')) return
    e.preventDefault()
    await addImageFilesFromList(fileArr)
  }

  const removeImage = (index) => {
    setImages((prev) => {
      const next = [...prev]
      URL.revokeObjectURL(next[index]?.preview)
      next.splice(index, 1)
      return next
    })
  }

  const uploadImages = async () => {
    if (images.length === 0) return []
    const base = Date.now()
    const tasks = images.map(({ file }, i) => {
      const path = `inquiries/${user.id}/${base}-${i}.jpg`
      return uploadMatchupMediaValidated(supabase, {
        objectPath: path,
        body: file,
        fileKind: 'image',
        cacheControl: '3600',
        contentType: file.type || 'image/jpeg',
      }).then(({ error, publicUrl }) => {
        if (error || !publicUrl) {
          console.warn('[Appeal] 이미지 업로드 실패:', error)
          return null
        }
        return publicUrl
      })
    })
    return (await Promise.all(tasks)).filter(Boolean)
  }

  const handleSubmitClick = (e) => {
    e?.preventDefault()
    if (!user) {
      openLoginModal()
      return
    }
    if (!content.trim()) {
      showToast('소명 내용을 입력해 주세요.', 'error')
      return
    }
    if (!sanctionUi.canSubmit || !sanctionCtx?.warning?.id) {
      if (sanctionUi.reason === 'already_submitted') {
        showToast('이 제재에 대한 이의는 이미 제출하셨어요.', 'error')
      } else if (sanctionUi.reason === 'window_closed') {
        showToast('제재 통보 후 24시간이 지나 이의 신청을 할 수 없어요.', 'error')
      } else if (sanctionParamInvalid) {
        showToast('이의 대상 제재를 찾을 수 없어요. 이용 제한 안내에서 다시 시도해 주세요.', 'error')
      } else {
        showToast('이용 제한 안내의 「이의 신청하기」로 들어와 주세요. (제재 통보 후 24시간 이내)', 'error')
      }
      return
    }
    setConfirmOpen(true)
  }

  const handleSubmitConfirm = async () => {
    setConfirmOpen(false)
    setSubmitting(true)
    try {
      const wid = sanctionCtx?.warning?.id
      if (!wid || !sanctionUi.canSubmit) {
        showToast('이의를 제출할 수 있는 제재 내역이 없어요.', 'error')
        return
      }

      const { data: bannedList } = await supabase
        .from('admin_banned_words')
        .select('word')
        .eq('active', true)
      if (bannedList) {
        const lower = content.toLowerCase()
        const hit = bannedList.find((b) => lower.includes(b.word.toLowerCase()))
        if (hit) {
          showToast(`금칙어가 포함되어 있습니다: ${hit.word}`, 'error')
          return
        }
      }

      void reportSuspiciousInputIfNeeded([content.trim()], {
        userId: user?.id,
        path: window.location.pathname,
      })

      const imageUrls = await uploadImages()
      const receiptId = generateReceiptId()
      const receiptTime = new Date().toISOString()

      const vr = sanctionSummary.slice(0, 500)

      const insertRow = {
        receipt_id: receiptId,
        status: 'pending',
        nickname: profile?.nickname || '',
        user_id: user.id,
        appeal_title: '제재 결과 이의 신청',
        appeal_content: content.trim(),
        attachments: imageUrls,
        appeal_kind: 'sanction',
        sanction_warning_id: wid,
        violation_reason: vr || '제재 결과 이의',
      }

      const { error: insertError } = await supabase.from('appeals').insert(insertRow)
      if (insertError) {
        const bannedMsg = parseBannedWordError(insertError)
        if (bannedMsg) throw new Error(bannedMsg)
        throw new Error(mapSanctionAppealInsertError(insertError))
      }

      window.dispatchEvent(new CustomEvent('vics:adminAppeals:updated'))

      runWhenIdle(() => {
        void (async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.access_token) return
            await fetch(resolveSiteUrl('/api/system-push-dispatch'), {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                eventId: 'appeal_submitted',
                title: '이의 신청 접수',
                body: `접수번호: ${receiptId}\n닉네임: ${profile?.nickname || ''}\n내용 일부: ${content.trim().slice(0, 200)}`,
                relatedId: receiptId,
              }),
            })
          } catch {
            /* 알림 실패는 접수 성공에 영향 없음 */
          }
        })()
      })

      navigate('/inquiry/appeal/complete', {
        replace: true,
        state: {
          receiptId,
          receiptTime,
        },
      })
    } catch (err) {
      showToast(err.message || '제출에 실패했어요.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const submitBlocked =
    submitting ||
    !content.trim() ||
    sanctionResolving ||
    authLoading ||
    sanctionParamInvalid ||
    !sanctionUi.canSubmit ||
    !sanctionCtx?.warning?.id

  return (
    <div className={cn('min-h-screen w-full min-w-0', PAGE_BG)}>
      <div className={cn(LAYOUT_CONTENT_MAX_WIDTH_CLASS, 'mx-auto')}>
        <div className={cn('sticky top-0 z-20 flex items-center gap-3 px-4 py-3', HEADER_GLASS)}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="-ml-1 flex shrink-0 items-center gap-1 rounded-2xl border border-pink-100/80 bg-white/90 px-2.5 py-2 text-fuchsia-950 shadow-sm shadow-pink-100/40 transition hover:bg-white hover:shadow-md"
            aria-label="뒤로"
          >
            <ArrowLeft size={20} strokeWidth={2.25} />
          </button>
          <h1 className="min-w-0 flex-1 bg-gradient-to-r from-fuchsia-700 via-violet-600 to-cyan-600 bg-clip-text text-lg font-black tracking-tight text-transparent">
            제재 결과 이의 신청
          </h1>
        </div>

        <form onSubmit={handleSubmitClick} onPaste={handleFormPaste} className="space-y-5 px-4 py-6">
          {sanctionParamInvalid && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
              이의 대상 제재를 찾을 수 없어요. 이용 제한 안내 화면에서 다시 시도해 주세요.
            </div>
          )}
          {!sanctionResolving && !authLoading && !sanctionParamInvalid && !sanctionCtx && user && (
            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm font-medium text-amber-950">
              제재 통보 후 <strong className="font-black">24시간 이내</strong>이면서, 아직 이의를 제출하지 않은
              최근 제재만 이의 신청할 수 있어요. <strong className="font-black">이용 제한 안내</strong> 화면의
              「이의 신청하기」로 들어와 주세요.
            </div>
          )}
          {sanctionCtx?.warning && (
            <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/95 to-fuchsia-50/40 px-4 py-3.5 text-sm text-violet-950 shadow-sm ring-1 ring-white/70">
              <p className="font-black text-violet-950">이의 대상 제재</p>
              <p className="mt-1 font-semibold leading-snug">{sanctionSummary}</p>
              <p className="mt-2 text-xs font-medium text-violet-900/75">
                제재 통보 시각부터 <strong className="text-violet-950">24시간 이내</strong>에만 신청할 수 있고,{' '}
                <strong className="text-violet-950">동일 제재당 1회</strong>만 가능해요.
              </p>
              {sanctionUi.deadlineMs && (
                <p className="mt-1.5 text-[11px] text-violet-800/80">
                  신청 마감: {new Date(sanctionUi.deadlineMs).toLocaleString('ko-KR')}
                </p>
              )}
            </div>
          )}

          <div className="flex items-start gap-3 rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50/95 via-fuchsia-50/80 to-cyan-50/50 px-4 py-3.5 shadow-sm shadow-violet-200/25 ring-1 ring-white/80">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 text-white shadow-md shadow-fuchsia-400/35 ring-1 ring-white/50">
              <Scale size={20} strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-fuchsia-950">소명 내용을 꼼꼼히 적어 주세요</p>
              <p className="mt-0.5 text-xs font-medium leading-relaxed text-fuchsia-800/60">
                운영팀이 근거를 바탕으로 다시 검토해요.
              </p>
            </div>
          </div>

          <section className={cn(SECTION_CARD, 'border-pink-100/70 p-5')}>
            <label className="mb-2 block text-sm font-black text-fuchsia-950">소명 내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder='내용을 입력해주세요. (예: "패션 카테고리 인데 신발 사진이 왜 주제 이탈인가요?")'
              rows={5}
              className="w-full resize-none rounded-2xl border-2 border-pink-100/90 bg-white/95 px-4 py-3 text-fuchsia-950 placeholder:text-fuchsia-300/80 focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-300/40"
            />
          </section>

          <section className={cn(SECTION_CARD, 'border-pink-100/70 p-5')}>
            <label className="mb-2 block text-sm font-black text-fuchsia-950">증거 자료 (선택)</label>
            <p className="mb-3 text-xs font-medium text-fuchsia-700/55">스크린샷이나 사진을 최대 {MAX_IMAGES}장까지 첨부할 수 있어요.</p>
            <div className="flex flex-wrap gap-2">
              {images.map((img, i) => (
                <div
                  key={i}
                  className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-pink-100/80 bg-fuchsia-50/50 shadow-sm ring-1 ring-white/80"
                >
                  <img src={img.preview} alt={`첨부 ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-fuchsia-950/55 text-white backdrop-blur-sm transition hover:bg-fuchsia-950/75"
                    aria-label="삭제"
                  >
                    <X size={14} strokeWidth={2.5} />
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-dashed border-fuchsia-200/90 bg-gradient-to-br from-fuchsia-50/90 to-cyan-50/40 text-fuchsia-500 transition hover:border-fuchsia-400 hover:from-fuchsia-100/80 hover:to-cyan-50/60 hover:text-fuchsia-700 hover:shadow-md"
                >
                  <Plus size={22} strokeWidth={2.25} />
                  <span className="text-[9px] font-bold leading-tight text-fuchsia-700/80">사진·캡처</span>
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={MATCHUP_IMAGE_INPUT_ACCEPT}
              multiple
              onChange={handleAddImage}
              className="hidden"
            />
          </section>

          <div
            className="rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-rose-50/30 px-4 py-3 text-xs font-medium leading-relaxed text-amber-950/85 shadow-sm ring-1 ring-white/60"
          >
            <p>
              * <strong className="font-black">제재 결과</strong>에 대한 이의는 통보 시각 기준 <strong className="font-black">24시간 이내</strong>·
              <strong className="font-black">해당 제재당 1회만</strong> 가능합니다.
            </p>
            <p className="mt-1">* 검토에는 영업일 기준 최대 48시간이 소요될 수 있습니다.</p>
          </div>

          <button
            type="submit"
            disabled={submitBlocked}
            className="w-full rounded-2xl bg-gradient-to-r from-lime-400 via-emerald-400 to-teal-500 py-3.5 text-sm font-black text-[#0f1f0f] shadow-md shadow-emerald-300/45 ring-1 ring-white/50 transition-all hover:brightness-105 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
          >
            {submitting ? '제출 중...' : '제출하기'}
          </button>
        </form>

        <Modal
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title="이의 신청 제출"
          className="border-2 border-pink-200/85 bg-gradient-to-br from-rose-50 via-fuchsia-50/95 to-cyan-50/90 shadow-[0_24px_48px_-12px_rgba(236,72,153,0.3)] ring-2 ring-white/90"
          headerClassName="border-b border-pink-100/80 bg-gradient-to-r from-fuchsia-50/95 via-pink-50/80 to-cyan-50/50"
          titleClassName="text-base font-black text-fuchsia-950"
        >
          <div className="space-y-4">
            <p className="text-sm font-medium leading-relaxed text-fuchsia-900/85">
              제재 결과 이의는 <strong className="font-black text-amber-700">24시간 이내·해당 제재당 1회만</strong> 제출할 수
              있습니다.
              <br />
              정말 제출하시겠습니까?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-2xl border-2 border-pink-200/90 bg-white/90 py-2.5 text-sm font-black text-fuchsia-800/80 transition hover:bg-fuchsia-50/80"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSubmitConfirm}
                className="flex-1 rounded-2xl bg-gradient-to-r from-lime-400 via-emerald-400 to-teal-500 py-2.5 text-sm font-black text-[#0f1f0f] shadow-md shadow-emerald-300/40 ring-1 ring-white/50 transition hover:brightness-105 active:scale-[0.98]"
              >
                제출하기
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  )
}
