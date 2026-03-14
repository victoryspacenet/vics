import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, X, Image, Video, Type, AlertCircle, CheckCircle, Hash, Info,
         ChevronDown, Users, Clock, Heart, MessageCircle, Share2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { Drawer } from '../ui/Drawer'
import { cn } from '../../lib/utils'

const MAX_IMAGE_MB = 5
const MAX_VIDEO_MB = 50
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024
const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024
const MAX_TAGS = 3
const TITLE_MAX = 60

const CATEGORIES = [
  { value: '', label: '카테고리 선택' },
  { value: 'entertainment', label: '🎬 엔터테인먼트' },
  { value: 'food', label: '🍜 음식' },
  { value: 'sports', label: '⚽ 스포츠' },
  { value: 'fashion', label: '👗 패션' },
  { value: 'tech', label: '💻 기술' },
  { value: 'travel', label: '✈️ 여행' },
  { value: 'lifestyle', label: '🌿 라이프스타일' },
  { value: 'etc', label: '📦 기타' },
]

const DURATIONS = [
  { value: '24', label: '24시간' },
  { value: '48', label: '48시간' },
]

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

export function CreateMatchupDrawer({ onCreated }) {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { isCreateDrawerOpen, closeCreateDrawer, showToast } = useUIStore()

  // 폼 상태
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [leftContent, setLeftContent] = useState(null)
  const [leftName, setLeftName] = useState('')
  const [rightContent, setRightContent] = useState(null)
  const [rightName, setRightName] = useState('')
  const [tags, setTags] = useState([])
  const [tagInput, setTagInput] = useState('')
  const [category, setCategory] = useState('')
  const [duration, setDuration] = useState('24')
  const [showGuide, setShowGuide] = useState(false)

  // 업로드 상태
  const [uploading, setUploading] = useState(false)
  const [uploadStep, setUploadStep] = useState('')
  const [boxKey, setBoxKey] = useState(0)

  const reset = () => {
    setTitle(''); setDescription('')
    setLeftContent(null); setLeftName('')
    setRightContent(null); setRightName('')
    setTags([]); setTagInput('')
    setCategory(''); setDuration('24')
    setUploadStep(''); setBoxKey((k) => k + 1)
  }

  const handleClose = () => { if (uploading) return; reset(); closeCreateDrawer() }

  const isValid = title.trim().length > 0 && leftContent !== null && category

  // A 형식 변경
  const handleLeftChange = useCallback((newContent) => setLeftContent(newContent), [])

  // 태그
  const addTag = useCallback((val) => {
    const cleaned = val.replace(/[^가-힣a-zA-Z0-9]/g, '').slice(0, 15)
    if (!cleaned || tags.includes(cleaned) || tags.length >= MAX_TAGS) return
    setTags((p) => [...p, cleaned]); setTagInput('')
  }, [tags])

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addTag(tagInput) }
    else if (e.key === 'Backspace' && !tagInput && tags.length > 0) setTags((p) => p.slice(0, -1))
  }

  // 파일 업로드
  const uploadFile = async (file, side) => {
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    if (!isImage && !isVideo) throw new Error('이미지 또는 영상 파일만 업로드 가능해요')
    if (isImage && file.size > MAX_IMAGE_BYTES) throw new Error(`이미지는 ${MAX_IMAGE_MB}MB 이하`)
    if (isVideo && file.size > MAX_VIDEO_BYTES) throw new Error(`영상은 ${MAX_VIDEO_MB}MB 이하`)
    let toUpload = file
    if (isImage) { setUploadStep('이미지 압축 중...'); toUpload = await compressImage(file) }
    setUploadStep(`${side === 'left' ? 'A' : 'B'}측 파일 업로드 중...`)
    const ext = isImage ? 'jpg' : file.name.split('.').pop()
    const path = `matchups/${user.id}/${Date.now()}-${side}.${ext}`
    const { error } = await supabase.storage.from('matchup-media').upload(path, toUpload, { cacheControl: '3600' })
    if (error) {
      if (error.message?.toLowerCase().includes('policy') || String(error.statusCode) === '403')
        throw new Error('Storage 권한 오류. supabase_storage_policy.sql을 실행해주세요.')
      throw new Error(error.message)
    }
    const { data: { publicUrl } } = supabase.storage.from('matchup-media').getPublicUrl(path)
    return { url: publicUrl, thumbnail: isImage ? publicUrl : null }
  }

  const handleSubmit = async () => {
    if (!isValid || uploading) return
    setUploading(true)
    try {
      let leftUrl = null, leftThumb = null

      if (leftContent?.file) {
        const r = await uploadFile(leftContent.file, 'left')
        leftUrl = r.url; leftThumb = r.thumbnail
      }
      // NEW 매치업: 오른쪽은 비어 있음 (도전자 대기)
      setUploadStep('매치업 저장 중...')

      // 만료 시간 계산
      let expiresAt = null
      if (duration) {
        const d = new Date()
        d.setHours(d.getHours() + parseInt(duration))
        expiresAt = d.toISOString()
      }

      const { data: inserted, error } = await supabase.from('matchups').insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        left_type: leftContent.type,
        left_url: leftUrl,
        left_text: leftContent.text || null,
        left_thumbnail_url: leftThumb,
        left_label: leftName.trim() || 'A',
        right_type: null,
        right_url: null,
        right_text: null,
        right_thumbnail_url: null,
        right_label: null,
        tags: tags.length > 0 ? tags : null,
        category: category || null,
        expires_at: expiresAt,
        status: 'active',
      }).select('id').single()

      if (error) {
        if (error.code === '42501') throw new Error('로그인 상태를 확인해주세요.')
        if (error.code === '23503') throw new Error('프로필 없음. 새로고침 후 다시 시도해주세요.')
        throw new Error(error.message)
      }

      showToast('매치업이 생성됐어요! 🔥', 'success')
      reset(); closeCreateDrawer(); onCreated?.()
      if (inserted?.id) navigate(`/matchup/${inserted.id}`)
    } catch (err) {
      console.error('[CreateMatchup]', err)
      showToast(err.message || '생성 중 오류가 발생했어요.', 'error')
    } finally { setUploading(false); setUploadStep('') }
  }

  return (
    <Drawer
      isOpen={isCreateDrawerOpen}
      onClose={handleClose}
      title="🔥 NEW 매치업 만들기"
      className="w-full max-w-2xl"
    >
      <div className="flex flex-col lg:flex-row h-full">

        {/* ── 좌측: 폼 ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 min-w-0">

          {/* 1. 제목 */}
          <FormSection label="📌 대결 주제" required>
            <div className="relative">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 오늘 내 룩 어때? / 민초 갓벽 vs 극혐"
                maxLength={TITLE_MAX}
                disabled={uploading}
                className="w-full px-4 py-3 text-sm font-medium bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#22282E] transition-colors placeholder:text-gray-300 pr-16"
              />
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${title.length >= TITLE_MAX ? 'text-red-400' : 'text-gray-400'}`}>
                {title.length}/{TITLE_MAX}
              </span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="대결 설명을 추가해보세요 (선택)"
              rows={2}
              maxLength={200}
              disabled={uploading}
              className="w-full px-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#22282E] resize-none placeholder:text-gray-300"
            />
          </FormSection>

          {/* 2. 카테고리 + 기간 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#22282E]">카테고리</label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={uploading}
                  className="w-full appearance-none px-3 py-2.5 pr-8 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#22282E] transition-colors text-gray-600"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#22282E] flex items-center gap-1">
                <Clock size={12} /> 투표 기간
              </label>
              <div className="relative">
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  disabled={uploading}
                  className="w-full appearance-none px-3 py-2.5 pr-8 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#22282E] transition-colors text-gray-600"
                >
                  {DURATIONS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* 3. 대결 구도 */}
          <FormSection label="🥊 대결 구도" required>
            <div className="grid grid-cols-[1fr_36px_1fr] gap-2 items-stretch">
              {/* A측 */}
              <div className="space-y-2">
                <input
                  type="text"
                  value={leftName}
                  onChange={(e) => setLeftName(e.target.value)}
                  placeholder="A 닉네임"
                  maxLength={20}
                  disabled={uploading}
                  className="w-full px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#22282E] placeholder:text-gray-300"
                />
                <ContentBox
                  key={`left-${boxKey}`}
                  content={leftContent}
                  onChange={handleLeftChange}
                  disabled={uploading}
                  sideLabel="A"
                />
              </div>

              {/* VS */}
              <div className="flex items-center justify-center mt-8">
                <span className="text-base font-black text-gray-300 leading-none">VS</span>
              </div>

              {/* B측: 도전자 대기 (비어 있음) */}
              <div className="space-y-2">
                <div className="px-3 py-2 text-xs font-semibold text-gray-400 bg-gray-50 border border-dashed border-gray-200 rounded-lg">
                  B 닉네임
                </div>
                <div className="relative aspect-square rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-2">
                  <span className="text-[10px] font-bold text-gray-400">도전자 대기</span>
                  <span className="text-[9px] text-gray-300 text-center px-2">나중에 도전자가 채워요</span>
                  <span className="absolute top-2 left-2 z-10 text-[10px] font-black bg-gray-300/70 text-white px-1.5 py-0.5 rounded-md">B</span>
                </div>
              </div>
            </div>
            {!leftContent && (
              <p className="text-xs text-gray-400 text-center mt-1">
                A를 먼저 올려주세요
              </p>
            )}
            {!category && (
              <p className="text-xs text-amber-600 text-center mt-1">
                위에서 카테고리를 선택해주세요
              </p>
            )}
          </FormSection>

          {/* 4. 태그 */}
          <FormSection label="🏷️ 태그" hint={`최대 ${MAX_TAGS}개`}>
            <div className="flex flex-wrap items-center gap-2 min-h-[42px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus-within:border-[#22282E] transition-colors">
              {tags.map((t) => (
                <span key={t} className="flex items-center gap-1 text-xs font-semibold bg-[#22282E] text-white px-2.5 py-1 rounded-full">
                  <Hash size={9} />{t}
                  <button type="button" onClick={() => setTags((p) => p.filter((x) => x !== t))}>
                    <X size={9} className="hover:text-red-300" />
                  </button>
                </span>
              ))}
              {tags.length < MAX_TAGS && (
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value.replace(/\s/g, ''))}
                  onKeyDown={handleTagKeyDown}
                  onBlur={() => addTag(tagInput)}
                  placeholder={tags.length === 0 ? '#태그 입력 후 Enter' : '#태그 추가'}
                  maxLength={15}
                  disabled={uploading}
                  className="flex-1 min-w-[100px] text-xs bg-transparent outline-none placeholder:text-gray-300"
                />
              )}
            </div>
          </FormSection>

          {/* 5. 콘텐츠 가이드라인 (접기/펼치기) */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                <Info size={13} className="text-blue-400" />
                콘텐츠 업로드 가이드라인
              </div>
              <ChevronDown size={14} className={`text-gray-400 transition-transform ${showGuide ? 'rotate-180' : ''}`} />
            </button>
            {showGuide && (
              <div className="px-4 pb-4 space-y-2 text-xs text-gray-500 border-t border-gray-100">
                <ul className="mt-3 space-y-1.5 list-disc list-inside">
                  <li><strong>이미지:</strong> JPG, PNG, GIF — 최대 {MAX_IMAGE_MB}MB</li>
                  <li><strong>영상:</strong> MP4, MOV — 최대 {MAX_VIDEO_MB}MB</li>
                  <li>저작권 침해, 폭력적·선정적·비방 콘텐츠는 금지됩니다.</li>
                  <li>가이드라인 위반 시 예고 없이 삭제될 수 있습니다.</li>
                </ul>
              </div>
            )}
          </div>

          {/* 업로드 진행 상태 */}
          {uploading && uploadStep && (
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl">
              <span className="w-4 h-4 border-2 border-gray-300 border-t-[#22282E] rounded-full animate-spin shrink-0" />
              <span className="text-sm text-gray-600">{uploadStep}</span>
            </div>
          )}

          {/* 생성 버튼 */}
          <div className="flex gap-3 pb-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={uploading}
              className="px-5 py-3.5 text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-2xl transition-colors disabled:opacity-40"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isValid || uploading}
              className={cn(
                'flex-1 py-3.5 rounded-2xl text-sm font-black tracking-wide transition-all duration-300',
                isValid && !uploading
                  ? 'bg-[#22282E] text-white shadow-[0_0_20px_rgba(34,40,46,0.35)] hover:shadow-[0_0_32px_rgba(34,40,46,0.55)] hover:scale-[1.01] active:scale-[0.99]'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              )}
            >
              {uploading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  처리 중...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  {isValid && '🔥'} NEW 매치업 만들기
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── 우측: 실시간 피드 미리보기 (lg 이상) ── */}
        <div className="hidden lg:flex flex-col w-72 border-l border-gray-100 bg-gray-50/50 shrink-0">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs font-bold text-[#22282E]">피드 미리보기</p>
            <p className="text-[10px] text-gray-400 mt-0.5">입력하는 대로 실시간 반영</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <LivePreview
              title={title}
              description={description}
              leftContent={leftContent}
              leftName={leftName || 'A'}
              rightContent={rightContent}
              rightName={rightName || 'B'}
              tags={tags}
              category={category}
              profile={profile}
            />
          </div>
        </div>

      </div>
    </Drawer>
  )
}

// ── FormSection ───────────────────────────────────────────────────
function FormSection({ label, required, hint, children }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-[#22282E]">{label}</span>
        {required && <span className="text-red-400 text-xs">*</span>}
        {hint && <span className="text-xs text-gray-400 ml-auto">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

// ── ContentBox (A/B 공용) ─────────────────────────────────────────
function ContentBox({ content, onChange, disabled, sideLabel, optional, requiredType, requiredCategory }) {
  const fileRef = useRef(null)
  const [contentType, setContentType] = useState('image')
  const effectiveType = requiredType ?? contentType
  const [dragging, setDragging] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [sizeError, setSizeError] = useState('')

  const TYPES = [
    { id: 'image', icon: Image },
    { id: 'video', icon: Video },
    { id: 'text', icon: Type },
  ]

  const validateAndSet = (file) => {
    if (!file) return; setSizeError('')
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    if (!isImage && !isVideo) { setSizeError('이미지 또는 영상만 가능해요'); return }
    if (effectiveType === 'image' && !isImage) { setSizeError('A가 이미지를 올렸어요. 이미지만 올려주세요'); return }
    if (effectiveType === 'video' && !isVideo) { setSizeError('A가 영상을 올렸어요. 영상만 올려주세요'); return }
    if (isImage && file.size > MAX_IMAGE_BYTES) { setSizeError(`이미지 최대 ${MAX_IMAGE_MB}MB`); return }
    if (isVideo && file.size > MAX_VIDEO_BYTES) { setSizeError(`영상 최대 ${MAX_VIDEO_MB}MB`); return }
    const preview = URL.createObjectURL(file)
    const base = { type: isVideo ? 'video' : 'image', file, preview }
    onChange(requiredCategory ? { ...base, category: requiredCategory } : base)
  }

  const handleRemove = (e) => {
    e?.stopPropagation(); onChange(null); setSizeError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const switchType = (t) => {
    if (requiredType) return
    setContentType(t); setSizeError('')
    onChange(null); setTextInput('')
  }

  return (
    <div className="space-y-1.5">
      {/* 타입 버튼 (requiredType이 있으면 숨김) */}
      {!requiredType && (
      <div className="flex gap-0.5">
        {TYPES.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => switchType(id)}
            disabled={disabled}
            className={cn(
              'flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-lg transition-colors',
              contentType === id ? 'bg-[#22282E] text-white' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
              disabled && 'opacity-40 cursor-not-allowed'
            )}
          >
            <Icon size={10} />
            {id === 'image' ? '이미지' : id === 'video' ? '영상' : '텍스트'}
          </button>
        ))}
      </div>
      )}
      {requiredType && (
        <p className="text-[10px] font-semibold text-gray-500">
          {effectiveType === 'image' ? '이미지' : effectiveType === 'video' ? '영상' : '텍스트'}로 올려주세요
        </p>
      )}

      {/* 텍스트 */}
      {effectiveType === 'text' ? (
        <div className="space-y-2">
          <textarea
            value={textInput}
            onChange={(e) => {
              setTextInput(e.target.value)
              const base = e.target.value.trim() ? { type: 'text', text: e.target.value.trim() } : null
              onChange(base ? (requiredCategory ? { ...base, category: requiredCategory } : base) : null)
            }}
            placeholder="내 의견을 입력하세요"
            rows={5}
            maxLength={200}
            disabled={disabled}
            className="w-full px-3 py-3 text-xs bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#22282E] resize-none text-center disabled:opacity-60"
          />
        </div>
      ) : (
        /* 드롭박스 */
        <div
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (!disabled) validateAndSet(e.dataTransfer.files?.[0]) }}
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onClick={() => { if (!content && !disabled) fileRef.current?.click() }}
          className={cn(
            'relative aspect-square rounded-xl border-2 border-dashed overflow-hidden transition-all',
            disabled ? 'opacity-60 cursor-not-allowed' :
            dragging ? 'border-[#22282E] bg-gray-100 scale-[1.02] cursor-copy' :
            content ? 'border-[#22282E] cursor-default' :
            'border-gray-200 bg-gray-50 hover:border-gray-400 hover:bg-gray-100 cursor-pointer active:scale-[0.98]'
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
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent p-2">
                <div className="flex items-center gap-1">
                  <CheckCircle size={10} className="text-green-400" />
                  <span className="text-white text-[9px] font-semibold">미리보기 중</span>
                </div>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400">
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                <Upload size={16} className="text-gray-400" />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-gray-500">클릭 또는 드롭</p>
                {optional && <p className="text-[10px] text-gray-300 mt-0.5">선택 사항</p>}
              </div>
            </div>
          )}
          {/* 사이드 레이블 */}
          <span className="absolute top-2 left-2 z-10 text-[10px] font-black bg-[#22282E]/70 text-white px-1.5 py-0.5 rounded-md">
            {sideLabel}
          </span>
        </div>
      )}

      {/* B: 선택된 카테고리 표시 */}
      {content && requiredCategory && (
        <p className="text-[10px] font-semibold text-gray-500">
          카테고리: {CATEGORIES.find((c) => c.value === requiredCategory)?.label || requiredCategory}
        </p>
      )}

      {sizeError && (
        <div className="flex items-center gap-1 text-[10px] text-red-500">
          <AlertCircle size={10} />{sizeError}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={effectiveType === 'image' ? 'image/*' : 'video/*'}
        className="hidden"
        onChange={(e) => validateAndSet(e.target.files?.[0])}
      />
    </div>
  )
}

// ── 실시간 피드 미리보기 ──────────────────────────────────────────
function LivePreview({ title, description, leftContent, leftName, rightContent, rightName, tags, category, profile }) {
  const catLabel = CATEGORIES.find((c) => c.value === category)?.label || ''

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden text-left">
      {/* 헤더 */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 overflow-hidden shrink-0">
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              : (profile?.nickname?.[0] || '?')
            }
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#22282E] truncate">{profile?.nickname || '사용자'}</p>
            {catLabel && <p className="text-[9px] text-gray-400">{catLabel}</p>}
          </div>
        </div>
        <p className="text-xs font-bold text-[#22282E] line-clamp-2 leading-snug">
          {title || '대결 제목이 여기 표시됩니다'}
        </p>
        {description && (
          <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{description}</p>
        )}
      </div>

      {/* 썸네일 */}
      <div className="grid grid-cols-[1fr_24px_1fr] gap-1 px-2 mb-1.5">
        <PreviewThumb content={leftContent} name={leftName} />
        <div className="flex items-center justify-center">
          <span className="text-[10px] font-black text-gray-300">VS</span>
        </div>
        {rightContent ? (
          <PreviewThumb content={rightContent} name={rightName} />
        ) : (
          <div className="aspect-square rounded-lg bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center">
            <span className="text-[8px] text-gray-300 font-medium text-center px-1">도전자<br/>대기</span>
          </div>
        )}
      </div>

      {/* 투표율 바 (더미) */}
      <div className="px-3 mb-2">
        <div className="h-1 bg-gray-100 rounded-full overflow-hidden flex">
          <div className="w-1/2 bg-[#22282E] h-full rounded-l-full" />
          <div className="w-1/2 bg-gray-200 h-full rounded-r-full" />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[9px] text-gray-400">{leftName} 50%</span>
          <span className="text-[9px] text-gray-400">50% {rightName}</span>
        </div>
      </div>

      {/* 태그 */}
      {tags.length > 0 && (
        <div className="px-3 mb-2 flex flex-wrap gap-1">
          {tags.map((t) => (
            <span key={t} className="text-[9px] font-semibold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* 액션 바 */}
      <div className="px-3 pb-3 flex items-center border-t border-gray-50 pt-2 gap-3">
        <div className="flex items-center gap-0.5 text-[10px] text-gray-400">
          <Heart size={10} /> <span>0</span>
        </div>
        <div className="flex items-center gap-0.5 text-[10px] text-gray-400">
          <MessageCircle size={10} /> <span>0</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-0.5 text-[10px] text-gray-400">
          <Users size={10} /> <span>0명 참여</span>
        </div>
        <Share2 size={10} className="text-gray-300" />
      </div>
    </div>
  )
}

function PreviewThumb({ content, name }) {
  return (
    <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
      {content?.type === 'image' && content.preview && (
        <img src={content.preview} alt="" className="w-full h-full object-cover" />
      )}
      {content?.type === 'video' && content.preview && (
        <video src={content.preview} className="w-full h-full object-cover" muted />
      )}
      {content?.type === 'text' && (
        <div className="w-full h-full flex items-center justify-center p-1 bg-gray-50">
          <p className="text-[8px] text-center text-gray-500 line-clamp-3">{content.text}</p>
        </div>
      )}
      {!content && (
        <div className="w-full h-full flex items-center justify-center">
          <Upload size={12} className="text-gray-300" />
        </div>
      )}
      {name && (
        <span className="absolute bottom-1 left-1 text-[8px] font-black bg-[#22282E]/70 text-white px-1 py-0.5 rounded">
          {name}
        </span>
      )}
    </div>
  )
}
