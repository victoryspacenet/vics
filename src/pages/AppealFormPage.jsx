import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, X, Scale } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { supabase } from '../lib/supabase'
import { compressAndCropImage } from '../lib/mediaCrop'
import { generateReceiptId } from '../lib/inquiryStorage'
import { Modal } from '../components/ui/Modal'
import { cn } from '../lib/utils'
import { parseBannedWordError, reportSuspiciousInputIfNeeded } from '../lib/sanitize'

const MAX_IMAGES = 3
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB

/** MZ 파스텔 — 문의·삭제 안내 페이지 계열 */
const PAGE_BG =
  'bg-gradient-to-br from-rose-50/98 via-fuchsia-50/35 to-cyan-50/50'
const SECTION_CARD =
  'rounded-2xl border border-pink-100/60 bg-white/92 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px]'
const HEADER_GLASS =
  'bg-gradient-to-b from-white/90 via-rose-50/40 to-fuchsia-50/20 backdrop-blur-md border-b border-pink-100/55'

export function AppealFormPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { showToast, openLoginModal } = useUIStore()
  const fileInputRef = useRef(null)

  const [content, setContent] = useState('')
  const [images, setImages] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleAddImage = async (e) => {
    const files = Array.from(e.target.files || [])
    if (images.length + files.length > MAX_IMAGES) {
      showToast(`최대 ${MAX_IMAGES}장까지 첨부할 수 있어요.`, 'error')
      return
    }
    const newImages = []
    for (const file of files) {
      if (newImages.length + images.length >= MAX_IMAGES) break
      if (file.size > MAX_IMAGE_BYTES) {
        showToast('이미지는 5MB 이하로 올려 주세요.', 'error')
        continue
      }
      if (!file.type.startsWith('image/')) {
        showToast('이미지 파일만 첨부할 수 있어요.', 'error')
        continue
      }
      try {
        const compressed = await compressAndCropImage(file)
        newImages.push({ file: compressed, preview: URL.createObjectURL(compressed) })
      } catch {
        newImages.push({ file, preview: URL.createObjectURL(file) })
      }
    }
    setImages((prev) => [...prev, ...newImages].slice(0, MAX_IMAGES))
    e.target.value = ''
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
    const urls = []
    for (let i = 0; i < images.length; i++) {
      const { file } = images[i]
      const path = `inquiries/${user.id}/${Date.now()}-${i}.jpg`
      const { error } = await supabase.storage.from('matchup-media').upload(path, file, { cacheControl: '3600' })
      if (error) {
        console.warn('[Appeal] 이미지 업로드 실패:', error)
        continue
      }
      const { data: { publicUrl } } = supabase.storage.from('matchup-media').getPublicUrl(path)
      urls.push(publicUrl)
    }
    return urls
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
    setConfirmOpen(true)
  }

  const handleSubmitConfirm = async () => {
    setConfirmOpen(false)
    setSubmitting(true)
    try {
      // 금칙어 사전 검사 (클라이언트)
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

      // 비정상 입력값 백그라운드 감지 (폼 제출은 막지 않음)
      void reportSuspiciousInputIfNeeded([content.trim()], {
        userId: user?.id,
        path: window.location.pathname,
      })

      const imageUrls = await uploadImages()
      const receiptId = generateReceiptId()
      const receiptTime = new Date().toISOString()

      // appeals 테이블에 직접 저장 (이전 mailto 방식 대체)
      const { error: insertError } = await supabase.from('appeals').insert({
        receipt_id: receiptId,
        status: 'pending',
        nickname: profile?.nickname || '',
        user_id: user.id,
        appeal_title: '이의 신청',
        appeal_content: content.trim(),
        attachments: imageUrls,
      })
      if (insertError) {
        const bannedMsg = parseBannedWordError(insertError)
        if (bannedMsg) throw new Error(bannedMsg)
        throw new Error(insertError.message || '이의 신청 저장에 실패했어요.')
      }

      // 관리자 시스템 푸시 (백그라운드, 실패해도 무방)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          fetch(`${window.location.origin}/.netlify/functions/system-push-dispatch`, {
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
          }).catch(() => {})
        }
      } catch { /* ignore */ }

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

  return (
    <div className={cn('min-h-screen w-full min-w-0', PAGE_BG)}>
      <div className="mx-auto max-w-screen-lg">
        {/* 헤더 */}
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
            이의 신청서 작성
          </h1>
        </div>

        <form onSubmit={handleSubmitClick} className="space-y-5 px-4 py-6">
          {/* 히어로 힌트 */}
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

          {/* 소명 내용 */}
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

          {/* 증거 자료 (선택) */}
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
              accept="image/*"
              multiple
              onChange={handleAddImage}
              className="hidden"
            />
          </section>

          {/* 안내 문구 */}
          <div
            className="rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-rose-50/30 px-4 py-3 text-xs font-medium leading-relaxed text-amber-950/85 shadow-sm ring-1 ring-white/60"
          >
            <p>* 이의 신청은 제재당 1회만 가능합니다.</p>
            <p className="mt-1">* 검토에는 영업일 기준 최대 48시간이 소요됩니다.</p>
          </div>

          {/* 제출하기 */}
          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="w-full rounded-2xl bg-gradient-to-r from-lime-400 via-emerald-400 to-teal-500 py-3.5 text-sm font-black text-[#0f1f0f] shadow-md shadow-emerald-300/45 ring-1 ring-white/50 transition-all hover:brightness-105 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
          >
            {submitting ? '제출 중...' : '제출하기'}
          </button>
        </form>

        {/* 제출 확인 경고 모달 */}
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
              이의 신청은 <strong className="font-black text-amber-700">제재당 1회만</strong> 가능합니다.
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
