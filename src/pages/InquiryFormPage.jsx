import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronDown, Plus, X, ImageIcon } from 'lucide-react'
import { Modal } from '../components/ui/Modal'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { supabase } from '../lib/supabase'
import { compressAndCropImage } from '../lib/mediaCrop'
import { generateReceiptId } from '../lib/inquiryStorage'
import { ensureInquiryAutoReplyAfterInsert } from '../lib/inquiryBotAutoReply'
import { cn } from '../lib/utils'
import { parseBannedWordError, reportSuspiciousInputIfNeeded } from '../lib/sanitize'

/** MZ 파스텔 — 문의 내역·상세와 동일 계열 */
const PAGE_BG =
  'bg-gradient-to-br from-rose-50/98 via-fuchsia-50/35 to-cyan-50/50'
const SECTION_CARD =
  'rounded-2xl border border-pink-100/60 bg-white/92 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px]'
const HEADER_GLASS =
  'bg-gradient-to-b from-white/90 via-rose-50/40 to-fuchsia-50/20 backdrop-blur-md border-b border-pink-100/55'

const CATEGORIES = [
  { id: 'matchup', label: '매치업' },
  { id: 'report', label: '신고' },
  { id: 'account', label: '계정' },
  { id: 'appeal', label: '이의 신청' },
  { id: 'suggestion', label: '건의' },
  { id: 'etc', label: '기타' },
]

const MAX_IMAGES = 3
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB

export function InquiryFormPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { showToast, openLoginModal } = useUIStore()
  const fileInputRef = useRef(null)

  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [category, setCategory] = useState('')
  const [categoryOpen, setCategoryOpen] = useState(false)

  useEffect(() => {
    if (location.state?.presetCategory === 'appeal') {
      setCategory('appeal')
      return
    }
    const q = searchParams.get('category')
    if (q && CATEGORIES.some((c) => c.id === q)) {
      setCategory(q)
    }
  }, [location.state?.presetCategory, searchParams])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [images, setImages] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const selectedCategory = CATEGORIES.find((c) => c.id === category)
  const isReportCategory = category === 'report'

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
        console.warn('[Inquiry] 이미지 업로드 실패:', error)
        continue
      }
      const { data: { publicUrl } } = supabase.storage.from('matchup-media').getPublicUrl(path)
      urls.push(publicUrl)
    }
    return urls
  }

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (!user) {
      openLoginModal()
      return
    }
    if (!category) {
      showToast('문의 카테고리를 선택해 주세요.', 'error')
      return
    }
    if (!title.trim()) {
      showToast('제목을 입력해 주세요.', 'error')
      return
    }
    if (!content.trim()) {
      showToast('내용을 입력해 주세요.', 'error')
      return
    }
    setConfirmOpen(true)
  }

  const handleConfirmSend = async () => {
    setConfirmOpen(false)
    setSubmitting(true)
    try {
      const imageUrls = await uploadImages()
      const receiptId = generateReceiptId()
      const receiptTime = new Date().toISOString()

      // 비정상 입력값 백그라운드 감지 (폼 제출은 막지 않음)
      void reportSuspiciousInputIfNeeded([title.trim(), content.trim()], {
        userId: user?.id,
        path: window.location.pathname,
      })

      // Supabase inquiries 테이블에 저장 (자동 응대 트리거 포함)
      let inquiryId = null
      if (user) {
        const { data: dbInquiry, error: dbError } = await supabase
          .from('inquiries')
          .insert({
            receipt_id: receiptId,
            user_id: user.id,
            category,
            category_label: selectedCategory?.label || category,
            title: title.trim(),
            content: content.trim(),
            status: 'pending',
            image_urls: imageUrls.length > 0 ? imageUrls : null,
          })
          .select('id')
          .single()
        if (dbError) {
          const bannedMsg = parseBannedWordError(dbError)
          if (bannedMsg) {
            showToast(bannedMsg, 'error')
            return
          }
        }
        if (!dbError && dbInquiry) {
          inquiryId = dbInquiry.id
          await ensureInquiryAutoReplyAfterInsert(dbInquiry.id, category)
        }
      }

      navigate('/inquiry/complete', {
        replace: true,
        state: {
          categoryLabel: selectedCategory?.label || category,
          title: title.trim(),
          receiptTime,
          receiptId,
          inquiryId,
        },
      })
    } catch (err) {
      showToast(err.message || '문의 전송에 실패했어요.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelConfirm = () => {
    setConfirmOpen(false)
  }

  return (
    <div className={cn('min-h-screen', PAGE_BG)}>
      <div className="max-w-screen-lg mx-auto">
        {/* 헤더: 뒤로 + 전송 */}
        <div className={cn('sticky top-0 z-20 px-4 py-3 flex items-center gap-3', HEADER_GLASS)}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-xl hover:bg-pink-100/60 transition-colors"
            aria-label="뒤로"
          >
            <ArrowLeft size={20} className="text-fuchsia-900" />
          </button>
          <h1 className="text-lg font-black text-fuchsia-950 flex-1 tracking-tight">1:1 문의</h1>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !category || !title.trim() || !content.trim()}
            className="px-4 py-2 rounded-2xl bg-gradient-to-r from-lime-400 via-emerald-400 to-teal-500 text-[#0f1f0f] text-sm font-black disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md shadow-emerald-300/35 active:scale-95 transition-all ring-1 ring-white/50"
          >
            전송
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-6 space-y-6">
          {/* 문의 카테고리 선택 — 열릴 때 아래 섹션보다 위에 보이도록 z-index */}
          <section
            className={cn(
              SECTION_CARD,
              'p-5 border-pink-100/70',
              categoryOpen && 'relative z-50'
            )}
          >
            <label className="block text-sm font-black text-fuchsia-950 mb-2">문의 카테고리 선택</label>
            <p className="text-xs text-fuchsia-700/55 mb-2">매치업 / 신고 / 계정 / 건의 / 기타</p>
            <div className="relative z-0">
              <button
                type="button"
                onClick={() => setCategoryOpen((o) => !o)}
                className="relative z-[60] w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl border border-pink-200/80 bg-white/95 text-left text-fuchsia-950 placeholder:text-fuchsia-300 focus:outline-none focus:ring-2 focus:ring-fuchsia-300/50 focus:border-fuchsia-400"
              >
                <span className={category ? 'font-semibold' : 'text-fuchsia-400'}>
                  {selectedCategory?.label || '선택하세요'}
                </span>
                <ChevronDown size={18} className={cn('text-fuchsia-500 shrink-0 transition-transform', categoryOpen && 'rotate-180')} />
              </button>
              {categoryOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[45] bg-fuchsia-950/25 backdrop-blur-[2px]"
                    onClick={() => setCategoryOpen(false)}
                    aria-hidden
                  />
                  <div className="absolute top-full left-0 right-0 mt-1.5 py-1 rounded-2xl border border-pink-200/90 bg-gradient-to-b from-white via-rose-50 to-fuchsia-50 shadow-xl shadow-pink-200/40 z-[70] overflow-hidden ring-2 ring-white/95">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCategory(c.id)
                          setCategoryOpen(false)
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm font-semibold text-fuchsia-900 hover:bg-fuchsia-50/90 transition-colors"
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>

          {/* 제목 */}
          <section className={cn(SECTION_CARD, 'p-5 border-pink-100/70')}>
            <label className="block text-sm font-black text-fuchsia-950 mb-2">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목을 입력해 주세요."
              className="w-full px-4 py-3 rounded-2xl border border-pink-200/80 bg-white/95 text-fuchsia-950 placeholder:text-fuchsia-300/90 focus:outline-none focus:ring-2 focus:ring-fuchsia-300/50 focus:border-fuchsia-400"
            />
          </section>

          {/* 내용 */}
          <section className={cn(SECTION_CARD, 'p-5 border-pink-100/70')}>
            <label className="block text-sm font-black text-fuchsia-950 mb-2">내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="억울한 상황이나 궁금한 점을 상세히 적어주시면 빛의 속도로 답변해 드릴게요!"
              rows={5}
              className="w-full px-4 py-3 rounded-2xl border border-pink-200/80 bg-white/95 text-fuchsia-950 placeholder:text-fuchsia-300/90 focus:outline-none focus:ring-2 focus:ring-fuchsia-300/50 focus:border-fuchsia-400 resize-none"
            />
            {isReportCategory && (
              <p className="mt-3 text-sm text-rose-700 font-bold flex items-center gap-2 rounded-xl bg-rose-50/90 border border-rose-200/60 px-3 py-2">
                <ImageIcon size={16} className="text-rose-500 shrink-0" />
                증거 화면을 캡처해서 올려주시면 처리가 빨라요!
              </p>
            )}
          </section>

          {/* 사진 첨부 (최대 3장) */}
          <section className={cn(SECTION_CARD, 'p-5 border-pink-100/70')}>
            <label className="block text-sm font-black text-fuchsia-950 mb-2">사진 첨부 (최대 3장)</label>
            <div className="flex gap-2 flex-wrap">
              {images.map((img, i) => (
                <div key={i} className="relative w-20 h-20 rounded-2xl overflow-hidden border border-pink-200/70 bg-fuchsia-50/50 shrink-0 shadow-sm">
                  <img src={img.preview} alt={`첨부 ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-fuchsia-950/55 text-white flex items-center justify-center hover:bg-fuchsia-900/80"
                    aria-label="삭제"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-2xl border-2 border-dashed border-fuchsia-300/70 flex flex-col items-center justify-center gap-0.5 text-fuchsia-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-gradient-to-br hover:from-emerald-50 hover:to-teal-50/80 transition-all shrink-0"
                >
                  <Plus size={22} strokeWidth={2.5} />
                  <span className="text-[10px] font-black">첨부</span>
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

          <p className="text-xs text-fuchsia-700/60 flex items-center gap-1.5 font-medium">
            <span className="text-fuchsia-400">*</span>
            답변 완료 시 푸시 알림을 보내드려요.
          </p>
        </form>

        <Modal
          isOpen={confirmOpen}
          onClose={handleCancelConfirm}
          title="문의 전송"
          className="border border-pink-100/70 bg-gradient-to-b from-white via-rose-50/50 to-fuchsia-50/35 shadow-2xl shadow-pink-200/35 ring-2 ring-white/85"
        >
          <div className="space-y-4">
            <p className="text-sm text-fuchsia-900/80 leading-relaxed">
              입력하신 내용으로 1:1 문의를 전송합니다. 전송 후에는 수정할 수 없어요. 계속할까요?
            </p>
            <div className="flex flex-wrap gap-3 justify-end items-center">
              <button
                type="button"
                onClick={handleCancelConfirm}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 border-pink-200/90 bg-white text-sm font-black text-fuchsia-800 hover:bg-fuchsia-50 transition-all"
              >
                <X size={15} />
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmSend}
                disabled={submitting}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-lime-400 via-emerald-400 to-teal-500 text-[#0f1f0f] text-sm font-black hover:brightness-105 transition-all disabled:opacity-50 min-w-[7rem] shadow-md shadow-emerald-300/40 ring-1 ring-white/50"
              >
                전송
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  )
}
