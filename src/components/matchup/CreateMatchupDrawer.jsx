import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, X, Image, Video, Type, Camera, AlertCircle, AlertTriangle, CheckCircle, Hash, Info,
         ChevronDown, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { Drawer } from '../ui/Drawer'
import { Modal } from '../ui/Modal'
import { VsBadge } from '../ui/VsBadge'
import { cn } from '../../lib/utils'
import { safeMediaUrl } from '../../lib/sanitize'
import { compressAndCropImage } from '../../lib/mediaCrop'
import {
  saveCreateMatchupDraft,
  loadCreateMatchupDraft,
  clearCreateMatchupDraft,
  hasCreateMatchupDraft,
} from '../../lib/draftStorage'
import {
  MAX_IMAGE_MB,
  MAX_VIDEO_MB,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  IMAGE_RECOMMENDED,
  VIDEO_RECOMMENDED,
  validateVideo,
} from '../../lib/mediaSpec'
import {
  MATCHUP_IMAGE_INPUT_ACCEPT,
  MATCHUP_VIDEO_INPUT_ACCEPT,
  validateSelectableRasterImageUpload,
  validatePipelineJpegOutput,
  validateMatchupVideoUpload,
} from '../../lib/uploadMediaValidation'
import { captureVideoPosterJpegFile } from '../../lib/videoPoster'
import { cameraPhotoToFile } from '../../lib/cameraPhotoToFile'
import { getClipboardMediaFiles } from '../../lib/clipboardPasteFiles'
import { uploadMatchupMediaValidated } from '../../lib/matchupMediaBucketUpload'
import { mediaFileMatchesMatchupSideType } from '../../lib/matchupSideType'
import { SmartphoneCameraCapture } from '../mobile/SmartphoneCameraCapture'
import { getMatchupCategories } from '../../lib/categoryAdminStorage'
const MAX_TAGS = 3
const TITLE_MAX = 60

function clampMatchupTags(arr) {
  if (!Array.isArray(arr)) return []
  return arr.slice(0, MAX_TAGS)
}

/** 한글은 NFD(자모 분해)로 들어올 수 있어 NFC로 맞춘 뒤 필터 (완성형 가-힣·영숫자만) */
function sanitizeTagToken(s) {
  return String(s)
    .normalize('NFC')
    .replace(/[^가-힣a-zA-Z0-9]/g, '')
    .slice(0, 15)
}

/** MZ 톤 입력 공통 + 플레이스홀더 (세대별 컬러) */
const MZ_IN =
  'border rounded-xl outline-none transition-all text-violet-950/90 disabled:opacity-60'
const MZ_TITLE =
  `${MZ_IN} w-full px-4 py-3 text-sm font-medium bg-gradient-to-br from-fuchsia-50/95 via-white to-violet-50/70 border-fuchsia-200/55 focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-400/30 placeholder:text-fuchsia-500/75`
const MZ_DESC =
  `${MZ_IN} w-full px-4 py-3 text-sm bg-gradient-to-br from-violet-50/95 via-white to-cyan-50/40 border-violet-200/50 focus:border-violet-500 focus:ring-2 focus:ring-violet-400/25 resize-none placeholder:text-violet-400/80`
const MZ_SELECT =
  `${MZ_IN} w-full appearance-none px-3 py-2.5 pr-8 text-sm bg-gradient-to-br from-sky-50/90 to-indigo-50/50 border-sky-200/50 focus:border-sky-500 focus:ring-2 focus:ring-sky-400/25 text-violet-900/80`
/** 카테고리·투표기간·A/B 닉네임 줄 — 동일 높이 */
const CTRL_ROW_H = 'h-10 min-h-[2.5rem] box-border'
const MZ_SELECT_ROW = `${MZ_SELECT} ${CTRL_ROW_H} py-0 leading-normal`
const MZ_NICK =
  `${MZ_IN} w-full px-3 text-xs font-semibold bg-gradient-to-br from-sky-50/95 to-cyan-50/50 border-sky-200/50 focus:border-sky-500 focus:ring-2 focus:ring-sky-300/30 placeholder:text-sky-500/75`
const MZ_NICK_ROW = `${MZ_NICK} ${CTRL_ROW_H} flex items-center py-0 leading-normal`
const MZ_TAG_WRAP =
  'flex flex-wrap items-center gap-2 min-h-[42px] px-3 py-2 bg-gradient-to-br from-purple-50/90 via-violet-50/70 to-fuchsia-50/50 border border-purple-200/50 rounded-xl focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-300/25 transition-colors'
const MZ_TAG_IN =
  'flex-1 min-w-[100px] text-xs bg-transparent outline-none placeholder:text-purple-400/85 text-violet-900'
/** 경쟁 미디어 카드 — A/B 동일 aspect-square */
const FEED_CARD_FRAME = 'relative w-full aspect-square overflow-hidden rounded-xl'
/** ContentBox 타입 줄 — B측 플레이스홀더와 동일 높이·정렬 */
const CONTENT_TYPE_ROW = 'flex h-9 shrink-0 items-center gap-0.5'

/** 앱 캐시/다른 origin 시 폴백용 (관리자 카테고리와 동일) */
const MATCHUP_CATEGORIES_FALLBACK = [
  { value: '', label: '카테고리 선택' },
  { value: 'eternal_quest', label: '영원한 난제' },
  { value: 'romance', label: '연애' },
  { value: 'relationships', label: '인간관계' },
  { value: 'work_life', label: '직장&갓생' },
  { value: 'balance_game', label: '밸런스게임' },
  { value: 'food_gourmet', label: '맛집&맛식' },
  { value: 'fashion', label: '패션' },
]

const DURATIONS = [
  { value: '24', label: '24시간' },
  { value: '48', label: '48시간' },
]

function durationFromCreatedAndExpires(created_at, expires_at) {
  if (!expires_at || !created_at) return '24'
  const h = Math.round((new Date(expires_at) - new Date(created_at)) / 3600000)
  return h >= 48 ? '48' : '24'
}

/** 투표 마감: 신규는 생성 시각 기준, 수정은 매치업 created_at 기준(폼의 24/48h와 일치) */
function computeExpiresAtIso({ durationHoursStr, matchupCreatedAt, isEdit }) {
  const hours = parseInt(durationHoursStr, 10)
  if (!Number.isFinite(hours) || hours <= 0) return null
  if (isEdit && matchupCreatedAt) {
    const start = new Date(matchupCreatedAt)
    if (!Number.isNaN(start.getTime())) {
      return new Date(start.getTime() + hours * 3600000).toISOString()
    }
  }
  const d = new Date()
  d.setHours(d.getHours() + hours)
  return d.toISOString()
}

/** A측 폼 값 ↔ DB 스냅샷 동일 여부 (수정 모드 dirty 판별) */
function authorSideContentEquals(cur, snap) {
  if (cur == null && snap == null) return true
  if (cur == null || snap == null) return false
  if (cur.type !== snap.type) return false
  if (cur.type === 'text') {
    return (cur.text || '').trim() === (snap.text || '').trim()
  }
  if (cur.file) return false
  if (!cur.fromExisting) return false
  return (
    (cur.persistUrl || '') === (snap.persistUrl || '') &&
    String(cur.persistThumb ?? cur.persistUrl ?? '') === String(snap.persistThumb ?? snap.persistUrl ?? '')
  )
}

function tagsArrayEqual(a, b) {
  const ta = clampMatchupTags(a || [])
  const tb = clampMatchupTags(b || [])
  if (ta.length !== tb.length) return false
  return ta.every((v, i) => v === tb[i])
}

/** 작성자 수정 폼의 “불러온 직후” 기준선 */
function getAuthorEditSnapshot(m, profile) {
  const author = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
  const authorNick = (author?.nickname || profile?.nickname || '').trim()
  const storedLabel = typeof m.left_label === 'string' ? m.left_label.trim() : ''
  const leftName = storedLabel || authorNick || 'A'
  let leftContentSnap = null
  if (m.left_type === 'text') {
    leftContentSnap = { type: 'text', text: m.left_text || '' }
  } else if (m.left_type === 'image' || m.left_type === 'video') {
    leftContentSnap = {
      type: m.left_type,
      preview: m.left_thumbnail_url || m.left_url,
      fromExisting: true,
      persistUrl: m.left_url,
      persistThumb: m.left_thumbnail_url || m.left_url,
    }
  }
  return {
    title: (m.title || '').trim(),
    description: (m.description || '').trim(),
    leftName: leftName.trim(),
    tags: clampMatchupTags(Array.isArray(m.tags) ? m.tags : []),
    category: m.category || '',
    duration: durationFromCreatedAndExpires(m.created_at, m.expires_at),
    leftContent: leftContentSnap,
  }
}

export function CreateMatchupDrawer({ onCreated }) {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { isCreateDrawerOpen, closeCreateDrawer, showToast, createDrawerEditMatchup } = useUIStore()
  const isEditMode = Boolean(createDrawerEditMatchup?.id)

  // 폼 상태
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [leftContent, setLeftContent] = useState(null)
  const [tags, setTags] = useState([])
  // A쪽 닉네임은 항상 로그인 유저 닉네임으로 자동 표시 (직접 입력 불필요)
  const myNickname = profile?.nickname || 'A'
  const [tagInput, setTagInput] = useState('')
  const [category, setCategory] = useState('')
  const [duration, setDuration] = useState('24')
  const [showGuide, setShowGuide] = useState(false)

  const CATEGORIES = useMemo(() => {
    try {
      const list = getMatchupCategories()
      const legacyIds = ['ootd', 'tanghulu', 'idol']
      const hasLegacy = list?.slice(1).every((c) => legacyIds.includes(c.value))
      if (list?.length > 1 && !hasLegacy) return list
    } catch {}
    return MATCHUP_CATEGORIES_FALLBACK
  }, [isCreateDrawerOpen, createDrawerEditMatchup?.id])

  // 작성자(A) 수정: 서버 행으로 폼 채우기
  useEffect(() => {
    if (!isCreateDrawerOpen || !createDrawerEditMatchup?.id) {
      authorEditBaselineRef.current = null
      lastAuthorEditHydratedIdRef.current = null
      return
    }
    const m = createDrawerEditMatchup
    setTitle(m.title || '')
    setDescription(m.description || '')
    setTags(clampMatchupTags(Array.isArray(m.tags) ? m.tags : []))
    setCategory(m.category || '')
    setDuration(durationFromCreatedAndExpires(m.created_at, m.expires_at))
    if (m.left_type === 'text') {
      setLeftContent({ type: 'text', text: m.left_text || '' })
    } else if (m.left_type === 'image' || m.left_type === 'video') {
      const preview = m.left_thumbnail_url || m.left_url
      setLeftContent({
        type: m.left_type,
        preview,
        fromExisting: true,
        persistUrl: m.left_url,
        persistThumb: m.left_thumbnail_url || m.left_url,
      })
    } else {
      setLeftContent(null)
    }
    setBoxKey((k) => k + 1)
    setShowRestorePrompt(false)

    if (lastAuthorEditHydratedIdRef.current !== m.id) {
      lastAuthorEditHydratedIdRef.current = m.id
      authorEditBaselineRef.current = getAuthorEditSnapshot(m, profile)
      setAuthorEditDirtyEpoch((e) => e + 1)
    }
    // profile는 클로저로만 사용 — deps에 넣으면 프로필 갱신 때마다 폼이 통째로 리셋됨
  }, [isCreateDrawerOpen, createDrawerEditMatchup])

  // 업로드 상태
  const [uploading, setUploading] = useState(false)
  const [uploadStep, setUploadStep] = useState('')
  const [boxKey, setBoxKey] = useState(0)
  const [showRestorePrompt, setShowRestorePrompt] = useState(false)
  const [showSubmitWarning, setShowSubmitWarning] = useState(false)
  const saveTimeoutRef = useRef(null)
  /** 수정 모드: 처음 불러온 직후 스냅샷 (dirty 비교). id당 1회만 갱신 */
  const authorEditBaselineRef = useRef(null)
  const lastAuthorEditHydratedIdRef = useRef(null)
  const [authorEditDirtyEpoch, setAuthorEditDirtyEpoch] = useState(0)

  const reset = () => {
    setTitle(''); setDescription('')
    setLeftContent(null)
    setTags([]); setTagInput('')
    setCategory(''); setDuration('24')
    setUploadStep(''); setBoxKey((k) => k + 1)
    setShowRestorePrompt(false)
    setShowSubmitWarning(false)
    authorEditBaselineRef.current = null
    lastAuthorEditHydratedIdRef.current = null
  }

  const handleClose = () => {
    if (uploading) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    reset()
    closeCreateDrawer()
  }

  const handleRestoreDraft = useCallback(async () => {
    if (!user?.id) return
    const draft = await loadCreateMatchupDraft(user.id)
    if (!draft) return
    setTitle(draft.title)
    setDescription(draft.description)
    setCategory(draft.category)
    setDuration(draft.duration)
    setTags(clampMatchupTags(draft.tags))
    setLeftContent(draft.leftContent)
    setBoxKey((k) => k + 1)
    setShowRestorePrompt(false)
    showToast(draft.hasRestoredFile ? '임시 저장된 내용을 복원했어요' : '임시 저장된 내용을 복원했어요 (이미지/영상은 다시 선택해주세요)', 'success')
  }, [user?.id, showToast])

  const handleDiscardDraft = useCallback(() => {
    if (user?.id) clearCreateMatchupDraft(user.id)
    setShowRestorePrompt(false)
  }, [user?.id])

  // 임시 저장 복원 (드로어 열릴 때 — 수정 모드에서는 생략)
  useEffect(() => {
    if (!isCreateDrawerOpen || !user?.id) return
    if (createDrawerEditMatchup?.id) return
    if (hasCreateMatchupDraft(user.id)) setShowRestorePrompt(true)
  }, [isCreateDrawerOpen, user?.id, createDrawerEditMatchup?.id])

  // 임시 저장 (디바운스 800ms)
  useEffect(() => {
    if (!isCreateDrawerOpen || !user?.id || uploading || createDrawerEditMatchup?.id) return
    const hasContent = title.trim() || description.trim() || leftContent || tags.length > 0 || category
    if (!hasContent) return

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      saveCreateMatchupDraft(
        { title, description, leftContent, tags: clampMatchupTags(tags), category, duration },
        user.id
      )
      saveTimeoutRef.current = null
    }, 800)
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [isCreateDrawerOpen, user?.id, uploading, title, description, leftContent, tags, category, duration, createDrawerEditMatchup?.id])

  // beforeunload + offline 시 즉시 저장
  useEffect(() => {
    if (!isCreateDrawerOpen || !user?.id || createDrawerEditMatchup?.id) return
    const hasContent = title.trim() || description.trim() || leftContent || tags.length > 0 || category
    const handler = (e) => { if (hasContent && !uploading) e.preventDefault() }
    const onOffline = () => {
      if (hasContent && !uploading) {
        saveCreateMatchupDraft({ title, description, leftContent, tags: clampMatchupTags(tags), category, duration }, user.id)
      }
    }
    if (hasContent && !uploading) {
      window.addEventListener('beforeunload', handler)
      window.addEventListener('offline', onOffline)
      return () => {
        window.removeEventListener('beforeunload', handler)
        window.removeEventListener('offline', onOffline)
      }
    }
    return () => {}
  }, [isCreateDrawerOpen, user?.id, title, description, leftContent, tags, category, duration, uploading, createDrawerEditMatchup?.id])

  const isValid = title.trim().length > 0 && leftContent !== null && category

  const hasAuthorEditChanges = useMemo(() => {
    if (!isEditMode || !createDrawerEditMatchup?.id) return true
    const snap = authorEditBaselineRef.current
    if (!snap) return true
    if ((title || '').trim() !== snap.title) return true
    if ((description || '').trim() !== snap.description) return true
    if (!tagsArrayEqual(tags, snap.tags)) return true
    if ((category || '') !== snap.category) return true
    if (duration !== snap.duration) return true
    if (!authorSideContentEquals(leftContent, snap.leftContent)) return true
    return false
  }, [
    isEditMode,
    createDrawerEditMatchup?.id,
    authorEditDirtyEpoch,
    title,
    description,
    tags,
    category,
    duration,
    leftContent,
  ])

  const canSubmit = isValid && (!isEditMode || hasAuthorEditChanges)

  // A 형식 변경
  const handleLeftChange = useCallback((newContent) => setLeftContent(newContent), [])

  // 태그
  /** 쉼표·세미콜론 붙여넣기 시 여러 개로 나누되, 항상 MAX_TAGS개까지만 반영 */
  const addTag = useCallback((rawInput) => {
    const raw = String(rawInput ?? '').trim()
    if (!raw) {
      setTagInput('')
      return
    }

    const pieces = raw.split(/[,，;]+/).map((s) => s.trim()).filter(Boolean)
    const fromPieces = pieces.map((p) => sanitizeTagToken(p)).filter(Boolean)
    const tokens =
      fromPieces.length > 0
        ? fromPieces
        : [sanitizeTagToken(raw)].filter(Boolean)

    if (tokens.length === 0) {
      setTagInput('')
      return
    }

    setTags((p) => {
      let next = [...p]
      for (const cleaned of tokens) {
        if (next.length >= MAX_TAGS) break
        if (!next.includes(cleaned)) next = [...next, cleaned]
      }
      return next
    })
    setTagInput('')
  }, [])

  // 어떤 경로로든 태그가 MAX를 넘으면 즉시 잘라냄 (렌더 전 동기화)
  useLayoutEffect(() => {
    if (tags.length > MAX_TAGS) setTags((t) => clampMatchupTags(t))
  }, [tags])

  const handleTagKeyDown = (e) => {
    const v = e.currentTarget.value
    // 한글 IME: Enter가 조합 확정용일 때는 가로채지 않음 (그렇지 않으면 태그 추가가 안 되거나 입력이 깨짐)
    if (e.isComposing || e.nativeEvent?.isComposing || e.key === 'Process') return
    if (e.key === 'Enter' || e.key === 'NumpadEnter' || e.key === ' ') {
      e.preventDefault()
      addTag(v)
    } else if (e.key === 'Backspace' && !v) setTags((p) => (p.length > 0 ? p.slice(0, -1) : p))
  }

  // 파일 업로드
  const uploadFile = async (file, side, { imageAlreadyCropped = false } = {}) => {
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    if (!isImage && !isVideo) throw new Error('이미지 또는 영상 파일만 업로드 가능해요')
    if (isImage && file.size > MAX_IMAGE_BYTES) throw new Error(`이미지는 ${MAX_IMAGE_MB}MB 이하`)
    if (isVideo && file.size > MAX_VIDEO_BYTES) throw new Error(`영상은 ${MAX_VIDEO_MB}MB 이하`)

    let toUpload = file
    if (isVideo) {
      const sniff = await validateMatchupVideoUpload(file)
      if (!sniff.ok) throw new Error(sniff.message)
      const v = await validateVideo(file)
      if (!v.valid) throw new Error(v.error)
    }

    if (isImage) {
      if (!imageAlreadyCropped) {
        const sniffSel = await validateSelectableRasterImageUpload(file)
        if (!sniffSel.ok) throw new Error(sniffSel.message)
        setUploadStep('이미지 1:1 크롭 중...')
        toUpload = await compressAndCropImage(file)
      }
      const outChk = await validatePipelineJpegOutput(toUpload)
      if (!outChk.ok) throw new Error(outChk.message)
    }
    const ts = Date.now()
    const ext = isImage ? 'jpg' : file.name.split('.').pop()?.toLowerCase() || 'mp4'
    const basePath = `matchups/${user.id}/${ts}-${side}`

    if (isVideo) {
      setUploadStep('영상 썸네일 만드는 중...')
      const posterFile = await captureVideoPosterJpegFile(file)
      setUploadStep(`${side === 'left' ? 'A' : 'B'}측 영상 업로드 중...`)
      const videoPath = `${basePath}.${ext}`
      const { error: vErr, publicUrl: videoUrl } = await uploadMatchupMediaValidated(supabase, {
        objectPath: videoPath,
        body: toUpload,
        fileKind: 'video',
        cacheControl: '3600',
        contentType: toUpload.type || undefined,
      })
      if (vErr) {
        const m = vErr.message || ''
        if (m.toLowerCase().includes('policy') || String(vErr.statusCode) === '403')
          throw new Error('Storage 권한 오류. supabase_storage_policy.sql을 실행해주세요.')
        throw new Error(m || '업로드 실패')
      }
      if (!videoUrl) throw new Error('영상 업로드 주소를 확인하지 못했어요. 다시 시도해 주세요.')
      const posterPath = `${basePath}-poster.jpg`
      const { error: pErr, publicUrl: thumbUrl } = await uploadMatchupMediaValidated(supabase, {
        objectPath: posterPath,
        body: posterFile,
        fileKind: 'image',
        upsert: true,
        cacheControl: '3600',
        contentType: posterFile.type || 'image/jpeg',
      })
      if (pErr) {
        console.warn('[CreateMatchup] poster upload failed', pErr)
        return { url: videoUrl, thumbnail: null }
      }
      return { url: videoUrl, thumbnail: thumbUrl }
    }

    setUploadStep(`${side === 'left' ? 'A' : 'B'}측 파일 업로드 중...`)
    const path = `${basePath}.${ext}`
    const { error, publicUrl } = await uploadMatchupMediaValidated(supabase, {
      objectPath: path,
      body: toUpload,
      fileKind: 'image',
      cacheControl: '3600',
      contentType: toUpload.type || 'image/jpeg',
    })
    if (error) {
      const m = error.message || ''
      if (m.toLowerCase().includes('policy') || String(error.statusCode) === '403')
        throw new Error('Storage 권한 오류. supabase_storage_policy.sql을 실행해주세요.')
      throw new Error(m || '업로드 실패')
    }
    if (!publicUrl) throw new Error('업로드 주소를 확인하지 못했어요. 다시 시도해 주세요.')
    return { url: publicUrl, thumbnail: publicUrl }
  }

  const handleSubmitClick = () => {
    if (!canSubmit || uploading) return
    setShowSubmitWarning(true)
  }

  const handleConfirmSubmit = () => {
    setShowSubmitWarning(false)
    handleSubmit()
  }

  const handleSubmit = async () => {
    if (!canSubmit || uploading) return
    setShowSubmitWarning(false)
    setUploading(true)
    try {
      let leftUrl = null
      let leftThumb = null

      if (leftContent?.file) {
        const r = await uploadFile(leftContent.file, 'left', {
          imageAlreadyCropped: leftContent.type === 'image' && leftContent.imagePrepared === true,
        })
        leftUrl = r.url
        leftThumb = r.thumbnail
      } else if (leftContent?.fromExisting && (leftContent.type === 'image' || leftContent.type === 'video')) {
        leftUrl = leftContent.persistUrl
        leftThumb = leftContent.persistThumb ?? leftContent.persistUrl
      }

      if (leftContent?.type !== 'text' && !leftUrl) {
        throw new Error('A 측(작성자) 이미지·영상을 선택해주세요')
      }

      const safeTags = clampMatchupTags(tags)
      const editRow = createDrawerEditMatchup
      const expiresAt = duration
        ? computeExpiresAtIso({
            durationHoursStr: duration,
            matchupCreatedAt: editRow?.created_at,
            isEdit: Boolean(editRow?.id),
          })
        : null

      if (editRow?.id) {
        if (editRow.right_type != null || (editRow.total_votes || 0) > 0) {
          showToast('매치업이 완료된 뒤에는 수정할 수 없어요.', 'info')
          return
        }
        setUploadStep('매치업 수정 중...')
        const patch = {
          title: title.trim(),
          description: description.trim() || null,
          left_type: leftContent.type,
          left_url: leftContent.type === 'text' ? null : leftUrl,
          left_text: leftContent.type === 'text' ? (leftContent.text || '').trim() || null : null,
          left_thumbnail_url: leftContent.type === 'text' ? null : leftThumb,
          left_label: myNickname,
          tags: safeTags.length > 0 ? safeTags : null,
          category: category || null,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        }
        const { error } = await supabase.from('matchups').update(patch).eq('id', editRow.id).eq('user_id', user.id)
        if (error) {
          if (error.code === '42501') throw new Error('작성자만 A 쪽을 수정할 수 있어요.')
          throw new Error(error.message || '수정 중 오류가 발생했어요.')
        }
        showToast('작성자(A) 쪽 수정이 저장됐어요. 상세 페이지에서 바로 확인할 수 있어요.', 'success')
        clearCreateMatchupDraft(user.id)
        reset()
        closeCreateDrawer()
        onCreated?.()
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('vics:matchup:updated', { detail: { matchupId: editRow.id } }),
          )
        }
        navigate(`/matchup/${editRow.id}`)
        return
      }

      setUploadStep('매치업 저장 중...')

      const { data: inserted, error } = await supabase.from('matchups').insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        left_type: leftContent.type,
        left_url: leftUrl,
        left_text: leftContent.text || null,
        left_thumbnail_url: leftThumb,
        left_label: myNickname,
        right_type: null,
        right_url: null,
        right_text: null,
        right_thumbnail_url: null,
        right_label: null,
        tags: safeTags.length > 0 ? safeTags : null,
        category: category || null,
        expires_at: expiresAt,
        status: 'active',
      }).select('id').single()

      if (error) {
        if (error.code === '42501') throw new Error('로그인 상태를 확인해주세요.')
        if (error.code === '23503') throw new Error('프로필 없음. 새로고침 후 다시 시도해주세요.')
        throw new Error(error.message || '생성 중 오류가 발생했어요.')
      }

      showToast('매치업이 생성됐어요! 종료 후 승·패·무에 따라 포인트가 지급돼요', 'success')
      clearCreateMatchupDraft(user.id)
      reset()
      closeCreateDrawer()
      onCreated?.()
      if (inserted?.id) navigate(`/matchup/${inserted.id}`)
    } catch (err) {
      console.error('[CreateMatchup]', err)
      showToast(err.message || '저장 중 오류가 발생했어요.', 'error')
    } finally {
      setUploading(false)
      setUploadStep('')
    }
  }

  return (
    <>
    <Drawer
      isOpen={isCreateDrawerOpen}
      onClose={handleClose}
      title={isEditMode ? '✏️ 작성자(A) 쪽 수정' : '🔥 NEW 매치업 만들기'}
      className="max-w-[min(64rem,calc(100vw-1.5rem))]"
    >
      <div className="flex h-full min-w-0 flex-col overflow-x-hidden">

        {/* ── 폼 ── */}
        <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-5">

          {/* 임시 저장 복원 안내 */}
          {showRestorePrompt && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm font-semibold text-amber-800">임시 저장된 내용이 있어요</p>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  className="px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
                >
                  버리기
                </button>
                <button
                  type="button"
                  onClick={handleRestoreDraft}
                  className="px-3 py-1.5 text-xs font-bold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                >
                  복원하기
                </button>
              </div>
            </div>
          )}

          {/* 1. 제목 */}
          <FormSection label="📌 경쟁 제목" required>
            <div className="relative">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 오늘 내 룩 어때?"
                maxLength={TITLE_MAX}
                disabled={uploading}
                className={`${MZ_TITLE} pr-16`}
              />
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${title.length >= TITLE_MAX ? 'text-red-400' : 'text-fuchsia-400/70'}`}>
                {title.length}/{TITLE_MAX}
              </span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="경쟁 설명을 추가해보세요 (선택)"
              rows={2}
              maxLength={200}
              disabled={uploading}
              className={MZ_DESC}
            />
          </FormSection>

          {/* 2. 카테고리 + 기간 (라벨 높이·컨트롤 높이 통일) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="flex min-h-[2.5rem] items-center text-xs font-semibold text-[#22282E] leading-tight">
                카테고리
              </label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={uploading}
                  className={`${MZ_SELECT_ROW} transition-colors`}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sky-400/80 pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="flex min-h-[2.5rem] items-center gap-1 text-xs font-semibold text-[#22282E] leading-tight">
                <Clock size={12} className="shrink-0" aria-hidden /> 투표 기간
              </label>
              <div className="relative">
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  disabled={uploading}
                  className={`${MZ_SELECT_ROW} transition-colors`}
                >
                  {DURATIONS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sky-400/80 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* 3. 경쟁 구도 */}
          <FormSection label="🥊 경쟁 구도" required>
            {/* VS는 stretch 대신 오버레이로 배치 — 부모 flex 체인에서 중앙 열 높이가 안 잡혀도 세로 중앙 고정 */}
            <div className="relative min-w-0">
              <div className="flex min-w-0 flex-row gap-2">
                {/* A측 — ContentBox: gap-1.5(타입줄↔카드) */}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div
                    className={`${MZ_IN} ${CTRL_ROW_H} w-full flex items-center gap-1.5 rounded-lg bg-violet-50 border border-violet-200 px-3 text-xs font-bold text-violet-700 select-none`}
                  >
                    <span className="shrink-0 text-violet-400">👤</span>
                    <span className="truncate">{myNickname}</span>
                    <span className="ml-auto shrink-0 text-[10px] font-medium text-violet-400">자동</span>
                  </div>
                  <ContentBox
                    key={`left-${boxKey}`}
                    content={leftContent}
                    onChange={handleLeftChange}
                    disabled={uploading}
                    sideLabel="A"
                    categories={CATEGORIES}
                  />
                </div>

                {/* B측 — A와 동일: 닉네임 → gap-2 → [gap-1.5: 타입줄↔카드] */}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div
                    className={`${MZ_IN} ${CTRL_ROW_H} w-full flex items-center rounded-lg border-dashed border-gray-200 bg-gray-50 px-3 text-xs font-semibold text-gray-400 select-none`}
                    aria-hidden
                  >
                    B 닉네임
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className={CONTENT_TYPE_ROW} aria-hidden />
                    <div
                      className={cn(
                        FEED_CARD_FRAME,
                        'flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 bg-gray-50',
                        '-translate-y-px'
                      )}
                    >
                      <span className="text-[10px] font-bold text-gray-400">도전자 대기</span>
                      <span className="text-[9px] text-gray-300 text-center px-2">나중에 도전자가 채워요</span>
                      <span className="absolute left-2 top-2 z-10 rounded-md bg-gray-300/70 px-1.5 py-0.5 text-[10px] font-black text-white">B</span>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="pointer-events-none absolute left-1/2 top-0 bottom-0 z-[1] flex w-9 -translate-x-1/2 items-center justify-center"
                aria-hidden
              >
                <VsBadge variant="minimal" size="sm" animated={false} />
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
            <div className={MZ_TAG_WRAP}>
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
                  onBlur={(e) => addTag(e.target.value)}
                  placeholder={tags.length === 0 ? '#태그 입력 후 Enter' : '#태그 추가'}
                  disabled={uploading}
                  className={MZ_TAG_IN}
                  autoComplete="off"
                  lang="ko"
                />
              )}
            </div>
          </FormSection>

          {/* 5. 콘텐츠 가이드라인 (접기/펼치기) */}
          <div className="rounded-2xl overflow-hidden border border-violet-200/50 bg-gradient-to-br from-violet-100/40 via-fuchsia-50/50 to-cyan-50/40 shadow-[0_4px_20px_-4px_rgba(139,92,246,0.15)] ring-1 ring-white/60">
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className={cn(
                'w-full flex items-center justify-between px-4 py-3.5 text-left transition-all duration-200',
                'bg-gradient-to-r from-violet-500/15 via-fuchsia-500/10 to-teal-500/15',
                'hover:from-violet-500/25 hover:via-fuchsia-500/15 hover:to-teal-500/20',
                showGuide && 'from-violet-500/20 via-fuchsia-500/12 to-teal-500/18'
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-md shadow-violet-400/30">
                  <Info size={15} className="text-white" strokeWidth={2.25} />
                </span>
                <span className="text-sm font-black bg-gradient-to-r from-violet-800 via-fuchsia-700 to-teal-800 bg-clip-text text-transparent">
                  콘텐츠 업로드 가이드라인
                </span>
              </div>
              <ChevronDown
                size={16}
                className={cn(
                  'shrink-0 text-violet-500 transition-transform duration-200',
                  showGuide && 'rotate-180'
                )}
              />
            </button>
            {showGuide && (
              <div className="border-t border-violet-200/40 bg-gradient-to-b from-violet-50/95 via-fuchsia-50/70 to-teal-50/60 px-4 pb-4 pt-1">
                <ul className="mt-3 space-y-2 text-xs leading-relaxed text-violet-900/85 list-none pl-0">
                  <li className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600" />
                    <span><strong className="text-violet-700">이미지:</strong> JPG, PNG, GIF — 최대 {MAX_IMAGE_MB}MB</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600" />
                    <span><strong className="text-violet-700">권장 해상도:</strong> {IMAGE_RECOMMENDED} (1:1 정방형 자동 크롭)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600" />
                    <span><strong className="text-teal-800">영상:</strong> MP4, MOV — 최대 {MAX_VIDEO_MB}MB, {MAX_VIDEO_SECONDS}초 이내</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-cyan-500 to-sky-600" />
                    <span><strong className="text-teal-800">권장 영상:</strong> {VIDEO_RECOMMENDED} (1080p 이하)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-fuchsia-400 to-pink-500" />
                    <span>모든 콘텐츠는 1:1 비율로 저장되어 레이아웃이 일관되게 표시됩니다.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500" />
                    <span>
                      <strong className="text-violet-700">형식 일치:</strong> A가 이미지면 도전자(B)도 이미지,
                      영상↔영상, 텍스트↔텍스트만 가능해요.
                    </span>
                  </li>
                  <li className="flex gap-2 rounded-lg bg-rose-50/90 border border-rose-200/50 px-2.5 py-2 text-rose-900/90">
                    <span className="mt-0.5 shrink-0 text-rose-500">⚠</span>
                    <span>저작권 침해, 폭력적·선정적·비방 콘텐츠는 금지됩니다.</span>
                  </li>
                  <li className="flex gap-2 rounded-lg bg-amber-50/90 border border-amber-200/50 px-2.5 py-2 text-amber-950/85">
                    <span className="mt-0.5 shrink-0 text-amber-600">!</span>
                    <span>가이드라인 위반 시 예고 없이 삭제될 수 있습니다.</span>
                  </li>
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
              className={cn(
                'px-5 py-3.5 text-sm font-semibold rounded-2xl transition-all duration-300 border-2',
                'border-transparent bg-gradient-to-br from-violet-100/90 via-fuchsia-50/80 to-teal-50/70',
                'text-violet-800 hover:from-violet-200/95 hover:via-fuchsia-100/85 hover:to-teal-100/75',
                'shadow-[0_2px_12px_rgba(139,92,246,0.12)] hover:shadow-[0_4px_20px_rgba(139,92,246,0.2)]',
                'hover:scale-[1.02] active:scale-[0.98]',
                'disabled:opacity-40 disabled:hover:scale-100 disabled:shadow-none'
              )}
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSubmitClick}
              disabled={!canSubmit || uploading}
              className={cn(
                'flex-1 py-3.5 rounded-2xl text-sm font-black tracking-wide transition-all duration-300',
                canSubmit && !uploading
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
                  {canSubmit && (isEditMode ? '✓ ' : '🔥 ')}
                  {isEditMode ? '변경 사항 저장' : 'NEW 매치업 만들기'}
                </span>
              )}
            </button>
          </div>
        </div>

      </div>
    </Drawer>

    <Modal
      isOpen={showSubmitWarning}
      onClose={() => !uploading && setShowSubmitWarning(false)}
      title={isEditMode ? '작성자(A) 쪽 수정을 저장할까요?' : '매치업을 게시할까요?'}
      className="max-w-md"
    >
      <div className="space-y-4">
        <div className="flex gap-3 rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/95 to-orange-50/60 px-3.5 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" strokeWidth={2.25} />
          {isEditMode ? (
            <p className="text-sm leading-relaxed text-amber-950/90">
              저장하면 <strong className="font-bold">제목·설명·카테고리·투표 기간·태그·A측 콘텐츠·A측 표시 이름</strong>이
              즉시 반영돼요. 투표가 한 표라도 기록되면 상세 화면에서는 더 이상 수정할 수 없어요. 부적절한 변경은 운영 정책에
              따라 조치될 수 있습니다.
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-amber-950/90">
              게시 후에는 <strong className="font-bold">주제·카테고리·투표 기간</strong> 등이 바로 반영되며,
              다른 사용자가 도전에 참여할 수 있어요. 부적절한 콘텐츠는 운영 정책에 따라 삭제될 수 있습니다.
            </p>
          )}
        </div>
        <ul className="text-xs text-gray-600 space-y-2 pl-0 list-none">
          <li className="flex gap-2">
            <span className="text-violet-500 font-bold">·</span>
            저작권·초상권을 침해하지 않은 콘텐츠만 올려주세요.
          </li>
          <li className="flex gap-2">
            <span className="text-fuchsia-500 font-bold">·</span>
            폭력·선정·혐오·비방 등은 금지됩니다.
          </li>
          <li className="flex gap-2">
            <span className="text-teal-600 font-bold">·</span>
            {isEditMode ? '위 내용을 확인했으며, 수정 저장에 동의합니다.' : '위 가이드를 확인했으며, 게시에 동의합니다.'}
          </li>
        </ul>
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={() => setShowSubmitWarning(false)}
            disabled={uploading}
            className={cn(
              'flex-1 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 border-2 border-transparent',
              'bg-gradient-to-br from-violet-100/90 via-fuchsia-50/80 to-teal-50/70 text-violet-800',
              'hover:from-violet-200/95 hover:via-fuchsia-100/85 hover:to-teal-100/75',
              'shadow-[0_2px_12px_rgba(139,92,246,0.12)]',
              'disabled:opacity-40'
            )}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirmSubmit}
            disabled={uploading}
            className="flex-1 py-3 rounded-2xl text-sm font-black tracking-wide bg-[#22282E] text-white shadow-[0_0_20px_rgba(34,40,46,0.35)] hover:shadow-[0_0_28px_rgba(34,40,46,0.5)] hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-40 disabled:hover:scale-100"
          >
            {isEditMode ? '저장하기' : '게시하기'}
          </button>
        </div>
      </div>
    </Modal>
    </>
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
function ContentBox({ content, onChange, disabled, sideLabel, optional, requiredType, requiredCategory, categories = [] }) {
  const fileRef = useRef(null)
  const [contentType, setContentType] = useState('image')
  const effectiveType = requiredType ?? contentType
  const [dragging, setDragging] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [sizeError, setSizeError] = useState('')
  /** 영상 검사·이미지 1:1 준비 중 라벨 (빈 문자열이면 대기 아님) */
  const [processingLabel, setProcessingLabel] = useState('')
  const [showCamera, setShowCamera] = useState(false)
  const mediaBusy = Boolean(processingLabel)

  useEffect(() => {
    if (!content) return
    if (content.type === 'text') {
      setTextInput(typeof content.text === 'string' ? content.text : '')
      if (!requiredType) setContentType('text')
      return
    }
    if ((content.type === 'image' || content.type === 'video') && !requiredType) {
      setContentType(content.type)
    }
  }, [content, requiredType])

  const TYPES = [
    { id: 'image', icon: Image },
    { id: 'video', icon: Video },
    { id: 'text', icon: Type },
  ]

  const validateAndSet = async (file) => {
    if (!file) return
    setSizeError('')
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    if (!isImage && !isVideo) { setSizeError('이미지 또는 영상만 가능해요'); return }
    const typeFileCheck = mediaFileMatchesMatchupSideType(effectiveType, file)
    if (!typeFileCheck.ok) { setSizeError(typeFileCheck.message); return }
    if (isImage && file.size > MAX_IMAGE_BYTES) { setSizeError(`이미지 최대 ${MAX_IMAGE_MB}MB`); return }
    if (isVideo && file.size > MAX_VIDEO_BYTES) { setSizeError(`영상 최대 ${MAX_VIDEO_MB}MB`); return }
    if (isVideo) {
      setProcessingLabel('영상 검사 중...')
      const sniff = await validateMatchupVideoUpload(file)
      if (!sniff.ok) {
        setProcessingLabel('')
        setSizeError(sniff.message)
        return
      }
      const v = await validateVideo(file)
      setProcessingLabel('')
      if (!v.valid) { setSizeError(v.error); return }
      if (content?.preview?.startsWith?.('blob:')) URL.revokeObjectURL(content.preview)
      const preview = URL.createObjectURL(file)
      const base = { type: 'video', file, preview }
      onChange(requiredCategory ? { ...base, category: requiredCategory } : base)
      return
    }
    if (isImage) {
      setProcessingLabel('이미지 1:1 준비 중...')
      try {
        const sniff = await validateSelectableRasterImageUpload(file)
        if (!sniff.ok) {
          setSizeError(sniff.message)
          return
        }
        const compressed = await compressAndCropImage(file)
        const pj = await validatePipelineJpegOutput(compressed)
        if (!pj.ok) {
          setSizeError(pj.message)
          return
        }
        if (content?.preview?.startsWith?.('blob:')) URL.revokeObjectURL(content.preview)
        const preview = URL.createObjectURL(compressed)
        const base = { type: 'image', file: compressed, preview, imagePrepared: true }
        onChange(requiredCategory ? { ...base, category: requiredCategory } : base)
      } catch {
        setSizeError('이미지를 처리하지 못했어요. 다른 파일로 시도해 주세요.')
      } finally {
        setProcessingLabel('')
      }
      return
    }
  }

  const handleRemove = (e) => {
    e?.stopPropagation()
    if (content?.preview?.startsWith?.('blob:')) URL.revokeObjectURL(content.preview)
    onChange(null); setSizeError(''); setShowCamera(false); setProcessingLabel('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const switchType = (t) => {
    if (requiredType) return
    setContentType(t); setSizeError('')
    setShowCamera(false)
    onChange(null); setTextInput('')
  }

  const handleCameraCapture = async (photo) => {
    setSizeError('')
    try {
      const file = await cameraPhotoToFile(photo, 'matchup-a.jpg')
      await validateAndSet(file)
      setShowCamera(false)
    } catch (err) {
      setSizeError(err?.message ? String(err.message) : '카메라 사진을 불러오지 못했어요')
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* 타입 버튼 (requiredType이 있으면 숨김) */}
      {!requiredType && (
      <div className={CONTENT_TYPE_ROW}>
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
        <div className={CONTENT_TYPE_ROW}>
          <p className="text-[10px] font-semibold text-gray-500">
            {effectiveType === 'image' ? '이미지' : effectiveType === 'video' ? '영상' : '텍스트'}로 올려주세요
          </p>
        </div>
      )}

      {/* 텍스트 — 이미지/영상 카드와 동일 aspect-square */}
      {effectiveType === 'text' ? (
        <div className={`${FEED_CARD_FRAME} border-2 border-dashed border-teal-200/50 bg-gradient-to-br from-teal-50/95 via-emerald-50/70 to-cyan-50/50`}>
          <textarea
            value={textInput}
            onChange={(e) => {
              setTextInput(e.target.value)
              const base = e.target.value.trim() ? { type: 'text', text: e.target.value.trim() } : null
              onChange(base ? (requiredCategory ? { ...base, category: requiredCategory } : base) : null)
            }}
            placeholder="내 의견을 입력하세요"
            maxLength={200}
            disabled={disabled}
            className="absolute inset-0 h-full w-full resize-none rounded-xl border-0 bg-transparent px-3 py-3 text-left text-xs outline-none ring-0 transition-all focus:ring-2 focus:ring-teal-400/40 placeholder:text-teal-600/65 disabled:opacity-60"
          />
          <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-md bg-[#22282E]/70 px-1.5 py-0.5 text-[10px] font-black text-white">
            {sideLabel}
          </span>
        </div>
      ) : (
        /* 드롭박스 — 클립보드 이미지·영상 붙여넣기(Ctrl+V)는 박스 포커스 후 */
        <div
          tabIndex={effectiveType === 'text' ? undefined : 0}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (!disabled && !mediaBusy) validateAndSet(e.dataTransfer.files?.[0]) }}
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onClick={(e) => {
            if (content || disabled || mediaBusy) return
            if (e.target.closest('[data-file-pick]')) return
            e.currentTarget.focus()
          }}
          onPaste={async (e) => {
            if (disabled || mediaBusy || effectiveType === 'text' || content) return
            const acceptImage = effectiveType === 'image'
            const acceptVideo = effectiveType === 'video'
            const files = getClipboardMediaFiles(e, { images: acceptImage, videos: acceptVideo })
            const file = files[0]
            if (!file) return
            e.preventDefault()
            e.stopPropagation()
            await validateAndSet(file)
          }}
          className={cn(
            FEED_CARD_FRAME,
            'border-2 border-dashed transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#22282E]/25',
            disabled || mediaBusy ? 'opacity-60 cursor-not-allowed' :
            dragging ? 'border-[#22282E] bg-gray-100 scale-[1.02] cursor-copy' :
            content ? 'border-[#22282E] cursor-default' :
            'border-gray-200 bg-gray-50 hover:border-gray-400 hover:bg-gray-100 cursor-default active:scale-[0.98]'
          )}
        >
          {content ? (
            <>
              {content.type === 'image' && <img src={safeMediaUrl(content.preview)} alt="" className="w-full h-full object-cover" />}
              {content.type === 'video' && <video src={safeMediaUrl(content.preview)} className="w-full h-full object-cover" muted />}
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
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3 pb-10 text-gray-400">
              {mediaBusy ? (
                <>
                  <span className="w-6 h-6 border-2 border-gray-300 border-t-[#22282E] rounded-full animate-spin" />
                  <p className="text-[10px] font-medium text-gray-500">{processingLabel}</p>
                </>
              ) : (
                <>
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                    <Upload size={16} className="text-gray-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-gray-500">드롭 또는 붙여넣기</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">
                      {effectiveType === 'video'
                        ? '파일 탐색기에서 영상을 복사한 뒤 이 박스를 한 번 눌러 포커스한 다음 '
                        : '이미지를 복사한 뒤 이 박스를 한 번 눌러 포커스한 다음 '}
                      <span className="font-bold text-gray-500">Ctrl+V</span>
                    </p>
                    {optional && <p className="text-[10px] text-gray-300 mt-0.5">선택 사항</p>}
                  </div>
                </>
              )}
            </div>
          )}
          {!content && !mediaBusy && !disabled && (
            <button
              type="button"
              data-file-pick
              onClick={(e) => {
                e.stopPropagation()
                fileRef.current?.click()
              }}
              className="pointer-events-auto absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-[11px] font-bold text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              파일에서 선택
            </button>
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
          카테고리: {categories.find((c) => c.value === requiredCategory)?.label || requiredCategory}
        </p>
      )}

      {sizeError && (
        <div className="flex items-center gap-1 text-[10px] text-red-500">
          <AlertCircle size={10} />{sizeError}
        </div>
      )}

      {!requiredType && effectiveType === 'image' && (
        <div className="space-y-2">
          {!showCamera ? (
            <button
              type="button"
              disabled={disabled || mediaBusy || Boolean(content)}
              onClick={() => setShowCamera(true)}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200/70 bg-gradient-to-r from-emerald-50/95 to-teal-50/80 py-2.5 text-[11px] font-bold text-emerald-900 transition-colors',
                'hover:border-emerald-300 hover:from-emerald-50 hover:to-teal-50',
                (disabled || mediaBusy || content) && 'cursor-not-allowed opacity-45'
              )}
            >
              <Camera size={14} className="shrink-0" aria-hidden />
              카메라로 촬영
            </button>
          ) : (
            <div className="space-y-2 rounded-xl border border-emerald-100 bg-white/95 p-2 shadow-sm">
              <button
                type="button"
                disabled={disabled}
                onClick={() => { setShowCamera(false); setSizeError('') }}
                className="text-[10px] font-bold text-emerald-800 hover:text-emerald-950"
              >
                ← 파일 선택으로 돌아가기
              </button>
              <SmartphoneCameraCapture
                quality={88}
                className="border-0 p-2 shadow-none"
                onCapture={handleCameraCapture}
                onError={(m) => setSizeError(m)}
              />
            </div>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={effectiveType === 'image' ? MATCHUP_IMAGE_INPUT_ACCEPT : MATCHUP_VIDEO_INPUT_ACCEPT}
        className="hidden"
        onChange={(e) => { if (!mediaBusy) validateAndSet(e.target.files?.[0]); e.target.value = '' }}
      />
    </div>
  )
}
