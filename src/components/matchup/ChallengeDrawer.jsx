import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, X, Image, Video, Type, AlertCircle, CheckCircle, Hash, Zap, Share2, Link2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { Drawer } from '../ui/Drawer'
import { Avatar } from '../ui/Avatar'
import { cn, copyToClipboard } from '../../lib/utils'

const MAX_IMAGE_MB = 5
const MAX_VIDEO_MB = 50
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024
const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024

async function compressImage(file) {
  return new Promise((resolve) => {
    const img = document.createElement('img')
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1200
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX }
        else { width = Math.round((width * MAX) / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })),
        'image/jpeg', 0.85
      )
    }
    img.src = url
  })
}

export function ChallengeDrawer() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { challengeMatchup, closeChallengeDrawer, showToast, openLoginModal } = useUIStore()

  const [rightContent, setRightContent] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadStep, setUploadStep] = useState('')
  const [shareModal, setShareModal] = useState(null) // { matchupId, title }
  const [boxKey, setBoxKey] = useState(0)
  const [linkCopied, setLinkCopied] = useState(false)

  const isOpen = !!challengeMatchup
  const isValid = !!rightContent

  useEffect(() => {
    if (!isOpen) {
      setRightContent(null)
      setUploadStep('')
      setBoxKey((k) => k + 1)
    }
  }, [isOpen])

  const handleClose = () => {
    if (uploading) return
    closeChallengeDrawer()
  }

  const uploadFile = async (file) => {
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    if (!isImage && !isVideo) throw new Error('이미지 또는 영상 파일만 업로드 가능해요')
    if (isImage && file.size > MAX_IMAGE_BYTES) throw new Error(`이미지는 ${MAX_IMAGE_MB}MB 이하로 올려주세요`)
    if (isVideo && file.size > MAX_VIDEO_BYTES) throw new Error(`영상은 ${MAX_VIDEO_MB}MB 이하로 올려주세요`)

    let toUpload = file
    if (isImage) {
      setUploadStep('이미지 압축 중...')
      toUpload = await compressImage(file)
    }
    setUploadStep('파일 업로드 중...')

    const ext = isImage ? 'jpg' : file.name.split('.').pop().toLowerCase()
    const path = `matchups/${user.id}/${Date.now()}-right.${ext}`

    const { error } = await supabase.storage.from('matchup-media').upload(path, toUpload, { cacheControl: '3600' })
    if (error) {
      if (error.message?.toLowerCase().includes('policy') || error.statusCode === 403 || error.statusCode === '403')
        throw new Error('Storage 권한이 없어요. 로그인 상태를 확인해주세요.')
      throw new Error(error.message || '파일 업로드에 실패했어요')
    }

    const { data: { publicUrl } } = supabase.storage.from('matchup-media').getPublicUrl(path)
    return { url: publicUrl, thumbnail: isImage ? publicUrl : null }
  }

  const handleSubmit = async () => {
    if (!isValid || uploading || !challengeMatchup) return
    if (!user) { openLoginModal(); return }

    setUploading(true)
    try {
      let rightUrl = null, rightThumbnail = null
      if (rightContent.file) {
        const r = await uploadFile(rightContent.file)
        rightUrl = r.url; rightThumbnail = r.thumbnail
      }

      setUploadStep('매치업 완성 중...')

      const { error } = await supabase
        .from('matchups')
        .update({
          right_type: rightContent.type,
          right_url: rightUrl,
          right_text: rightContent.text || null,
          right_thumbnail_url: rightThumbnail,
          right_label: 'B',
          is_complete: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', challengeMatchup.id)

      if (error) {
        if (error.code === '42501') throw new Error('권한이 없어요. 작성자 본인이나 도전자만 참여 가능해요.')
        throw new Error(error.message)
      }

      showToast('매치업이 성공적으로 완성됐어요! 🎉', 'success')
      const matchupId = challengeMatchup.id
      const matchupTitle = challengeMatchup.title
      closeChallengeDrawer()

      // 공유 유도 모달 → 상세 페이지 이동
      setShareModal({ matchupId, matchupTitle })
    } catch (err) {
      console.error('[ChallengeDrawer]', err)
      showToast(err.message || '도전 중 오류가 발생했어요. 다시 시도해주세요.', 'error')
    } finally {
      setUploading(false)
      setUploadStep('')
    }
  }

  const handleShareAndGo = async () => {
    if (!shareModal) return
    const url = `${window.location.origin}/matchup/${shareModal.matchupId}`
    await copyToClipboard(url)
    showToast('링크가 복사됐어요! 친구들에게 공유해보세요 🔗', 'success')
    setShareModal(null)
    navigate(`/matchup/${shareModal.matchupId}`)
  }

  const handleGoWithoutShare = () => {
    if (!shareModal) return
    const id = shareModal.matchupId
    setShareModal(null)
    navigate(`/matchup/${id}`)
  }

  const matchup = challengeMatchup

  return (
    <>
      <Drawer isOpen={isOpen} onClose={handleClose} title="⚡ 도전장 보내기">
        {matchup && (
          <div className="p-5 space-y-6 pb-8">

            {/* ── SECTION 1: 대결 주제 (읽기 전용) ── */}
            <section className="space-y-2">
              <SectionLabel emoji="📌" text="대결 주제" hint="User A가 설정함" />
              <div className="px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl">
                <p className="text-sm font-bold text-[#22282E]">{matchup.title}</p>
                {matchup.description && (
                  <p className="text-xs text-gray-500 mt-1">{matchup.description}</p>
                )}
              </div>
              {/* 작성자 */}
              <div className="flex items-center gap-2 px-1">
                <Avatar src={matchup.profiles?.avatar_url} alt={matchup.profiles?.nickname} size="xs" />
                <span className="text-xs text-gray-400">
                  <span className="font-semibold text-[#22282E]">{matchup.profiles?.nickname || '사용자'}</span>
                  님의 대결 주제
                </span>
              </div>
            </section>

            {/* ── SECTION 2: 대결 구도 ── */}
            <section className="space-y-3">
              <SectionLabel emoji="🥊" text="대결 구도" hint="Ready to Fight!" />

              <div className="grid grid-cols-[1fr_44px_1fr] gap-2 items-stretch">
                {/* User A 콘텐츠 (읽기 전용) */}
                <div className="space-y-1.5">
                  <div className="flex items-center">
                    <span className="text-[11px] font-black bg-gray-200 text-gray-600 px-2 py-0.5 rounded-md">
                      User A (고정)
                    </span>
                  </div>
                  <UserAPreview matchup={matchup} />
                </div>

                {/* VS */}
                <div className="flex items-center justify-center">
                  <div className="flex flex-col items-center gap-1 h-full">
                    <div className="w-px flex-1 bg-gradient-to-b from-transparent via-gray-200 to-transparent" />
                    <span className="text-lg font-black text-gray-300 tracking-tighter">VS</span>
                    <div className="w-px flex-1 bg-gradient-to-b from-transparent via-gray-200 to-transparent" />
                  </div>
                </div>

                {/* User B 업로드 */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black bg-[#22282E] text-white px-2 py-0.5 rounded-md">
                      MY SHOT
                    </span>
                  </div>
                  <UserBUploadBox
                    key={`b-${boxKey}`}
                    content={rightContent}
                    onChange={setRightContent}
                    disabled={uploading}
                  />
                </div>
              </div>

              {/* 경고 안내 */}
              <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
                <span className="text-sm shrink-0 mt-0.5">📢</span>
                <p className="text-[11px] text-red-700 leading-relaxed">
                  <span className="font-bold">'최종 매치업 만들기'</span>를 누르면 즉시 투표가 시작되며 수정이 불가능해요.
                </p>
              </div>
            </section>

            {/* ── SECTION 3: 태그 (읽기 전용) ── */}
            {matchup.tags && matchup.tags.length > 0 && (
              <section className="space-y-2">
                <SectionLabel emoji="🏷️" text="태그" hint="User A가 설정함" />
                <div className="flex flex-wrap gap-2">
                  {matchup.tags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 text-xs font-semibold bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full"
                    >
                      <Hash size={10} />
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* ── 업로드 진행 상태 ── */}
            {uploading && uploadStep && (
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl">
                <span className="w-4 h-4 border-2 border-gray-300 border-t-[#22282E] rounded-full animate-spin shrink-0" />
                <span className="text-sm text-gray-600">{uploadStep}</span>
              </div>
            )}

            {/* ── 최종 생성 버튼 ── */}
            <button
              onClick={handleSubmit}
              disabled={!isValid || uploading}
              className={cn(
                'w-full py-4 rounded-2xl text-sm font-black tracking-wide transition-all duration-300',
                isValid && !uploading
                  ? 'bg-[#22282E] text-white shadow-[0_0_24px_rgba(34,40,46,0.45)] hover:shadow-[0_0_40px_rgba(34,40,46,0.65)] hover:scale-[1.01] active:scale-[0.99]'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              )}
            >
              {uploading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  처리 중...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  {isValid && <Zap size={16} className="fill-current" />}
                  최종 매치업 만들기
                </span>
              )}
            </button>
          </div>
        )}
      </Drawer>

      {/* ── 공유 유도 모달 ── */}
      {shareModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleGoWithoutShare} />
          <div className="relative bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl z-10 text-center space-y-4">
            {/* 이모지 */}
            <div className="text-5xl">🎉</div>
            <div>
              <h3 className="text-lg font-black text-[#22282E]">대결이 시작됐어요!</h3>
              <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                당신의 대결이 시작되었습니다!<br />
                친구들에게 투표를 부탁해보세요.
              </p>
            </div>

            {/* 매치업 제목 미리보기 */}
            <div className="px-3 py-2 bg-gray-50 rounded-xl">
              <p className="text-sm font-semibold text-[#22282E] line-clamp-1">"{shareModal.matchupTitle}"</p>
            </div>

            <div className="space-y-2 pt-1">
              {/* 링크 복사 + 이동 */}
              <button
                onClick={handleShareAndGo}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#22282E] text-white rounded-2xl text-sm font-bold hover:bg-[#363d46] transition-colors"
              >
                <Link2 size={16} />
                링크 복사하고 대결 보기
              </button>

              {/* 바로 이동 */}
              <button
                onClick={handleGoWithoutShare}
                className="w-full py-3 text-sm text-gray-400 hover:text-[#22282E] transition-colors font-medium"
              >
                공유 없이 대결 보기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── SectionLabel ──────────────────────────────────────────────────
function SectionLabel({ emoji, text, hint }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-base">{emoji}</span>
      <span className="text-sm font-bold text-[#22282E]">{text}</span>
      {hint && <span className="text-xs text-gray-400 ml-auto">{hint}</span>}
    </div>
  )
}

// ── User A 고정 미리보기 ──────────────────────────────────────────
function UserAPreview({ matchup }) {
  const src = matchup.left_thumbnail_url || matchup.left_url

  return (
    <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
      <span className="absolute top-2 left-2 z-10 text-[11px] font-black bg-[#22282E]/80 text-white px-1.5 py-0.5 rounded-md">
        {matchup.left_label || 'A'}
      </span>
      {matchup.left_type === 'image' && src && (
        <img src={src} alt="A" className="w-full h-full object-cover" />
      )}
      {matchup.left_type === 'video' && src && (
        <img src={src} alt="A" className="w-full h-full object-cover" />
      )}
      {matchup.left_type === 'text' && (
        <div className="w-full h-full flex items-center justify-center p-3 bg-gray-50">
          <p className="text-xs font-medium text-center text-[#22282E] line-clamp-4">{matchup.left_text}</p>
        </div>
      )}
      {/* 잠금 오버레이 */}
      <div className="absolute inset-0 bg-transparent" />
      <div className="absolute bottom-2 right-2 z-10 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-md font-semibold">
        🔒 고정
      </div>
    </div>
  )
}

// ── User B 업로드 박스 ────────────────────────────────────────────
function UserBUploadBox({ content, onChange, disabled }) {
  const fileRef = useRef(null)
  const [contentType, setContentType] = useState('image')
  const [dragging, setDragging] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [sizeError, setSizeError] = useState('')

  const validateAndSet = (file) => {
    if (!file) return
    setSizeError('')
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    if (!isImage && !isVideo) { setSizeError('이미지 또는 영상만 가능해요'); return }
    if (isImage && file.size > MAX_IMAGE_BYTES) { setSizeError(`최대 ${MAX_IMAGE_MB}MB`); return }
    if (isVideo && file.size > MAX_VIDEO_BYTES) { setSizeError(`최대 ${MAX_VIDEO_MB}MB`); return }
    const preview = URL.createObjectURL(file)
    onChange({ type: isVideo ? 'video' : 'image', file, preview })
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false)
    if (disabled) return
    validateAndSet(e.dataTransfer.files?.[0])
  }

  const handleRemove = (e) => {
    e?.stopPropagation(); onChange(null); setSizeError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const TYPES = [
    { id: 'image', icon: Image },
    { id: 'video', icon: Video },
    { id: 'text',  icon: Type  },
  ]

  return (
    <div className="space-y-1.5">
      {/* 타입 선택 */}
      <div className="flex gap-1 mb-0.5">
        {TYPES.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => { setContentType(id); onChange(null); setTextInput('') }}
            disabled={disabled}
            className={cn(
              'p-1 rounded transition-colors',
              contentType === id ? 'bg-[#22282E] text-white' : 'text-gray-300 hover:text-gray-500',
              disabled && 'opacity-40 cursor-not-allowed'
            )}
          >
            <Icon size={11} />
          </button>
        ))}
      </div>

      {/* 텍스트 입력 */}
      {contentType === 'text' ? (
        <textarea
          value={textInput}
          onChange={(e) => {
            setTextInput(e.target.value)
            onChange(e.target.value.trim() ? { type: 'text', text: e.target.value.trim() } : null)
          }}
          placeholder="내 의견을 입력하세요"
          rows={6}
          maxLength={200}
          disabled={disabled}
          className="w-full px-3 py-3 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#22282E] resize-none text-center disabled:opacity-60"
        />
      ) : (
        /* 파일 드롭 박스 */
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onClick={() => { if (!content && !disabled) fileRef.current?.click() }}
          className={cn(
            'relative aspect-square rounded-xl border-2 border-dashed transition-all overflow-hidden',
            disabled ? 'opacity-60 cursor-not-allowed' :
            dragging ? 'border-[#22282E] bg-gray-100 scale-[1.02]' :
            content ? 'border-[#22282E] cursor-default' :
            'border-gray-200 bg-gray-50 hover:border-[#22282E]/50 hover:bg-gray-100 cursor-pointer active:scale-[0.98]'
          )}
        >
          {content ? (
            <>
              {content.type === 'image' && <img src={content.preview} alt="" className="w-full h-full object-cover" />}
              {content.type === 'video' && <video src={content.preview} className="w-full h-full object-cover" muted />}
              {!disabled && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors z-10"
                >
                  <X size={11} />
                </button>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2">
                <div className="flex items-center gap-1">
                  <CheckCircle size={11} className="text-green-400" />
                  <span className="text-white text-[10px] font-semibold">준비 완료!</span>
                </div>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <Upload size={18} className="text-gray-400" />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-gray-500">클릭 또는 드롭</p>
                <p className="text-[10px] mt-0.5 text-gray-300">
                  {contentType === 'image' ? `JPG, PNG (${MAX_IMAGE_MB}MB)` : `MP4, MOV (${MAX_VIDEO_MB}MB)`}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {sizeError && (
        <div className="flex items-center gap-1 text-[11px] text-red-500">
          <AlertCircle size={11} />{sizeError}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={contentType === 'image' ? 'image/*' : 'video/*'}
        className="hidden"
        onChange={(e) => validateAndSet(e.target.files?.[0])}
      />
    </div>
  )
}
