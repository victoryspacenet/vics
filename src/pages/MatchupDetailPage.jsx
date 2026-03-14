import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Heart, Link2, Check, Send, Swords, Hash,
         Clock, Users, X, ChevronRight, Zap, Image, Video, Type, AlertCircle, CheckCircle, CornerDownRight, ThumbsUp, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { Avatar } from '../components/ui/Avatar'
import { LevelBadge } from '../components/ui/LevelBadge'
import { formatDate, formatNumber, calcPercent, copyToClipboard, cn } from '../lib/utils'

const MAX_IMAGE_MB = 5
const MAX_VIDEO_MB = 50
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024
const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024

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

const TITLE_MAX = 60

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

// ── AI 한줄평 생성기 ──────────────────────────────────────────────
function generateAIComment(matchup, votedSide, leftPct, rightPct) {
  const userWins  = (votedSide === 'left' && leftPct >= rightPct) || (votedSide === 'right' && rightPct >= leftPct)
  const gap       = Math.abs(leftPct - rightPct)
  const label     = votedSide === 'left' ? (matchup.left_label || 'A') : (matchup.right_label || 'B')
  const oppLabel  = votedSide === 'left' ? (matchup.right_label || 'B') : (matchup.left_label || 'A')

  if (userWins && gap > 35) return `압도적 다수의 선택, ${label}! 당신의 안목은 이미 대중을 리드하고 있어요. 트렌드 감지 능력 최상급 👑`
  if (userWins && gap > 15) return `${label}를 선택한 당신, 역시 감각이 남달라요! 힙스터 점수 만점 ✨ 성수동 트렌드세터 인증`
  if (userWins && gap <= 15) return `팽팽한 접전에서 우세한 ${label}를 골랐네요! 찰나의 순간에도 흔들리지 않는 안목, 인상적이에요 🔥`
  if (!userWins && gap > 35) return `소수의 길을 택한 ${label} 선택! 남들이 가지 않은 길을 가는 당신, 개성 지수 200% 🌟`
  if (!userWins && gap > 15) return `${oppLabel}가 우세하지만… 당신의 독보적인 취향이 언젠가 트렌드를 만들 거예요. 얼리어답터 정신 ⚡`
  return `초박빙 대결! ${label}와 ${oppLabel}, 어느 쪽이 역전할지 아무도 몰라요. 당신의 선택이 결정짓는 중… 🎲`
}

// ── 마감 카운트다운 훅 ────────────────────────────────────────────
function useCountdown(expiresAt) {
  const [remaining, setRemaining] = useState(null)
  useEffect(() => {
    if (!expiresAt) return
    const tick = () => { const d = new Date(expiresAt) - Date.now(); setRemaining(d > 0 ? d : 0) }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])
  if (remaining === null) return null
  const h = Math.floor(remaining / 3600000)
  const m = Math.floor((remaining % 3600000) / 60000)
  const s = Math.floor((remaining % 60000) / 1000)
  return { h, m, s, expired: remaining === 0 }
}

// ── SNS 공유 설정 ─────────────────────────────────────────────────
const SNS_LIST = [
  {
    id: 'kakao',
    label: '카카오톡',
    color: 'bg-[#FEE500] hover:bg-[#f0d800] text-[#3A1D1D]',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M12 3C6.477 3 2 6.582 2 11.015c0 2.822 1.687 5.308 4.24 6.82l-.896 3.34a.25.25 0 0 0 .372.274L9.77 19.26A11.99 11.99 0 0 0 12 19.03c5.523 0 10-3.582 10-8.015S17.523 3 12 3z"/>
      </svg>
    ),
  },
  {
    id: 'facebook',
    label: '페이스북',
    color: 'bg-[#1877F2] hover:bg-[#1464cc] text-white',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.791-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.883v2.255h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
      </svg>
    ),
  },
  {
    id: 'twitter',
    label: 'X(트위터)',
    color: 'bg-[#000000] hover:bg-[#333] text-white',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.732-8.855L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
  {
    id: 'instagram',
    label: '인스타그램',
    color: 'bg-gradient-to-br from-[#f09433] via-[#e6683c] via-[#dc2743] via-[#cc2366] to-[#bc1888] hover:opacity-90 text-white',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
  },
]

function handleSnsShare(platform, title, url) {
  const enc = encodeURIComponent
  const shares = {
    kakao: () => {
      // 카카오 SDK 없을 때 링크 복사로 대체
      copyToClipboard(url)
      alert('링크가 복사됐어요. 카카오톡에 붙여넣어 공유해보세요!')
    },
    facebook: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`, '_blank', 'width=600,height=400'),
    twitter: () => window.open(`https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url)}`, '_blank', 'width=600,height=400'),
    instagram: () => { copyToClipboard(url); alert('링크가 복사됐어요. 인스타그램에 붙여넣어 공유해보세요!') },
  }
  shares[platform]?.()
}

// ─────────────────────────────────────────────────────────────────
export function MatchupDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile: myProfile, fetchProfile } = useAuthStore()
  const { showToast, openLoginModal, openChallengeDrawer } = useUIStore()

  const [matchup, setMatchup] = useState(null)
  const [authorProfile, setAuthorProfile] = useState(null)
  const [userVote, setUserVote] = useState(null)
  const [voteLocked, setVoteLocked] = useState(false)
  const [liked, setLiked] = useState(false)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [voteChangeSec, setVoteChangeSec] = useState(null)
  const [showResultModal, setShowResultModal] = useState(false)
  const [resultVotedSide, setResultVotedSide] = useState(null)
  const [showSharePromptModal, setShowSharePromptModal] = useState(false)
  const [hasConfirmedShare, setHasConfirmedShare] = useState(false)
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)
  const countdownRef = useRef(null)

  const timer = useCountdown(matchup?.expires_at)

  useEffect(() => { fetchMatchup(); fetchComments() }, [id])
  useEffect(() => { if (user) { fetchUserVote(); fetchUserLike() } }, [user, id])

  // 실시간 투표 구독
  useEffect(() => {
    const ch = supabase.channel(`matchup-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matchups', filter: `id=eq.${id}` },
        (p) => { if (p.new) setMatchup((prev) => ({ ...prev, ...p.new })) })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [id])

  const fetchMatchup = async () => {
    const { data } = await supabase
      .from('matchups')
      .select('*, profiles:user_id(id, nickname, avatar_url, points)')
      .eq('id', id).single()
    if (data) { setMatchup(data); setAuthorProfile(data.profiles) }
  }
  const fetchUserVote = async () => {
    const { data } = await supabase.from('votes').select('side').eq('user_id', user.id).eq('matchup_id', id).maybeSingle()
    if (data) { setUserVote(data.side); setVoteLocked(true) }
  }
  const fetchUserLike = async () => {
    const { data } = await supabase.from('likes').select('id').eq('user_id', user.id).eq('matchup_id', id).maybeSingle()
    setLiked(!!data)
  }
  const fetchComments = async () => {
    const { data } = await supabase.from('comments')
      .select('*, profiles:user_id(id, nickname, avatar_url)')
      .eq('matchup_id', id).order('created_at', { ascending: true })
    setComments(data || [])
  }
  const handleComment = async (e) => {
    e.preventDefault()
    if (!user) { openLoginModal(); return }
    if (!commentText.trim() || submittingComment) return
    setSubmittingComment(true)
    try {
      const { data } = await supabase.from('comments').insert({
        user_id: user.id, matchup_id: id, content: commentText.trim(),
      }).select('*, profiles:user_id(id, nickname, avatar_url)').single()
      if (data) {
        setComments((p) => [...p, data])
        setCommentText('')
        setMatchup((p) => ({ ...p, comments_count: (p.comments_count || 0) + 1 }))
      }
    } catch { showToast('댓글 작성에 실패했어요', 'error') }
    finally { setSubmittingComment(false) }
  }
  const handleDeleteComment = async (commentId) => {
    await supabase.from('comments').delete().eq('id', commentId)
    setComments((p) => p.filter((c) => c.id !== commentId))
    setMatchup((p) => ({ ...p, comments_count: Math.max(0, (p.comments_count || 0) - 1) }))
  }
  const handleVote = async (side) => {
    if (!user) { openLoginModal(); return }
    if (!matchup?.right_type || timer?.expired) return
    try {
      if (!userVote) {
        await supabase.from('votes').insert({ user_id: user.id, matchup_id: id, side })
        setUserVote(side)
        setMatchup((p) => ({
          ...p,
          left_votes:  side === 'left'  ? (p.left_votes  || 0) + 1 : p.left_votes,
          right_votes: side === 'right' ? (p.right_votes || 0) + 1 : p.right_votes,
          total_votes: (p.total_votes || 0) + 1,
        }))
        showToast('투표 완료! +2pt 획득 🎉', 'success')
        // 결과 모달 표시 (300ms 딜레이로 투표 상태 업데이트 후 열기)
        setResultVotedSide(side)
        setTimeout(() => setShowResultModal(true), 350)
        setVoteChangeSec(5)
        countdownRef.current = setInterval(() => {
          setVoteChangeSec((c) => {
            if (c <= 1) { clearInterval(countdownRef.current); setVoteLocked(true); return null }
            return c - 1
          })
        }, 1000)
        setTimeout(() => fetchProfile(user.id), 800)
      } else if (!voteLocked && userVote !== side) {
        await supabase.from('votes').update({ side }).eq('user_id', user.id).eq('matchup_id', id)
        setMatchup((p) => ({
          ...p,
          left_votes:  side === 'left'  ? (p.left_votes  || 0) + 1 : userVote === 'left'  ? (p.left_votes  || 0) - 1 : p.left_votes,
          right_votes: side === 'right' ? (p.right_votes || 0) + 1 : userVote === 'right' ? (p.right_votes || 0) - 1 : p.right_votes,
        }))
        setUserVote(side)
        showToast('투표가 변경됐어요', 'info')
      }
    } catch { showToast('투표 중 오류가 발생했어요', 'error') }
  }

  const handleLike = async () => {
    if (!user) { openLoginModal(); return }
    try {
      if (liked) {
        await supabase.from('likes').delete().eq('user_id', user.id).eq('matchup_id', id)
        setLiked(false)
        setMatchup((p) => ({ ...p, likes_count: Math.max(0, (p.likes_count || 0) - 1) }))
      } else {
        await supabase.from('likes').insert({ user_id: user.id, matchup_id: id })
        setLiked(true)
        setMatchup((p) => ({ ...p, likes_count: (p.likes_count || 0) + 1 }))
      }
    } catch { showToast('오류가 발생했어요', 'error') }
  }

  const handleCopyLink = async () => {
    await copyToClipboard(window.location.href)
    setLinkCopied(true)
    showToast('링크가 복사됐어요!', 'success')
    setTimeout(() => setLinkCopied(false), 2500)
  }

  // 최종 매치업 만들기 (User A 전용, B 업로드 완료 시)
  const handleFinalizeMatchup = () => {
    if (!matchup?.right_type || !isMyMatchup) return
    showToast('매치업이 성공적으로 생성되었습니다!', 'success')
    setShowSharePromptModal(true)
  }

  // 수정 (NEW 매치업, User A 전용)
  const handleEditMatchup = () => {
    if (!isMyMatchup) return
    showToast('수정 기능은 준비 중이에요', 'info')
  }

  // 삭제 확인 모달 열기
  const openDeleteConfirm = () => {
    if (!isMyMatchup || !matchup?.id) return
    setShowDeleteConfirmModal(true)
  }

  // 삭제 실행 (NEW 매치업, User A 전용)
  const handleDeleteMatchup = async () => {
    if (!matchup?.id) return
    setShowDeleteConfirmModal(false)
    try {
      const { error } = await supabase.from('matchups').delete().eq('id', matchup.id)
      if (error) throw error
      showToast('매치업이 삭제되었어요', 'success')
      navigate('/matchups')
    } catch (err) {
      showToast('삭제 중 오류가 발생했어요', 'error')
    }
  }

  const handleCloseSharePrompt = () => {
    setShowSharePromptModal(false)
    setHasConfirmedShare(true)
    // 상태 갱신으로 투표 UI(카운트다운, 액션 바) 표시
  }

  // ── 로딩 ─────────────────────────────────────────────────────────
  if (!matchup) return <MatchupDetailSkeleton />

  const { left, right } = calcPercent(matchup.left_votes, matchup.right_votes)
  const isComplete  = matchup.right_type != null
  const isExpired   = timer?.expired
  const isMyMatchup = user?.id === matchup.user_id
  const showResults = isComplete && (userVote !== null || (matchup.total_votes || 0) > 0)

  return (
    <div className="max-w-3xl mx-auto space-y-5 min-w-0 px-1 sm:px-0">
      {/* ── 삭제 확인 모달 ── */}
      {showDeleteConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && setShowDeleteConfirmModal(false)}
        >
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 text-center">
            <p className="text-base font-black text-[#22282E] mb-1">매치업을 삭제할까요?</p>
            <p className="text-sm text-gray-500 mb-6">삭제 후에는 복구할 수 없어요.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirmModal(false)}
                className="flex-1 py-3.5 rounded-xl text-sm font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDeleteMatchup}
                className="flex-1 py-3.5 rounded-xl text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 공유 유도 팝업 (최종 매치업 생성 후) ── */}
      {showSharePromptModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && handleCloseSharePrompt()}
        >
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 text-center">
            <p className="text-base font-black text-[#22282E] mb-2">🎉 당신의 대결이 시작되었습니다!</p>
            <p className="text-sm text-gray-500 mb-6">친구들에게 투표를 부탁해보세요.</p>
            <button
              onClick={handleCloseSharePrompt}
              className="w-full py-3.5 rounded-xl text-sm font-bold bg-[#22282E] text-white hover:bg-[#363d46] active:scale-[0.98] transition-all"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* ── 투표 결과 모달 ── */}
      {showResultModal && (
        <VoteResultModal
          matchup={matchup}
          votedSide={resultVotedSide}
          leftPct={left}
          rightPct={right}
          userNickname={myProfile?.nickname}
          onClose={() => setShowResultModal(false)}
          onNavigateNext={() => { setShowResultModal(false); navigate('/matchups') }}
          onShare={() => {
            handleCopyLink()
            setShowResultModal(false)
          }}
        />
      )}

      {/* 뒤로가기 */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#22282E] transition-colors"
      >
        <ArrowLeft size={15} /> 돌아가기
      </button>

      {/* ══ 메인 카드 ══════════════════════════════════════════════ */}
      <article className={cn(
        'bg-white border border-gray-100 rounded-2xl overflow-hidden text-left',
        isComplete ? 'shadow-card' : 'shadow-sm'
      )}>

        {/* ── 헤더 ───────────────────────────────────────────────── */}
        <header className={cn(isComplete && 'border-b border-gray-50', isComplete ? 'px-6 pt-6 pb-5' : '')}>
          {!isComplete ? (
            /* NEW 매치업: 매치업 만들기 폼 레이아웃과 동일 (📌 대결 주제, 카테고리, 투표 기간, 🥊 대결 구도) */
            <>
              <div className="p-5 space-y-5">
                {/* 1. 📌 대결 주제 * */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#22282E]">📌 대결 주제</span>
                    <span className="text-red-400 text-xs">*</span>
                  </div>
                  <div className="relative">
                    <div className="w-full px-4 py-3 text-sm font-medium bg-gray-50 border border-gray-200 rounded-xl text-[#22282E] pr-16">
                      {matchup.title || '—'}
                    </div>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      {(matchup.title || '').length}/{TITLE_MAX}
                    </span>
                  </div>
                  <div className={cn(
                    'w-full px-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl resize-none',
                    matchup.description ? 'text-gray-600' : 'text-gray-300'
                  )}>
                    {matchup.description || '대결 설명을 추가해보세요 (선택)'}
                  </div>
                </div>

                {/* 2. 카테고리 + 투표 기간 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#22282E]">카테고리</label>
                    <div className="px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-600">
                      {CATEGORIES.find((c) => c.value === matchup.category)?.label || '카테고리 선택'}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#22282E] flex items-center gap-1">
                      <Clock size={12} /> 투표 기간
                    </label>
                    <div className="px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-600">
                      {matchup.expires_at
                        ? (() => {
                            const h = Math.round((new Date(matchup.expires_at) - new Date(matchup.created_at)) / 3600000)
                            return h >= 48 ? '48시간' : '24시간'
                          })()
                        : '24시간'}
                    </div>
                  </div>
                </div>

                {/* 3. 🥊 대결 구도 * */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#22282E]">🥊 대결 구도</span>
                    <span className="text-red-400 text-xs">*</span>
                  </div>
                  <div className="grid grid-cols-[1fr_36px_1fr] gap-2 items-stretch">
                    {/* A측 */}
                    <div className="space-y-2">
                      <div className="px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-lg text-[#22282E]">
                        {matchup.left_label || 'A'} 닉네임
                      </div>
                      <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                        {matchup.left_type === 'image' && (matchup.left_thumbnail_url || matchup.left_url) && (
                          <img src={matchup.left_thumbnail_url || matchup.left_url} alt="A" className="w-full h-full object-cover" />
                        )}
                        {matchup.left_type === 'video' && matchup.left_url && (
                          <video src={matchup.left_url} className="w-full h-full object-cover" muted />
                        )}
                        {matchup.left_type === 'text' && (
                          <div className="w-full h-full flex items-center justify-center p-4 bg-gray-50">
                            <p className="text-sm font-bold text-center text-[#22282E]">{matchup.left_text}</p>
                          </div>
                        )}
                        <span className="absolute top-2 left-2 text-[10px] font-black bg-[#22282E]/70 text-white px-1.5 py-0.5 rounded-md">
                          {matchup.left_label || 'A'}
                        </span>
                      </div>
                    </div>

                    {/* VS */}
                    <div className="flex items-center justify-center mt-8">
                      <span className="text-base font-black text-gray-300 leading-none">VS</span>
                    </div>

                    {/* B측: 도전자 대기 */}
                    <div className="space-y-2">
                      <div className="px-3 py-2 text-xs font-semibold text-gray-400 bg-gray-50 border border-dashed border-gray-200 rounded-lg">
                        B 닉네임
                      </div>
                      <div className="relative aspect-square rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-2">
                        <span className="text-[10px] font-bold text-gray-400">도전자 대기</span>
                        <span className="text-[9px] text-gray-300 text-center px-2">나중에 도전자가 채워요</span>
                        {!isMyMatchup && (
                          user ? (
                            <button
                              onClick={() => openChallengeDrawer(matchup)}
                              className="flex items-center gap-1 px-4 py-2 bg-[#22282E] text-white text-xs font-black rounded-xl hover:bg-[#363d46] transition-colors"
                            >
                              <Swords size={13} /> 도전하기
                            </button>
                          ) : (
                            <button
                              onClick={openLoginModal}
                              className="flex items-center gap-1 px-3 py-2 border-2 border-[#22282E] text-[#22282E] text-xs font-black rounded-xl hover:bg-[#22282E] hover:text-white transition-colors"
                            >
                              <Swords size={13} /> 로그인하고 도전
                            </button>
                          )
                        )}
                        <span className="absolute top-2 left-2 text-[10px] font-black bg-gray-300/70 text-white px-1.5 py-0.5 rounded-md">B</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* NEW 매치업: 태그·안내·최종 생성 버튼 */}
              <div className="px-5 pt-2 pb-5 space-y-4 border-t border-gray-50">
                {matchup.tags?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1.5">
                      🏷️ 태그 (User A가 설정함)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {matchup.tags.map((tag) => (
                        <span key={tag} className="inline-flex items-center text-xs font-semibold text-gray-600">
                          [ #{tag} ]
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 안내 문구 + 수정/삭제/최종 매치업 만들기 (User A 전용) */}
                {isMyMatchup && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
                      <span className="text-sm shrink-0 mt-0.5">📢</span>
                      <p className="text-[11px] text-red-700 leading-relaxed">
                        <span className="font-bold">&apos;최종 매치업 만들기&apos;</span>를 누르면 즉시 투표가 시작되며 수정이 불가능해요.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleEditMatchup}
                        className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors shrink-0"
                      >
                        <Pencil size={14} />
                        수정
                      </button>
                      <button
                        onClick={openDeleteConfirm}
                        className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors shrink-0"
                      >
                        <Trash2 size={14} />
                        삭제
                      </button>
                      <button
                        onClick={handleFinalizeMatchup}
                        disabled={!matchup?.right_type}
                        className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-black tracking-wide transition-all ${
                          matchup?.right_type
                            ? 'bg-[#22282E] text-white shadow-[0_0_24px_rgba(34,40,46,0.45)] hover:shadow-[0_0_40px_rgba(34,40,46,0.65)] hover:scale-[1.01] active:scale-[0.99]'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {matchup?.right_type ? <Zap size={16} className="fill-current" /> : null}
                        최종 매치업 만들기
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* 완료된 매치업: 베스트/추천 이미지 형식 (제목, 날짜, 설명) */
            <>
              <div className="px-6 pt-6 pb-5">
                <h1 className="text-xl sm:text-2xl font-black text-[#22282E] mb-1 leading-snug">
                  {matchup.title}
                </h1>
                <p className="text-sm text-gray-400 mb-3">{formatDate(matchup.created_at)}</p>
                {matchup.description && (
                  <p className="text-sm text-gray-500 leading-relaxed">{matchup.description}</p>
                )}
              </div>
            </>
          )}
        </header>

        {/* ── 대결 영역 (완료된 매치업만) ──────────────────────────────────────────── */}
        {isComplete && (
        <section className="px-5 py-6">

          {/* 투표 변경 안내 배너 */}
          {voteChangeSec && (
            <div className="mb-4 bg-[#22282E] text-white rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold min-w-0 break-words">
                ✅ 투표 완료! <span className="text-gray-300 font-normal text-xs">{voteChangeSec}초 내에 변경 가능해요</span>
              </span>
              <div className="relative w-10 h-10">
                <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r="17" stroke="rgba(255,255,255,0.2)" strokeWidth="3" fill="none" />
                  <circle
                    cx="20" cy="20" r="17"
                    stroke="white" strokeWidth="3" fill="none"
                    strokeDasharray="107"
                    strokeDashoffset={107 - (107 * voteChangeSec / 5)}
                    className="transition-all duration-1000"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-black">{voteChangeSec}</span>
              </div>
            </div>
          )}

          {/* 옵션 + VS 뱃지 (베스트/추천 형식: 아바타+이름 카드 위) */}
          <div className="relative grid grid-cols-2 gap-3 sm:gap-5">
            {/* A측 */}
            <OptionCard
              side="left"
              matchup={matchup}
              authorProfile={authorProfile}
              userVote={userVote}
              voteLocked={voteLocked}
              isExpired={isExpired}
              isComplete={isComplete}
              onVote={handleVote}
              percent={left}
              showResult={showResults}
              variant="best"
            />

            {/* B측 */}
            {isComplete ? (
              <OptionCard
                side="right"
                matchup={matchup}
                authorProfile={null}
                userVote={userVote}
                voteLocked={voteLocked}
                isExpired={isExpired}
                isComplete={isComplete}
                onVote={handleVote}
                percent={right}
                showResult={showResults}
                variant="best"
              />
            ) : (
              <ChallengerSlot
                user={user}
                isMyMatchup={isMyMatchup}
                onChallenge={() => openChallengeDrawer(matchup)}
                onLogin={openLoginModal}
              />
            )}

            {/* VS 뱃지 (베스트/추천: 파란색) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-black text-xs sm:text-sm shadow-xl ring-4 ring-white z-20">
                VS
              </div>
            </div>
          </div>

          {/* 완료된 매치업: 카운트다운 + 총 투표수 (항상 표시) */}
          {isComplete && (
            <>
              <div className="mt-5 pt-5 border-t border-gray-50">
                {matchup?.expires_at && timer && !timer.expired ? (
                  <div className="bg-amber-500/90 text-white rounded-xl px-5 py-4 text-center">
                    <p className="text-xs text-white/90 mb-1">투표 마감까지 남은 시간</p>
                    <p className="text-2xl sm:text-3xl font-black font-mono tabular-nums tracking-wider">
                      {String(timer.h).padStart(2, '0')}:{String(timer.m).padStart(2, '0')}:{String(timer.s).padStart(2, '0')}
                    </p>
                  </div>
                ) : (
                  <div className="bg-amber-500/90 text-white rounded-xl px-5 py-4 text-center">
                    <p className="text-xs text-white/90 mb-1">투표 마감까지 남은 시간</p>
                    <p className="text-2xl sm:text-3xl font-black font-mono tabular-nums tracking-wider">
                      00:00:00
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-center gap-2">
                <Users size={14} className="text-gray-400" />
                <span className="text-sm font-black text-[#22282E]">
                  총 투표수: {formatNumber(matchup.total_votes || 0)}
                </span>
              </div>
            </>
          )}
        </section>
        )}

        {/* ── 액션 바 (완료된 매치업만) ───────────────────────────────────────────────── */}
        {isComplete && (
          <footer className="px-5 pb-5 pt-3 border-t border-gray-50">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleLike}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all select-none ${
                  liked
                    ? 'bg-red-50 text-red-500 scale-105'
                    : 'bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-400'
                }`}
              >
                <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
                {formatNumber(matchup.likes_count || 0)}
              </button>
              <a href="#comments" className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-gray-500 bg-gray-50 hover:bg-gray-100 transition-colors">
                💬 {comments.length}
              </a>
              <span className="text-xs text-gray-400 font-medium">친구들에게 공유하기</span>
              {SNS_LIST.map((sns) => (
                <button
                  key={sns.id}
                  onClick={() => handleSnsShare(sns.id, matchup.title, window.location.href)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95 ${sns.color}`}
                >
                  {sns.icon}
                  {sns.label}
                </button>
              ))}
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                {linkCopied
                  ? <><Check size={14} className="text-green-500" /><span className="text-green-600">복사됨</span></>
                  : <><Link2 size={14} /><span>링크 복사</span></>}
              </button>
            </div>
          </footer>
        )}
      </article>

      {/* ══ 댓글 섹션 (완료된 매치업만) ──────────────────────────────────────────── */}
      {isComplete && (
        <section id="comments" className="bg-white border border-gray-100 rounded-2xl shadow-card overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-gray-50 flex items-center gap-2">
            <h2 className="text-base font-bold text-[#22282E]">댓글</h2>
            <span className="text-sm text-gray-400 font-normal">{comments.length}</span>
          </div>

          <div className="px-5 pt-4 pb-4 border-b border-gray-50">
            <div className="flex items-start gap-3">
              <Avatar src={myProfile?.avatar_url} alt={myProfile?.nickname} size="sm" className="mt-0.5" />
              <div className="flex-1 space-y-2">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onClick={() => !user && openLoginModal()}
                  readOnly={!user}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleComment(e)
                  }}
                  placeholder={user ? '댓글을 입력하세요...' : '로그인 후 댓글을 작성할 수 있어요'}
                  rows={3}
                  maxLength={500}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#22282E] focus:bg-white transition-all resize-none placeholder:text-gray-300"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-300">{commentText.length} / 500</span>
                  <button
                    onClick={handleComment}
                    disabled={!commentText.trim() || submittingComment || !user}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#22282E] text-white text-xs font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#363d46] active:scale-95 transition-all"
                  >
                    {submittingComment
                      ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      : <Send size={11} />}
                    댓글 작성
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 py-5 space-y-5">
            {comments.length === 0 && (
              <div className="py-10 text-center">
                <p className="text-4xl mb-2">💬</p>
                <p className="text-sm font-medium text-gray-400">첫 번째 댓글을 남겨보세요!</p>
                <p className="text-xs text-gray-300 mt-1">여러분의 의견이 궁금해요</p>
              </div>
            )}
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUserId={user?.id}
                onDelete={() => handleDeleteComment(comment.id)}
              />
            ))}
          </div>
        </section>
      )}

    </div>
  )
}

// ── 댓글 아이템 ──────────────────────────────────────────────────
function CommentItem({ comment, currentUserId, onDelete }) {
  const [localLike, setLocalLike] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [showReply, setShowReply] = useState(false)
  const isOwn = currentUserId === comment.user_id

  return (
    <div className="flex items-start gap-3">
      <Avatar src={comment.profiles?.avatar_url} alt={comment.profiles?.nickname} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="bg-gray-50 rounded-xl px-4 py-3">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to={`/profile/${comment.profiles?.id}`}
                className="text-xs font-black text-[#22282E] hover:underline"
              >
                {comment.profiles?.nickname || '사용자'}
              </Link>
            </div>
            <span className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap">
              {formatDate(comment.created_at)}
            </span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
            {comment.content}
          </p>
        </div>

        <div className="flex items-center gap-3 mt-1.5 pl-2">
          <button
            onClick={() => {
              setLocalLike((v) => !v)
              setLikeCount((c) => localLike ? Math.max(0, c - 1) : c + 1)
            }}
            className={`flex items-center gap-1 text-xs font-medium transition-colors ${
              localLike ? 'text-red-500' : 'text-gray-400 hover:text-red-400'
            }`}
          >
            <Heart size={11} fill={localLike ? 'currentColor' : 'none'} />
            {likeCount > 0 ? likeCount : '좋아요'}
          </button>
          <button
            onClick={() => setShowReply((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-[#22282E] transition-colors"
          >
            <CornerDownRight size={11} />
            댓글 달기
          </button>
          {isOwn && (
            <button
              onClick={onDelete}
              className="text-xs text-gray-300 hover:text-red-400 transition-colors ml-auto"
            >
              삭제
            </button>
          )}
        </div>

        {showReply && (
          <div className="mt-2 pl-2">
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
              답글 기능은 준비 중이에요 🙏
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 옵션 카드 ──────────────────────────────────────────────────────
function OptionCard({ side, matchup, authorProfile, userVote, voteLocked, isExpired, isComplete, onVote, percent, showResult, variant }) {
  const isLeft  = side === 'left'
  const type    = isLeft ? matchup.left_type  : matchup.right_type
  const url     = isLeft ? matchup.left_url   : matchup.right_url
  const text    = isLeft ? matchup.left_text  : matchup.right_text
  const label   = isLeft ? (matchup.left_label  || 'A') : (matchup.right_label  || 'B')
  const thumb   = isLeft ? matchup.left_thumbnail_url : matchup.right_thumbnail_url

  const voted   = userVote === side
  const canVote = isComplete && !isExpired && !(voteLocked && !voted)
  const isBestVariant = variant === 'best'

  return (
    <div className="flex flex-col gap-2">
      {/* 베스트/추천: 카드 위 아바타+이름 */}
      {isBestVariant && (
        <div className="flex items-center gap-2">
          {isLeft && authorProfile ? (
            <Link to={`/profile/${authorProfile?.id}`} className="flex items-center gap-2">
              <Avatar src={authorProfile?.avatar_url} alt={authorProfile?.nickname} size="sm" />
              <span className="text-sm font-semibold text-[#22282E]">{authorProfile?.nickname || '사용자'}</span>
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                {(label || 'B')[0]}
              </div>
              <span className="text-sm font-semibold text-[#22282E]">{label}</span>
            </div>
          )}
        </div>
      )}
      {/* 미디어 */}
      <div
        onClick={() => canVote && onVote(side)}
        className={`relative aspect-square rounded-xl overflow-hidden group transition-all duration-200 ${
          canVote ? 'cursor-pointer' : 'cursor-default'
        } ${voted ? 'ring-[3px] ring-[#22282E] shadow-lg' : canVote ? 'hover:shadow-lg hover:-translate-y-0.5' : ''}`}
      >
        {type === 'image' && (url || thumb) && (
          <img
            src={thumb || url}
            alt={label}
            className="w-full h-full object-cover transition-transform duration-400 group-hover:scale-105"
          />
        )}
        {type === 'video' && url && (
          <div className="relative w-full h-full bg-black">
            <video
              src={url}
              className="w-full h-full object-cover"
              controls
              playsInline
              preload="metadata"
            />
          </div>
        )}
        {type === 'text' && (
          <div className={`w-full h-full flex items-center justify-center p-4 bg-gray-50`}>
            <p className="text-sm sm:text-base font-bold text-center text-[#22282E] leading-relaxed">{text}</p>
          </div>
        )}
        {type !== 'text' && (
          <>
            {/* 어두운 그라데이션 오버레이 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
            {/* 라벨 */}
            <div className="absolute bottom-2.5 left-0 right-0 text-center pointer-events-none">
              <span className="text-white text-sm sm:text-base font-black drop-shadow-md">{label}</span>
            </div>
          </>
        )}

        {/* 투표됨 뱃지 */}
        {voted && (
          <div className="absolute top-2 right-2 bg-[#22282E] text-white text-[10px] font-black px-2 py-0.5 rounded-full z-10 shadow">
            ✓ 내 선택
          </div>
        )}

        {/* 투표 유도 호버 */}
        {canVote && !voted && type !== 'video' && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors flex items-center justify-center pointer-events-none">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-[#22282E] text-xs font-black px-3 py-1.5 rounded-full shadow-md">
              클릭해서 투표
            </span>
          </div>
        )}
      </div>

      {/* 결과 바 (투표 후 또는 결과 존재 시) */}
      {showResult && (
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-[#22282E]">{label}</span>
            <span className="text-xs font-black text-[#22282E]">{percent}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${voted ? (isBestVariant ? 'bg-blue-600' : 'bg-[#22282E]') : 'bg-gray-400'}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {/* 투표 버튼 */}
      {isComplete && !isExpired && (
        <button
          onClick={() => onVote(side)}
          disabled={voteLocked && !voted}
          className={`w-full py-3 rounded-xl text-sm font-black transition-all active:scale-[0.97] flex items-center justify-center gap-1.5 ${
            voted
              ? isBestVariant ? 'bg-blue-600 text-white shadow-md' : 'bg-[#22282E] text-white shadow-md'
              : voteLocked
              ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
              : isBestVariant
              ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-[#22282E] hover:text-white hover:shadow-md'
          }`}
        >
          {isBestVariant && <ThumbsUp size={14} className={voted ? 'fill-current' : ''} />}
          {voted ? `✓ ${label}에 투표함` : `${label}에 투표하기`}
        </button>
      )}
      {isExpired && (
        <div className="w-full py-2.5 rounded-xl text-xs font-bold text-center bg-gray-100 text-gray-400">
          {voted ? `✓ ${label} 투표` : '마감된 투표'}
        </div>
      )}
    </div>
  )
}

// ── 도전자 슬롯 ───────────────────────────────────────────────────
function ChallengerSlot({ user, isMyMatchup, onChallenge, onLogin }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="aspect-square rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-3 px-3">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
          <Swords size={24} className="text-gray-300" />
        </div>
        <div className="text-center">
          <p className="text-sm font-black text-gray-400">도전자 모집 중</p>
          <p className="text-xs text-gray-300 mt-0.5">아직 상대방이 없어요</p>
        </div>
        {!isMyMatchup && (
          user ? (
            <button
              onClick={onChallenge}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-[#22282E] text-white text-xs font-black rounded-xl hover:bg-[#363d46] hover:scale-[1.03] active:scale-[0.97] transition-all shadow-md"
            >
              <Swords size={13} /> 도전하기
            </button>
          ) : (
            <button
              onClick={onLogin}
              className="flex items-center gap-1.5 px-4 py-2 border-2 border-[#22282E] text-[#22282E] text-xs font-black rounded-xl hover:bg-[#22282E] hover:text-white transition-all"
            >
              <Swords size={13} /> 로그인하고 도전
            </button>
          )
        )}
      </div>
    </div>
  )
}

// ── AI 비교 인사이트 생성기 ─────────────────────────────────────
function generateAIInsight(winnerPct, userWins) {
  const gap = Math.abs(winnerPct - (100 - winnerPct))
  if (userWins) {
    if (gap > 50) return `10명 중 ${Math.round(winnerPct / 10)}명이 당신의 선택에 동의했어요 🔥`
    if (gap > 30) return `${winnerPct}%의 압도적 지지! 트렌드를 읽는 눈이 남달라요 👑`
    if (gap > 15) return '과반수가 당신 편! 센스 있는 선택이에요 ✨'
    return '초박빙 대결에서 우세한 쪽을 선택! 찰나의 안목 🎯'
  }
  if (gap > 30) return '소수파의 개성! 남들과 다른 취향이 당신을 특별하게 해요 🌟'
  return '팽팽한 대결, 역전의 가능성은 아직 남아있어요 💪'
}

// ── 투표 결과 모달 ───────────────────────────────────────────────
function VoteResultModal({ matchup, votedSide, leftPct, rightPct, userNickname, onClose, onNavigateNext, onShare }) {
  const navigate        = useNavigate()
  const { openCreateDrawer } = useUIStore()
  const [animated, setAnimated] = useState(false)
  const [visible, setVisible]   = useState(false)
  const cardRef = useRef(null)

  const leftLabel  = matchup.left_label  || 'A'
  const rightLabel = matchup.right_label || 'B'
  const leftThumb  = matchup.left_thumbnail_url  || matchup.left_url
  const rightThumb = matchup.right_thumbnail_url || matchup.right_url
  const winSide    = leftPct >= rightPct ? 'left' : 'right'
  const userWins   = votedSide === winSide
  const winLabel   = winSide === 'left' ? leftLabel : rightLabel
  const winPct     = winSide === 'left' ? leftPct   : rightPct
  const losePct    = winSide === 'left' ? rightPct  : leftPct

  const aiComment = generateAIComment(matchup, votedSide, leftPct, rightPct)
  const aiInsight = generateAIInsight(winPct, userWins)

  // 인스타 스토리 해시태그
  const hashTag = matchup.tags?.length
    ? '#' + matchup.tags[0].replace(/\s/g, '_')
    : '#VICS_매치업'

  const handleClose = () => { setVisible(false); setTimeout(onClose, 300) }
  const handleRebattle = () => {
    setVisible(false)
    setTimeout(() => { navigate('/matchups'); openCreateDrawer() }, 300)
  }
  const handleNextMatchup = () => { setVisible(false); setTimeout(() => navigate('/matchups'), 300) }

  const handleShareStory = async () => {
    const shareData = { title: matchup.title, text: aiInsight, url: window.location.href }
    if (navigator.share && navigator.canShare?.(shareData)) {
      try { await navigator.share(shareData); return } catch {}
    }
    copyToClipboard(window.location.href)
    onShare()
  }

  // 슬라이드업 + 게이지 애니메이션
  useEffect(() => {
    requestAnimationFrame(() => {
      setVisible(true)
      setTimeout(() => setAnimated(true), 100)
    })
  }, [])

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center transition-all duration-300 ${
        visible ? 'bg-black/60 backdrop-blur-sm' : 'bg-transparent pointer-events-none'
      }`}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className={`w-full sm:max-w-sm bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden transition-all duration-300 ease-out flex flex-col max-h-[95dvh] ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
      >
        {/* ── 핸들 + 닫기 ── */}
        <div className="relative flex items-center justify-center pt-4 pb-2 shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full sm:hidden" />
          <button
            onClick={handleClose}
            className="absolute right-4 top-3 p-1.5 rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── 스크롤 영역 ── */}
        <div className="overflow-y-auto flex-1">

          {/* 승리 발표 */}
          <div className="px-5 pb-3 text-center">
            <p className={`text-base font-black leading-snug ${userWins ? 'text-[#22282E]' : 'text-gray-500'}`}>
              {userWins
                ? <>🎊 <span className="bg-gradient-to-r from-amber-500 to-yellow-400 bg-clip-text text-transparent">{winLabel}</span>의 완벽한 승리입니다! 🎊</>
                : <>🔥 <span className="text-gray-700">{winLabel}</span>의 승리! 당신의 개성은 빛나요</>
              }
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {userWins ? '당신의 안목이 다수와 일치했어요 ✨' : '소수파의 독보적인 취향 🌟'}
            </p>
          </div>

          {/* ══ 공유용 스토리 카드 ══ */}
          <div className="px-4 pb-1">
            <div
              ref={cardRef}
              className="rounded-2xl overflow-hidden border border-gray-100 shadow-lg"
              style={{ background: '#22282E' }}
            >
              {/* 카드 헤더: VICS 브랜딩 + 해시태그 */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <img src="/logo.png" alt="VictorySpace" width={24} height={24} className="object-contain invert" />
                  <span className="text-white font-black text-xs tracking-widest">VICS</span>
                </div>
                <span className="text-white/60 text-[10px] font-medium">{hashTag}</span>
              </div>

              {/* 두 옵션 영역 */}
              <div className="relative grid grid-cols-2 gap-0">
                {/* A측 (왼쪽) */}
                <StoryCardSide
                  type={matchup.left_type}
                  url={leftThumb}
                  text={matchup.left_text}
                  label={leftLabel}
                  pct={leftPct}
                  isWin={winSide === 'left'}
                  isVoted={votedSide === 'left'}
                  animated={animated}
                />
                {/* B측 (오른쪽) */}
                <StoryCardSide
                  type={matchup.right_type}
                  url={rightThumb}
                  text={matchup.right_text}
                  label={rightLabel}
                  pct={rightPct}
                  isWin={winSide === 'right'}
                  isVoted={votedSide === 'right'}
                  animated={animated}
                  alignRight
                />
                {/* 가운데 구분선 + VS */}
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center z-20 pointer-events-none">
                  <div className="w-px h-full bg-white/20" />
                  <div className="absolute w-10 h-10 bg-[#22282E] border-2 border-white/30 rounded-full flex items-center justify-center">
                    <span className="text-white font-black text-[11px]">VS</span>
                  </div>
                </div>
              </div>

              {/* 통합 게이지 바 */}
              <div className="h-2 flex">
                <div
                  className="h-full bg-gradient-to-r from-lime-400 to-emerald-400 transition-all duration-1000 ease-out"
                  style={{ width: animated ? `${leftPct}%` : '0%' }}
                />
                <div
                  className="h-full bg-white/20 transition-all duration-1000 ease-out"
                  style={{ width: animated ? `${rightPct}%` : '100%', transitionDelay: '50ms' }}
                />
              </div>

              {/* 카드 푸터: AI 한줄평 */}
              <div className="px-4 py-3.5 border-t border-white/10">
                <p className="text-white/50 text-[10px] font-bold mb-1">🤖 AI COMMENT</p>
                <p className="text-white text-xs font-semibold leading-relaxed">
                  "{aiComment}"
                </p>
                <p className="text-white/40 text-[10px] mt-2 text-right">
                  {formatNumber(matchup.total_votes || 0)}명 참여 · vics.app
                </p>
              </div>
            </div>

            {/* 스크린샷 안내 */}
            <p className="text-center text-[10px] text-gray-400 mt-2">
              📱 위 카드를 스크린샷해서 스토리에 올려보세요
            </p>
          </div>

          {/* ── AI 비교 인사이트 칩 ── */}
          <div className="px-5 pt-3 pb-1">
            <div className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold leading-relaxed ${
              userWins
                ? 'bg-amber-50 border border-amber-100 text-amber-800'
                : 'bg-purple-50 border border-purple-100 text-purple-800'
            }`}>
              <span className="text-base shrink-0 mt-0.5">{userWins ? '📊' : '💡'}</span>
              <span>{aiInsight}</span>
            </div>
          </div>

          {/* ── 버튼 영역 ── */}
          <div className="px-5 pt-4 pb-6 space-y-2.5">
            {/* Primary: 인스타 스토리 공유 (네온 그라데이션) */}
            <button
              onClick={handleShareStory}
              className="w-full py-4 rounded-2xl text-sm font-black tracking-wide flex items-center justify-center gap-2
                bg-gradient-to-r from-lime-400 to-emerald-400 text-[#0f1f0f]
                shadow-[0_0_28px_rgba(132,204,22,0.55)] hover:shadow-[0_0_44px_rgba(132,204,22,0.75)]
                hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              <Zap size={16} className="fill-current" />
              📸 인스타그램 스토리에 자랑하기
            </button>

            {/* Secondary: 다른 라이벌과 재대결 (아웃라인) */}
            <button
              onClick={handleRebattle}
              className="w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2
                border-2 border-[#22282E] text-[#22282E]
                hover:bg-[#22282E] hover:text-white active:scale-[0.98] transition-all duration-200"
            >
              🔄 다른 라이벌과 대결하기
            </button>

            {/* Tertiary: 다른 매치업 구경가기 (고스트) */}
            <button
              onClick={handleNextMatchup}
              className="w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-1.5
                border border-gray-200 text-gray-500
                hover:border-gray-300 hover:text-gray-700 active:scale-[0.98] transition-all duration-200"
            >
              <ChevronRight size={15} />
              ⏭️ 다른 매치업 구경가기
            </button>

            {/* 계속 보기 */}
            <button
              onClick={handleClose}
              className="w-full py-1.5 text-xs text-gray-300 hover:text-gray-500 transition-colors"
            >
              계속 이 화면 보기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 스토리 카드 개별 사이드 ──────────────────────────────────────
function StoryCardSide({ type, url, text, label, pct, isWin, isVoted, animated, alignRight }) {
  return (
    <div className="relative">
      {/* 미디어 영역 */}
      <div className="aspect-square relative overflow-hidden">
        {type === 'image' && url ? (
          <img src={url} alt={label} className={`w-full h-full object-cover transition-all duration-500 ${isWin ? '' : 'brightness-50 saturate-50'}`} />
        ) : type === 'text' ? (
          <div className="w-full h-full bg-white/10 flex items-center justify-center p-3">
            <p className="text-white text-xs font-bold text-center leading-snug">{text}</p>
          </div>
        ) : (
          <div className="w-full h-full bg-white/10 flex items-center justify-center">
            <span className="text-3xl">🎬</span>
          </div>
        )}
        {/* 그라데이션 오버레이 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* WIN / LOSE 배지 */}
        <div className={`absolute top-2 ${alignRight ? 'right-2' : 'left-2'}`}>
          {isWin ? (
            <span className="bg-gradient-to-r from-lime-400 to-emerald-400 text-[#0f1f0f] text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg">
              WIN
            </span>
          ) : (
            <span className="bg-white/20 text-white/60 text-[10px] font-black px-2 py-0.5 rounded-full">
              LOSE
            </span>
          )}
        </div>

        {/* 내 선택 표시 */}
        {isVoted && (
          <div className={`absolute top-2 ${alignRight ? 'left-2' : 'right-2'}`}>
            <span className="bg-white/90 text-[#22282E] text-[9px] font-black px-1.5 py-0.5 rounded-full">
              내 선택
            </span>
          </div>
        )}

        {/* % 수치 */}
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5">
          <div className={`text-3xl font-black leading-none ${isWin ? 'text-white' : 'text-white/50'}`}>
            {pct}%
          </div>
          <div className="h-1.5 bg-white/20 rounded-full overflow-hidden mt-1.5">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-out ${isWin ? 'bg-gradient-to-r from-lime-400 to-emerald-400' : 'bg-white/30'}`}
              style={{ width: animated ? `${pct}%` : '0%', transitionDelay: alignRight ? '150ms' : '0ms' }}
            />
          </div>
          <p className="text-white/60 text-[10px] mt-1 font-medium">{label}</p>
        </div>
      </div>
    </div>
  )
}

// ── 스켈레톤 ─────────────────────────────────────────────────────
function MatchupDetailSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-pulse">
      <div className="h-5 bg-gray-100 rounded-xl w-24" />
      <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
        <div className="h-7 bg-gray-100 rounded-xl w-3/4" />
        <div className="h-4 bg-gray-100 rounded w-1/2" />
        <div className="grid grid-cols-2 gap-4">
          <div className="aspect-square bg-gray-100 rounded-xl" />
          <div className="aspect-square bg-gray-100 rounded-xl" />
        </div>
        <div className="h-10 bg-gray-100 rounded-xl" />
        <div className="h-10 bg-gray-100 rounded-xl" />
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-3">
        <div className="h-5 bg-gray-100 rounded w-16" />
        <div className="h-20 bg-gray-100 rounded-xl" />
      </div>
    </div>
  )
}
