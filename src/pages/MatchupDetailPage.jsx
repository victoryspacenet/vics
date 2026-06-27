import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Heart, Link2, Check, Send, Swords, Hash,
         Clock, Users, X, ChevronRight, Zap, Image, Video, Type, AlertCircle, CheckCircle, CornerDownRight, ThumbsUp, Pencil, Trash2, Info, ChevronDown, Flag } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  MATCHUP_COMMENT_SELECT,
  MATCHUP_COMMENTS_INITIAL_LIMIT,
  MATCHUP_COMMENTS_MORE_LIMIT,
  fetchMatchupCommentsWindow,
} from '../lib/matchupComments'
import { voteViaApi } from '../lib/voteApi'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { Avatar } from '../components/ui/Avatar'
import { formatDate, formatNumber, calcPercent, copyToClipboard, cn } from '../lib/utils'
import { sanitizeText, safeMediaUrl, reportSuspiciousInputIfNeeded } from '../lib/sanitize'
import { getTier, tierAtLeast } from '../lib/tiers'
import { VsBadge } from '../components/ui/VsBadge'
import { UserProfileLink } from '../components/ui/UserProfileLink'
import { FeaturedBadgeSpan } from '../components/ui/FeaturedBadge'
import { MatchupThumbFrame } from '../components/ui/MatchupThumbFrame'
import { MatchupVoteStatsSection } from '../components/matchup/MatchupVoteStatsSection'
import { VoteFireworks } from '../components/ui/VoteFireworks'
import { MAX_IMAGE_MB, MAX_VIDEO_MB, MAX_VIDEO_SECONDS, IMAGE_RECOMMENDED, VIDEO_RECOMMENDED } from '../lib/mediaSpec'
import { getCategoryLabelById } from '../lib/categoryAdminStorage'
import { shareMatchupToSns, getMatchupShareImageUrl } from '../lib/socialShare'
import { fandomTierHasGoldCommentAura, fandomTierFromClaps } from '../lib/fandomTiers'
import { FANDOM_POINTS_PER_CLAP } from '../lib/fandomPoints'
import { FandomBronzeStarBadge } from '../components/fandom/FandomBronzeStarBadge'
import { FoundingMemberBadge } from '../components/profile/FoundingMemberBadge'
import { FandomGoldExclusiveEmojiBar } from '../components/fandom/FandomGoldExclusiveEmojiBar'
import { MATCHUP_CREATOR_PROFILE_FIELDS, fetchCreatorRankMapForIds, EMPTY_TIER_RANK_INFO } from '../lib/creatorRankSnapshot'
import { isMatchupCreatorVipTierGlow, VIP_MATCHUP_SURFACE_CLASS } from '../lib/matchupCreatorVipGlow'
import { isFeedBannerHighlightActive } from '../lib/bannerHighlightBoost'
import { Modal } from '../components/ui/Modal'
import { submitMatchupReportAndRunModeration } from '../lib/matchupReports'
import { MatchupMediaViewer } from '../components/matchup/MatchupMediaViewer'
import { canOpenMatchupMediaView } from '../lib/matchupMediaView'
import { canLoadMatchupFromDb, isFeedDemoMatchupId } from '../lib/matchupIds'
import { MATCHUP_DETAIL_MATCHUP_COLUMNS } from '../lib/matchupQueryColumns'
import { storedCategoryValuesForFilter } from '../lib/matchupCategoryAliases'
import {
  VALID_MATCHUPS_FEED_FILTERS,
  readInitialMatchupsFeedCategory,
  buildMatchupsListUrl,
  useMatchupsFeedCategories,
  MatchupsFeedLnbPageLayout,
  MatchupsFeedLnbMobileTrigger,
} from '../components/matchup/MatchupsFeedLnb'

const MATCHUP_DETAIL_SELECT = `${MATCHUP_DETAIL_MATCHUP_COLUMNS}, profiles:user_id(${MATCHUP_CREATOR_PROFILE_FIELDS}), right_profiles:right_user_id(${MATCHUP_CREATOR_PROFILE_FIELDS})`
const MATCHUP_DETAIL_SELECT_FALLBACK = `${MATCHUP_DETAIL_MATCHUP_COLUMNS}, profiles:user_id(id, nickname, avatar_url), right_profiles:right_user_id(id, nickname, avatar_url)`

function shouldRetryMatchupDetailSelect(err) {
  const msg = String(err?.message || err || '').toLowerCase()
  return (
    msg.includes('column') ||
    msg.includes('does not exist') ||
    msg.includes('fandom_tier') ||
    msg.includes('featured_badge') ||
    msg.includes('creator_wins') ||
    msg.includes('schema cache')
  )
}

const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024
const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024

const DURATIONS = [
  { value: '24', label: '24시간' },
  { value: '48', label: '48시간' },
]

const TITLE_MAX = 60

/** 평면 댓글 목록 → 부모-자식 트리 (created_at 순) */
function nestComments(flat) {
  if (!flat?.length) return []
  const byId = new Map()
  for (const c of flat) {
    byId.set(c.id, { ...c, children: [] })
  }
  const roots = []
  for (const c of flat) {
    const node = byId.get(c.id)
    if (c.parent_id && byId.has(c.parent_id)) {
      byId.get(c.parent_id).children.push(node)
    } else {
      roots.push(node)
    }
  }
  const byTime = (a, b) => new Date(a.created_at) - new Date(b.created_at)
  const sortDeep = (nodes) => {
    nodes.sort(byTime)
    for (const n of nodes) {
      if (n.children?.length) sortDeep(n.children)
    }
  }
  sortDeep(roots)
  return roots
}

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

// ── AI 한줄평·인사이트 (실제 투표 수 기반) ───────────────────────
function getVoteResultStats(matchup, votedSide, leftPct, rightPct) {
  const leftVotes = matchup.left_votes || 0
  const rightVotes = matchup.right_votes || 0
  const totalVotes = leftVotes + rightVotes
  const userSideVotes = votedSide === 'left' ? leftVotes : rightVotes
  const oppSideVotes = totalVotes - userSideVotes
  const gap = Math.abs(leftPct - rightPct)
  const isDraw = totalVotes > 0 && leftVotes === rightVotes
  const winSide = isDraw ? null : (leftVotes > rightVotes ? 'left' : 'right')
  const userWins = !isDraw && votedSide === winSide
  return {
    leftVotes,
    rightVotes,
    totalVotes,
    userSideVotes,
    oppSideVotes,
    gap,
    isDraw,
    winSide,
    userWins,
    isFirstVote: totalVotes <= 1,
    isEarlyVote: totalVotes <= 5,
  }
}

function generateAIComment(matchup, votedSide, leftPct, rightPct) {
  const stats = getVoteResultStats(matchup, votedSide, leftPct, rightPct)
  const { totalVotes, userSideVotes, oppSideVotes, gap, isDraw, userWins, isFirstVote, isEarlyVote } = stats
  const label = votedSide === 'left' ? (matchup.left_label || 'A') : (matchup.right_label || 'B')
  const oppLabel = votedSide === 'left' ? (matchup.right_label || 'B') : (matchup.left_label || 'A')

  if (isFirstVote) {
    return `${label}에 첫 표를 남겼어요! 아직 투표가 더 모이면 결과가 달라질 수 있어요 🎯`
  }
  if (isDraw) {
    return `${totalVotes}표로 ${label}와 ${oppLabel}가 팽팽해요. 당신의 한 표가 균형을 만들고 있어요 🤝`
  }
  if (isEarlyVote) {
    if (userWins && gap >= 40) {
      return `지금은 ${totalVotes}명 중 ${userSideVotes}명이 ${label} 쪽이에요. 초반이라 추세는 바뀔 수 있어요 👀`
    }
    if (userWins) {
      return `${label}가 ${userSideVotes}표로 앞서고 있어요. 표가 더 모이면 경쟁이 치열해질 거예요 ✨`
    }
    if (gap >= 40) {
      return `${oppLabel}가 ${oppSideVotes}표로 앞서지만, ${label} 역전도 충분히 가능해요 💪`
    }
    return `${label}와 ${oppLabel} 접전! ${userSideVotes}표 vs ${oppSideVotes}표, 아직 누가 이길지 모르는 단계예요 🎲`
  }

  if (userWins && gap > 35) {
    return `${totalVotes}명 중 ${userSideVotes}명이 ${label}를 선택했어요. 다수와 같은 선택이에요 👑`
  }
  if (userWins && gap > 15) {
    return `${label} 쪽 ${userSideVotes}표! 과반에 가까운 선택, 감각이 좋아요 ✨`
  }
  if (userWins) {
    return `초박빙에서 우세한 ${label}를 골랐네요. ${userSideVotes}표 vs ${oppSideVotes}표, 찰나의 안목 🔥`
  }
  if (gap > 35) {
    return `${totalVotes}명 중 ${userSideVotes}명만 ${label} — 소수지만 개성 있는 선택이에요 🌟`
  }
  if (gap > 15) {
    return `${oppLabel}가 ${oppSideVotes}표로 앞서지만, ${label} 역전 여지는 충분해요 ⚡`
  }
  return `${label} ${userSideVotes}표 vs ${oppLabel} ${oppSideVotes}표. 어느 쪽이 역전할지 아무도 몰라요 🎲`
}

function generateAIInsight(stats, winPct) {
  const { totalVotes, userSideVotes, oppSideVotes, gap, userWins, isFirstVote, isEarlyVote } = stats

  if (isFirstVote) {
    return '첫 투표를 완료했어요! 공유해서 더 많은 표를 모아보세요 📣'
  }
  if (isEarlyVote) {
    if (userWins) {
      return `현재 ${totalVotes}명 중 ${userSideVotes}명이 같은 선택 — 아직 표본이 적어요 👀`
    }
    return `현재 ${totalVotes}명 투표, ${userSideVotes}명만 같은 선택. 역전 가능성은 아직 있어요 🌟`
  }

  if (userWins) {
    if (gap > 30) return `${totalVotes}명 중 ${userSideVotes}명이 같은 선택 (${winPct}%) 🔥`
    if (gap > 15) return `${userSideVotes}명이 같은 편이에요. 과반에 가까운 선택 ✨`
    return `초박빙! ${userSideVotes}표 vs ${oppSideVotes}표, 우세한 쪽을 골랐어요 🎯`
  }
  if (gap > 30) return `${totalVotes}명 중 ${userSideVotes}명만 같은 선택 — 소수파의 개성이에요 🌟`
  return `${oppSideVotes}표 vs ${userSideVotes}표. 팽팽하게 싸워볼 여지가 있어요 💪`
}

function getVoteResultHeadline(stats, winLabel) {
  const { isDraw, userWins, isFirstVote, isEarlyVote, totalVotes } = stats

  if (isFirstVote) {
    return {
      title: <>🎉 투표 완료! <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">첫 표</span>를 남겼어요</>,
      subtitle: '표가 더 모이면 결과가 달라질 수 있어요 ✨',
    }
  }
  if (isDraw) {
    return {
      title: <>🤝 <span className="bg-gradient-to-r from-gray-600 to-gray-500 bg-clip-text text-transparent">무승부</span>! {totalVotes}표로 팽팽해요</>,
      subtitle: '당신의 선택이 균형을 만들고 있어요 ✨',
    }
  }
  if (isEarlyVote) {
    return userWins
      ? {
          title: <>👀 지금은 <span className="bg-gradient-to-r from-amber-500 to-yellow-400 bg-clip-text text-transparent">{winLabel}</span> 쪽이 앞서고 있어요</>,
          subtitle: `아직 ${totalVotes}표 — 표가 더 모이면 바뀔 수 있어요`,
        }
      : {
          title: <>💪 <span className="text-gray-700">{winLabel}</span>가 앞서지만, 역전 여지는 충분해요</>,
          subtitle: `현재 ${totalVotes}표 · 소수파의 선택도 빛날 수 있어요 🌟`,
        }
  }
  return userWins
    ? {
        title: <>🎊 <span className="bg-gradient-to-r from-amber-500 to-yellow-400 bg-clip-text text-transparent">{winLabel}</span>의 승리! 당신과 같은 선택이에요 🎊</>,
        subtitle: '당신의 안목이 다수와 일치했어요 ✨',
      }
    : {
        title: <>🔥 <span className="text-gray-700">{winLabel}</span>의 승리! 당신의 개성은 빛나요</>,
        subtitle: '소수파의 독보적인 취향 🌟',
      }
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

// ─────────────────────────────────────────────────────────────────
export function MatchupDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, profile: myProfile, fetchProfile } = useAuthStore()
  const { showToast, openLoginModal, openChallengeDrawer, openCreateDrawerForEdit, openCreateDrawer } = useUIStore()

  const [lnbOpen, setLnbOpen] = useState(false)
  const feedCategories = useMatchupsFeedCategories()
  const filterParam = searchParams.get('filter')
  const filter = VALID_MATCHUPS_FEED_FILTERS.includes(filterParam) ? filterParam : 'active'

  const [matchup, setMatchup] = useState(null)
  /** loading | ready | not_found — matchup null이어도 로딩 스켈레톤과 구분 */
  const [matchupLoadStatus, setMatchupLoadStatus] = useState('loading')
  const [authorProfile, setAuthorProfile] = useState(null)
  const [userVote, setUserVote] = useState(null)
  const [voteLocked, setVoteLocked] = useState(false)
  /** 첫 투표 제출 중 — Netlify `/api/vote` 등 왕복 동안 UI 멈춤 완화 */
  const [voteSubmitting, setVoteSubmitting] = useState(false)
  const [liked, setLiked] = useState(false)
  const [comments, setComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  /** null이면 아직 집계 미조회 — 배지는 matchup.comments_count 폴백 */
  const [commentsTotal, setCommentsTotal] = useState(null)
  const [commentsHasOlder, setCommentsHasOlder] = useState(false)
  const [commentsLoadingMore, setCommentsLoadingMore] = useState(false)
  const commentsLoadedOffsetRef = useRef(0)
  const commentsTotalRef = useRef(null)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [submittingReplyFor, setSubmittingReplyFor] = useState(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [showResultModal, setShowResultModal] = useState(false)
  const [resultVotedSide, setResultVotedSide] = useState(null)
  const [showSharePromptModal, setShowSharePromptModal] = useState(false)
  const [showRecruitShareModal, setShowRecruitShareModal] = useState(false)
  const [hasConfirmedShare, setHasConfirmedShare] = useState(false)
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)
  const [hasClickedFinalize, setHasClickedFinalize] = useState(false)
  const [fireworkTrigger, setFireworkTrigger] = useState(0)
  const [fireworkPos, setFireworkPos] = useState({ x: 0, y: 0 })
  const [showUploadGuide, setShowUploadGuide] = useState(false)
  const scrolledAuthorPanelRef = useRef(false)
  const [reportModal, setReportModal] = useState(null)
  const [reportReason, setReportReason] = useState('')
  const [submittingReport, setSubmittingReport] = useState(false)
  const lastCommentAtRef = useRef(0)
  const fetchMatchupRef = useRef(null)
  const commentTextareaRef = useRef(null)

  const timer = useCountdown(matchup?.expires_at)
  const userTier = getTier(myProfile || {})
  const commentTree = useMemo(() => nestComments(comments), [comments])
  const commentCountDisplay = commentsTotal ?? matchup?.comments_count ?? comments.length

  // 팬덤 티어는 fandom_points에서 역산 (profile.fandom_tier가 DB에 스테일 값으로 남을 수 있어 신뢰하지 않음)
  const myFandomTier = useMemo(() => {
    const claps = Math.floor((myProfile?.fandom_points ?? 0) / FANDOM_POINTS_PER_CLAP)
    return fandomTierFromClaps(claps)
  }, [myProfile?.fandom_points])

  const handleSnsShare = useCallback(
    async (platformId) => {
      if (!matchup) return
      await shareMatchupToSns(platformId, {
        title: matchup.title,
        description: matchup.description || '',
        url: typeof window !== 'undefined' ? window.location.href : '',
        imageUrl: getMatchupShareImageUrl(matchup, safeMediaUrl),
        matchup,
        safeMediaUrlFn: safeMediaUrl,
        showToast,
      })
    },
    [matchup, showToast]
  )

  // 투표 수 갱신: Realtime 대신 45초 폴링 (탭 visible일 때만)
  useEffect(() => {
    if (!id || !canLoadMatchupFromDb(id)) return undefined
    let cancelled = false
    const poll = async () => {
      if (cancelled || document.visibilityState !== 'visible') return
      const { data } = await supabase
        .from('matchups')
        .select('left_votes, right_votes, total_votes, comments_count, likes_count, status, expires_at')
        .eq('id', id)
        .maybeSingle()
      if (!cancelled && data) {
        setMatchup((prev) => (prev?.id === id ? { ...prev, ...data } : prev))
      }
    }
    void poll()
    const intervalId = window.setInterval(poll, 45_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void poll()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [id])

  /** 조기 return 위에 두어야 함 — 그 아래에 두면 스켈레톤 vs 본문에서 훅 개수가 달라져 크래시 */
  const handleEditAuthorSide = useCallback(() => {
    if (!matchup || !user) return
    if (matchup.right_type != null || (matchup.total_votes || 0) > 0) {
      showToast('매치업이 완료된 뒤에는 수정할 수 없어요.', 'info')
      return
    }
    if (user.id !== matchup.user_id) return
    if (hasClickedFinalize) return
    openCreateDrawerForEdit(matchup)
  }, [matchup, user, hasClickedFinalize, openCreateDrawerForEdit, showToast])

  const category = useMemo(() => {
    if (matchup?.category) {
      for (const item of feedCategories) {
        if (item.id === 'all') continue
        const vals = storedCategoryValuesForFilter(item.id)
        if (vals.includes(String(matchup.category))) return item.id
      }
    }
    return readInitialMatchupsFeedCategory()
  }, [matchup?.category, feedCategories])

  const activeCategoryLabel = useMemo(
    () => feedCategories.find((c) => c.id === category)?.label ?? '전체 매치',
    [feedCategories, category],
  )

  const lnbProps = useMemo(
    () => ({
      category,
      filter,
      feedCategories,
      user,
      onCategoryChange: (catId) => {
        setLnbOpen(false)
        navigate(buildMatchupsListUrl({ filter, category: catId }))
      },
      onFilterChange: (filterId) => {
        setLnbOpen(false)
        navigate(buildMatchupsListUrl({ filter: filterId, category }))
      },
      onCreateClick: () => {
        setLnbOpen(false)
        user ? openCreateDrawer() : openLoginModal()
      },
    }),
    [category, filter, feedCategories, user, navigate, openCreateDrawer, openLoginModal],
  )

  const lnbLayoutProps = {
    lnbProps,
    mobileOpen: lnbOpen,
    onMobileOpenChange: setLnbOpen,
    activeCategoryLabel,
    mobileToolbar: (
      <div className="lg:hidden -mx-4 px-4 sm:mx-0 sm:px-0 mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex shrink-0 items-center gap-1.5 px-3.5 py-2 rounded-xl border border-violet-200/60 bg-gradient-to-r from-white to-violet-50/60 text-sm font-bold text-violet-700/80 hover:text-violet-900 hover:border-violet-300/70 hover:shadow-sm shadow-[0_1px_4px_rgba(139,92,246,0.08)] transition-all active:scale-95"
        >
          <ArrowLeft size={14} /> 돌아가기
        </button>
        <MatchupsFeedLnbMobileTrigger
          activeCategoryLabel={activeCategoryLabel}
          onOpen={() => setLnbOpen(true)}
          className="ml-auto min-w-0 max-w-[calc(100%-8.5rem)]"
        />
      </div>
    ),
  }

  const fetchMatchup = async () => {
    if (!canLoadMatchupFromDb(id)) {
      setMatchup(null)
      setAuthorProfile(null)
      setMatchupLoadStatus('not_found')
      return
    }

    setMatchupLoadStatus('loading')
    let { data, error } = await supabase
      .from('matchups')
      .select(MATCHUP_DETAIL_SELECT)
      .eq('id', id)
      .single()

    if (error && shouldRetryMatchupDetailSelect(error)) {
      const retry = await supabase
        .from('matchups')
        .select(MATCHUP_DETAIL_SELECT_FALLBACK)
        .eq('id', id)
        .single()
      data = retry.data
      error = retry.error
    }

    if (error || !data) {
      console.warn('[MatchupDetailPage] fetchMatchup:', error?.message || 'no data')
      setMatchup(null)
      setAuthorProfile(null)
      setMatchupLoadStatus('not_found')
      return
    }

    // 1) 티어 RPC 전에 본문·미디어를 먼저 반영해 체감 로딩 단축
    const base = {
      ...data,
      _creatorRankInfo: { ...EMPTY_TIER_RANK_INFO },
    }
    setMatchup(base)
    setAuthorProfile(data.profiles)
    setMatchupLoadStatus('ready')

    const pid = data.profiles?.id
    if (!pid) return

    const map = await fetchCreatorRankMapForIds([pid])
    setMatchup((prev) => {
      if (!prev || prev.id !== data.id) return prev
      return {
        ...prev,
        _creatorRankInfo: map[pid] || { ...EMPTY_TIER_RANK_INFO },
      }
    })
  }
  fetchMatchupRef.current = fetchMatchup

  useEffect(() => {
    const onMatchupUpdated = (e) => {
      const mid = e?.detail?.matchupId
      if (!mid || String(mid) !== String(id)) return
      void fetchMatchupRef.current?.()
    }
    window.addEventListener('vics:matchup:updated', onMatchupUpdated)
    return () => window.removeEventListener('vics:matchup:updated', onMatchupUpdated)
  }, [id])
  const fetchUserVote = async () => {
    const { data } = await supabase.from('votes').select('side').eq('user_id', user.id).eq('matchup_id', id).maybeSingle()
    if (data) { setUserVote(data.side); setVoteLocked(true) }
  }
  const fetchUserLike = async () => {
    const { data } = await supabase.from('likes').select('id').eq('user_id', user.id).eq('matchup_id', id).maybeSingle()
    setLiked(!!data)
  }

  const fetchCommentsReset = useCallback(async () => {
    if (!canLoadMatchupFromDb(id)) {
      setComments([])
      setCommentsTotal(null)
      commentsTotalRef.current = null
      setCommentsHasOlder(false)
      commentsLoadedOffsetRef.current = 0
      setCommentsLoading(false)
      return
    }
    setCommentsLoading(true)
    commentsLoadedOffsetRef.current = 0
    try {
      const { rowsAsc, totalCount, fetched, error } = await fetchMatchupCommentsWindow({
        matchupId: id,
        offset: 0,
        limit: MATCHUP_COMMENTS_INITIAL_LIMIT,
        withTotal: true,
      })
      if (error) throw error
      setComments(rowsAsc)
      if (typeof totalCount === 'number') {
        setCommentsTotal(totalCount)
        commentsTotalRef.current = totalCount
        setCommentsHasOlder(totalCount > fetched)
      } else {
        setCommentsTotal(null)
        commentsTotalRef.current = null
        setCommentsHasOlder(fetched >= MATCHUP_COMMENTS_INITIAL_LIMIT)
      }
      commentsLoadedOffsetRef.current = fetched
    } catch {
      showToast('댓글을 불러오지 못했어요', 'error')
      setComments([])
      setCommentsTotal(null)
      commentsTotalRef.current = null
      setCommentsHasOlder(false)
      commentsLoadedOffsetRef.current = 0
    } finally {
      setCommentsLoading(false)
    }
  }, [id, showToast])

  const loadOlderComments = useCallback(async () => {
    if (!id || commentsLoadingMore || !commentsHasOlder) return
    setCommentsLoadingMore(true)
    try {
      const off = commentsLoadedOffsetRef.current
      const { rowsAsc, fetched, error } = await fetchMatchupCommentsWindow({
        matchupId: id,
        offset: off,
        limit: MATCHUP_COMMENTS_MORE_LIMIT,
        withTotal: false,
      })
      if (error) throw error
      if (!fetched) {
        setCommentsHasOlder(false)
        return
      }
      setComments((prev) => {
        const seen = new Set(prev.map((c) => c.id))
        return [...rowsAsc.filter((c) => !seen.has(c.id)), ...prev]
      })
      commentsLoadedOffsetRef.current += fetched
      const total = commentsTotalRef.current
      if (typeof total === 'number') {
        setCommentsHasOlder(total > commentsLoadedOffsetRef.current)
      } else {
        setCommentsHasOlder(fetched >= MATCHUP_COMMENTS_MORE_LIMIT)
      }
    } catch {
      showToast('이전 댓글을 불러오지 못했어요', 'error')
    } finally {
      setCommentsLoadingMore(false)
    }
  }, [id, commentsLoadingMore, commentsHasOlder, showToast])

  useEffect(() => {
    if (!canLoadMatchupFromDb(id)) {
      setMatchup(null)
      setAuthorProfile(null)
      setMatchupLoadStatus('not_found')
      return
    }
    setMatchup(null)
    setAuthorProfile(null)
    setMatchupLoadStatus('loading')
    void fetchMatchup()
    if (user?.id) {
      void Promise.all([fetchUserVote(), fetchUserLike()])
    } else {
      setUserVote(null)
      setVoteLocked(false)
      setLiked(false)
    }
  }, [id, user?.id])

  useEffect(() => {
    scrolledAuthorPanelRef.current = false
  }, [id])

  /** NEW 매치업 작성자 — 태그·공유·최종 버튼이 가이드라인 아래에 가려지지 않도록 1회 스크롤 */
  useEffect(() => {
    if (scrolledAuthorPanelRef.current) return
    if (matchupLoadStatus !== 'ready' || !matchup || matchup.right_type != null) return
    if (!user?.id || user.id !== matchup.user_id) return
    scrolledAuthorPanelRef.current = true
    requestAnimationFrame(() => {
      document.getElementById('matchup-new-author-panel')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }, [matchupLoadStatus, matchup, user?.id])

  /** 본문 표시 후 댓글 로드 — 상단 매치업·투표 UI가 먼저 그려지도록 */
  useEffect(() => {
    if (matchupLoadStatus !== 'ready' || !canLoadMatchupFromDb(id)) return
    void fetchCommentsReset()
  }, [id, matchupLoadStatus, fetchCommentsReset])
  const handleComment = async (e) => {
    e.preventDefault()
    if (!user) { openLoginModal(); return }
    if (!commentText.trim() || submittingComment) return

    // 댓글 도배 방지: 10초 이내 연속 작성 금지
    const now = Date.now()
    if (now - lastCommentAtRef.current < 10000) {
      const remain = Math.ceil((10000 - (now - lastCommentAtRef.current)) / 1000)
      showToast(`${remain}초 후에 다시 댓글을 작성할 수 있어요`, 'error')
      return
    }

    setSubmittingComment(true)
    void reportSuspiciousInputIfNeeded([commentText.trim()], { userId: user?.id, path: window.location.pathname })
    try {
      const { data, error } = await supabase.from('comments').insert({
        user_id: user.id, matchup_id: id, content: commentText.trim(),
      }).select(MATCHUP_COMMENT_SELECT).single()

      if (error) {
        if (error.message?.includes('금칙어')) {
          showToast(error.message, 'error')
        } else if (error.message?.includes('10초') || error.code === 'P0001') {
          showToast('10초 이내에 연속으로 댓글을 작성할 수 없어요', 'error')
        } else {
          showToast('댓글 작성에 실패했어요', 'error')
        }
        return
      }
      if (data) {
        lastCommentAtRef.current = now
        setComments((p) => [...p, data])
        setCommentText('')
        setCommentsTotal((t) => {
          const next = typeof t === 'number' ? t + 1 : t
          if (typeof next === 'number') commentsTotalRef.current = next
          return next
        })
        setMatchup((p) => ({ ...p, comments_count: (p.comments_count || 0) + 1 }))
      }
    } catch { showToast('댓글 작성에 실패했어요', 'error') }
    finally { setSubmittingComment(false) }
  }

  const handleReply = async (parentId, text) => {
    if (!user) { openLoginModal(); return false }
    const trimmed = text.trim()
    if (!trimmed || submittingReplyFor) return false

    const now = Date.now()
    if (now - lastCommentAtRef.current < 10000) {
      const remain = Math.ceil((10000 - (now - lastCommentAtRef.current)) / 1000)
      showToast(`${remain}초 후에 다시 댓글을 작성할 수 있어요`, 'error')
      return false
    }

    setSubmittingReplyFor(parentId)
    try {
      const { data, error } = await supabase.from('comments').insert({
        user_id: user.id,
        matchup_id: id,
        content: trimmed,
        parent_id: parentId,
      }).select(MATCHUP_COMMENT_SELECT).single()

      if (error) {
        if (error.message?.includes('금칙어')) {
          showToast(error.message, 'error')
        } else if (error.message?.includes('10초') || error.code === 'P0001') {
          showToast('10초 이내에 연속으로 댓글을 작성할 수 없어요', 'error')
        } else {
          showToast('답글 작성에 실패했어요', 'error')
        }
        return false
      }
      if (data) {
        lastCommentAtRef.current = now
        setComments((p) => [...p, data])
        setCommentsTotal((t) => {
          const next = typeof t === 'number' ? t + 1 : t
          if (typeof next === 'number') commentsTotalRef.current = next
          return next
        })
        setMatchup((p) => ({ ...p, comments_count: (p.comments_count || 0) + 1 }))
        showToast('답글이 등록됐어요', 'success')
        return true
      }
    } catch {
      showToast('답글 작성에 실패했어요', 'error')
    } finally {
      setSubmittingReplyFor(null)
    }
    return false
  }

  const handleDeleteComment = async (commentId) => {
    const { error } = await supabase.from('comments').delete().eq('id', commentId)
    if (error) {
      showToast('삭제에 실패했어요', 'error')
      return
    }
    await fetchCommentsReset()
    await fetchMatchup()
  }
  const handleVote = async (side, e) => {
    if (!user) return
    if (voteSubmitting) return
    if (!matchup?.right_type || timer?.expired || matchup?.challenger_forfeit_at) return
    if (tierAtLeast(userTier, 'master') && e) {
      setFireworkPos({ x: e.clientX, y: e.clientY })
      setFireworkTrigger((t) => t + 1)
    }
    if (!userVote) {
      setVoteSubmitting(true)
      try {
        const result = await voteViaApi(id, side)
        if (result.error) {
          showToast(result.error, 'error')
          return
        }
        setUserVote(side)
        setVoteLocked(true)
        setMatchup((p) => ({
          ...p,
          left_votes:  side === 'left'  ? (p.left_votes  || 0) + 1 : p.left_votes,
          right_votes: side === 'right' ? (p.right_votes || 0) + 1 : p.right_votes,
          total_votes: (p.total_votes || 0) + 1,
        }))
        showToast('투표 완료! 매치업 종료 후 결과에 따라 포인트가 지급돼요', 'success')
        setResultVotedSide(side)
        setTimeout(() => setShowResultModal(true), 350)
        setTimeout(() => fetchProfile(user.id, { force: true }), 800)
      } catch (err) {
        showToast(err?.message || '투표 중 오류가 발생했어요', 'error')
      } finally {
        setVoteSubmitting(false)
      }
    }
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

  const openReportModal = useCallback((side) => {
    if (!user) {
      openLoginModal()
      return
    }
    setReportReason('')
    setReportModal({ side })
  }, [user, openLoginModal])

  const handleSubmitMatchupReport = async () => {
    if (!reportModal?.side || !matchup?.id || !user) return
    setSubmittingReport(true)
    try {
      const { penalized, moderationFailed } = await submitMatchupReportAndRunModeration({
        matchupId: matchup.id,
        reportedSide: reportModal.side,
        reason: reportReason.trim() || null,
      })
      setReportModal(null)
      setReportReason('')
      if (penalized) {
        showToast('신고 누적 및 AI 판정으로 챌린저 몰수패·300P 차감이 적용되었어요.', 'success')
        await fetchMatchup()
        if (user.id === matchup.right_user_id) void fetchProfile(user.id, { force: true })
        window.dispatchEvent(new CustomEvent('vics:matchup:updated', { detail: { matchupId: matchup.id } }))
      } else if (moderationFailed) {
        showToast('신고는 접수했어요. 자동 검사 연결에 문제가 있으면 운영에서 확인할 수 있어요.', 'info')
      } else {
        showToast('신고가 접수되었어요.', 'success')
      }
    } catch (err) {
      showToast(err?.message || '신고 처리 중 오류가 발생했어요', 'error')
    } finally {
      setSubmittingReport(false)
    }
  }

  // 최종 매치업 만들기 (User A 전용, B 업로드 완료 시)
  const handleFinalizeMatchup = () => {
    if (!matchup?.right_type || !isMyMatchup) return
    setHasClickedFinalize(true)
    showToast('매치업이 성공적으로 생성되었습니다!', 'success')
    setShowSharePromptModal(true)
  }

  // 삭제 확인 모달 열기 (매치업 최초 작성자만 — A측 작성자, 도전자 B는 사용 불가)
  const openDeleteConfirm = () => {
    if (!isMyMatchup || !matchup?.id || matchup?.right_type) return
    setShowDeleteConfirmModal(true)
  }

  // 삭제 실행 (작성자만 — DB의 user_id가 매치업 연 사람)
  const handleDeleteMatchup = async () => {
    if (!matchup?.id || matchup?.right_type || !user || matchup.user_id !== user.id) return
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

  // ── 로딩 / 없음 ───────────────────────────────────────────────────
  if (matchupLoadStatus === 'loading') {
    return (
      <MatchupsFeedLnbPageLayout {...lnbLayoutProps} className="pb-6">
        <MatchupDetailSkeleton />
      </MatchupsFeedLnbPageLayout>
    )
  }
  if (matchupLoadStatus === 'not_found' || !matchup) {
    return (
      <MatchupsFeedLnbPageLayout {...lnbLayoutProps} className="pb-6">
        <MatchupDetailNotFound
          isDemo={isFeedDemoMatchupId(id)}
          onBack={() => navigate(-1)}
          onHome={() => navigate('/')}
        />
      </MatchupsFeedLnbPageLayout>
    )
  }

  const { left, right } = calcPercent(matchup.left_votes, matchup.right_votes)
  const isComplete  = matchup.right_type != null
  const challengerForfeit = Boolean(matchup.challenger_forfeit_at)
  const isExpired   = timer?.expired || challengerForfeit
  const isMyMatchup = user?.id === matchup.user_id
  const canAuthorEdit = isMyMatchup && !hasClickedFinalize
  const showResults = isComplete && (userVote !== null || (matchup.total_votes || 0) > 0)

  const detailVipFrame =
    !isFeedBannerHighlightActive(matchup) &&
    isMatchupCreatorVipTierGlow(matchup.profiles, matchup._creatorRankInfo)

  const leftLabel = matchup.left_label || 'A'
  const rightLabel = matchup.right_label || 'B'
  const ogTitle = `${leftLabel} vs ${rightLabel} 경쟁 중!`
  const ogDesc = `누가 누구와 경쟁 중! ${leftLabel}와 ${rightLabel}, VICS에서 투표해보세요`
  const ogImage = getMatchupShareImageUrl(matchup, safeMediaUrl)
  const ogUrl = typeof window !== 'undefined' ? window.location.href : ''

  const newMatchupAuthorPanel = !isComplete ? (
    <div
      id="matchup-new-author-panel"
      className="mt-5 pt-4 space-y-4 border-t border-violet-100/55 scroll-mt-24"
    >
      {matchup.tags?.length > 0 && (
        <div>
          <p className="text-[10px] font-black text-fuchsia-700 mb-2 flex items-center gap-1.5">
            🏷️ 태그 (작성자 A 설정)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {matchup.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold rounded-full bg-gradient-to-r from-fuchsia-100 to-violet-100 text-fuchsia-700 border border-fuchsia-200/60">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {isMyMatchup && !matchup?.right_type && (
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-950/85 via-teal-950/80 to-cyan-950/75 border border-emerald-500/30 shadow-[0_4px_20px_-6px_rgba(16,185,129,0.4)]">
          <div className="px-4 py-3.5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📣</span>
              <span className="text-sm font-black text-emerald-300 tracking-wide">도전자를 모집해 보세요!</span>
            </div>
            <p className="text-[11px] text-teal-300/80 leading-relaxed mb-3">
              아직 도전자가 없어요. 링크를 공유하면 다른 유저가<br/>
              <span className="font-bold text-emerald-300">⚔️ 도전자(B)로 참여</span>해 매치업을 완성할 수 있어요.
            </p>
            <button
              type="button"
              onClick={() => setShowRecruitShareModal(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white text-xs font-black shadow-[0_4px_14px_-4px_rgba(16,185,129,0.55)] hover:from-emerald-400 hover:to-cyan-400 transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              🔗 링크 공유하기
            </button>
          </div>
        </div>
      )}

      {isMyMatchup && (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 px-3.5 py-3 bg-gradient-to-r from-rose-50/90 via-pink-50/70 to-fuchsia-50/60 border border-rose-200/60 rounded-xl">
            <span className="text-base shrink-0 mt-0.5">📢</span>
            <p className="text-[11px] text-rose-700 leading-relaxed">
              <span className="font-black">&apos;최종 매치업 만들기&apos;</span>를 누르면 즉시 투표가 시작되며 수정이 불가능해요.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canAuthorEdit && (
              <button
                type="button"
                onClick={handleEditAuthorSide}
                disabled={hasClickedFinalize}
                title="작성자(A) 쪽만 수정해요"
                className={cn(
                  'flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-sm font-bold shrink-0 transition-all',
                  hasClickedFinalize
                    ? 'text-violet-300 bg-violet-50/50 cursor-not-allowed'
                    : 'text-amber-700 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 hover:from-amber-100 hover:to-orange-100',
                )}
              >
                <Pencil size={14} />
                A 쪽 수정
              </button>
            )}
            <button
              type="button"
              onClick={handleFinalizeMatchup}
              disabled={!matchup?.right_type}
              className={cn(
                'flex flex-1 min-w-[10rem] items-center justify-center gap-2 py-4 rounded-2xl text-sm font-black tracking-wide transition-all',
                matchup?.right_type
                  ? 'bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-700 text-white shadow-[0_4px_28px_-4px_rgba(139,92,246,0.55)] hover:shadow-[0_4px_40px_-4px_rgba(217,70,239,0.6)] hover:scale-[1.01] active:scale-[0.99]'
                  : 'bg-violet-100/60 text-violet-300 cursor-not-allowed',
              )}
            >
              {matchup?.right_type ? <Zap size={16} className="fill-current" /> : null}
              최종 매치업 만들기
            </button>
          </div>
        </div>
      )}
    </div>
  ) : null

  return (
    <MatchupsFeedLnbPageLayout {...lnbLayoutProps} className="pb-24 lg:pb-8">
      <div className="relative -mx-4 px-4 sm:mx-0 sm:px-0 min-w-0">
      {/* MZ 톤: 바이올렛·퓨시아·민트 앰비언트 */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-3 bottom-0 -z-10 sm:-inset-x-3 sm:rounded-[2rem] bg-gradient-to-b from-violet-500/[0.09] via-fuchsia-400/[0.05] to-cyan-400/[0.11]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 -top-3 h-44 sm:h-52 -z-10 bg-[radial-gradient(ellipse_95%_100%_at_50%_-5%,rgba(139,92,246,0.2),transparent_72%)] sm:rounded-t-[2rem]"
        aria-hidden
      />
      <div className="max-w-3xl mx-auto space-y-5 min-w-0 px-1 sm:px-0 relative z-0">
      {/* 동적 OG 태그 (JS 크롤러/브라우저 탭용, 서버 미들웨어가 크롤러 처리) */}
      <Helmet>
        <title>{ogTitle}</title>
        <meta name="description" content={ogDesc} />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDesc} />
        {ogImage && <meta property="og:image" content={ogImage} />}
        {ogUrl && <meta property="og:url" content={ogUrl} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDesc} />
        {ogImage && <meta name="twitter:image" content={ogImage} />}
      </Helmet>
      {/* ── 삭제 확인 모달 ── */}
      {showDeleteConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && setShowDeleteConfirmModal(false)}
        >
          <div className="w-full max-w-sm bg-gradient-to-br from-white via-violet-50/80 to-fuchsia-50/50 border border-violet-200/50 rounded-2xl shadow-2xl p-6 text-center">
            <p className="text-base font-black text-violet-950 mb-1">매치업을 삭제할까요?</p>
            <p className="text-sm text-gray-500 mb-6">삭제 후에는 복구할 수 없어요.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirmModal(false)}
                className="flex-1 py-3.5 rounded-xl text-sm font-bold bg-violet-100/60 text-violet-800 hover:bg-violet-200/60 transition-colors"
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

      {/* ── 도전자 모집 공유 (NEW 매치업) ── */}
      {showRecruitShareModal && matchup && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && setShowRecruitShareModal(false)}
        >
          <div className="w-full max-w-sm bg-gradient-to-br from-white via-emerald-50/60 to-teal-50/50 border border-emerald-200/45 rounded-t-3xl sm:rounded-2xl shadow-2xl p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <p className="text-base font-black text-emerald-950">📣 도전자 모집 링크 공유</p>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                  공유할 채널을 선택하거나 링크를 복사해 도전자(B)를 모집해 보세요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRecruitShareModal(false)}
                className="shrink-0 p-1.5 rounded-full hover:bg-emerald-100/80 text-emerald-600 transition-colors"
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs font-bold text-emerald-800/80 mb-4 truncate px-1">{matchup.title}</p>
            <div className="grid grid-cols-2 gap-2.5">
              {SNS_LIST.map((sns) => (
                <button
                  key={sns.id}
                  type="button"
                  onClick={() => handleSnsShare(sns.id)}
                  className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] ${sns.color}`}
                >
                  {sns.icon}
                  {sns.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                void handleCopyLink()
              }}
              className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-white border border-emerald-200/70 text-emerald-900 hover:bg-emerald-50 transition-colors"
            >
              {linkCopied
                ? <><Check size={15} className="text-green-500" /><span className="text-green-600">링크 복사됨</span></>
                : <><Link2 size={15} /><span>링크 복사</span></>}
            </button>
            <button
              type="button"
              onClick={() => setShowRecruitShareModal(false)}
              className="mt-3 w-full py-2.5 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* ── 공유 유도 팝업 (최종 매치업 생성 후) ── */}
      {showSharePromptModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && handleCloseSharePrompt()}
        >
          <div className="w-full max-w-sm bg-gradient-to-br from-white via-fuchsia-50/70 to-violet-50/60 border border-fuchsia-200/45 rounded-2xl shadow-2xl p-6 text-center">
            <p className="text-base font-black text-violet-950 mb-2">🎉 당신의 경쟁이 시작되었습니다!</p>
            <p className="text-sm text-gray-500 mb-6">친구들에게 투표를 부탁해보세요.</p>
            <button
              onClick={handleCloseSharePrompt}
              className="w-full py-3.5 rounded-xl text-sm font-black bg-gradient-to-r from-fuchsia-600 via-pink-500 to-rose-500 text-white shadow-[0_0_28px_rgba(236,72,153,0.45)] hover:shadow-[0_0_36px_rgba(236,72,153,0.6)] hover:scale-[1.02] active:scale-[0.98] transition-all"
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

      {/* 뒤로가기 (데스크탑) */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="hidden lg:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-violet-200/60 bg-gradient-to-r from-white to-violet-50/60 text-sm font-bold text-violet-700/80 hover:text-violet-900 hover:border-violet-300/70 hover:shadow-sm shadow-[0_1px_4px_rgba(139,92,246,0.08)] transition-all active:scale-95"
      >
        <ArrowLeft size={14} /> 돌아가기
      </button>

      {/* ══ 메인 카드 ══════════════════════════════════════════════ */}
      <article className={cn(
        'bg-gradient-to-br from-white/95 via-violet-50/70 to-cyan-50/45 border border-violet-200/45 rounded-2xl text-left backdrop-blur-[2px]',
        'shadow-[0_16px_48px_-20px_rgba(139,92,246,0.28)]',
        isComplete ? 'shadow-[0_20px_56px_-18px_rgba(139,92,246,0.32)]' : '',
        detailVipFrame && VIP_MATCHUP_SURFACE_CLASS,
      )}>

        {/* ── 헤더 ───────────────────────────────────────────────── */}
        <header className={cn(isComplete && 'border-b border-violet-100/60', isComplete ? 'px-6 pt-6 pb-5' : '')}>
          {!isComplete ? (
            /* NEW 매치업: 매치업 만들기 폼 레이아웃과 동일 (📌 경쟁 제목, 카테고리, 투표 기간, 🥊 경쟁 구도) */
            <>
              <div className="p-5 pb-8 lg:pb-5 space-y-5">
                {/* 1. 📌 경쟁 제목(중앙·A) + 설명(A | B) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 via-violet-600 to-indigo-600 shadow-[0_3px_12px_-2px_rgba(139,92,246,0.5)] text-sm">📌</span>
                    <span className="text-sm font-black bg-gradient-to-r from-fuchsia-700 via-violet-700 to-indigo-700 bg-clip-text text-transparent">경쟁 제목 · 도전 설명</span>
                    <span className="text-rose-400 text-xs font-black">*</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 text-center px-2">
                    <p className="text-base font-black bg-gradient-to-r from-fuchsia-700 via-violet-700 to-indigo-600 bg-clip-text text-transparent leading-snug">{matchup.title || '—'}</p>
                    <VsBadge variant="minimal" size="sm" animated={false} />
                  </div>
                  <div className="grid grid-cols-[1fr_36px_1fr] gap-2 items-stretch">
                    <div className="space-y-1.5 min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-wide text-amber-600/90">
                        작성자 (A) · 설명
                      </span>
                      <div
                        className={cn(
                          'w-full px-3 py-2.5 text-sm min-h-[4rem] bg-gradient-to-br from-amber-50 to-orange-50/60 border border-amber-200/55 rounded-xl',
                          matchup.description ? 'text-amber-900/80' : 'text-amber-300/70 italic',
                        )}
                      >
                        {matchup.description || '설명 없음'}
                      </div>
                    </div>
                    <div className="flex items-center justify-center">
                      <div className="w-px h-full min-h-[4rem] bg-violet-200/50" />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-wide text-emerald-500">
                        ⚔️ 도전자 (B) · 설명
                      </span>
                      <div
                        className={cn(
                          'w-full px-3 py-2.5 text-sm min-h-[4rem] border border-dashed border-emerald-500/35 rounded-xl',
                          matchup.right_description ? 'bg-emerald-950/70 text-emerald-100' : 'bg-emerald-950/50 text-emerald-400/80 italic',
                        )}
                      >
                        {matchup.right_description || '도전장에서 작성 (선택)'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. 카테고리 + 투표 기간 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black bg-gradient-to-r from-fuchsia-600 to-violet-600 bg-clip-text text-transparent flex items-center gap-1">🏷️ 카테고리</label>
                    <div className="px-3 py-2.5 text-sm bg-gradient-to-br from-fuchsia-50/70 to-violet-50/50 border border-fuchsia-200/50 rounded-xl font-semibold text-fuchsia-800/80">
                      {getCategoryLabelById(matchup.category)}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-1">
                      <Clock size={12} className="text-violet-500" /> 투표 기간
                    </label>
                    <div className="px-3 py-2.5 text-sm bg-gradient-to-br from-violet-50/70 to-indigo-50/50 border border-violet-200/50 rounded-xl font-semibold text-violet-800/80">
                      {matchup.expires_at
                        ? (() => {
                            const h = Math.round((new Date(matchup.expires_at) - new Date(matchup.created_at)) / 3600000)
                            return h >= 48 ? '48시간' : '24시간'
                          })()
                        : '24시간'}
                    </div>
                  </div>
                </div>

                {/* 3. 🥊 경쟁 구도 * */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 via-rose-500 to-fuchsia-600 shadow-[0_3px_12px_-2px_rgba(244,63,94,0.45)] text-sm">🥊</span>
                    <span className="text-sm font-black bg-gradient-to-r from-orange-600 via-rose-600 to-fuchsia-700 bg-clip-text text-transparent">경쟁 구도</span>
                    <span className="text-rose-400 text-xs font-black">*</span>
                  </div>
                  <div className="grid grid-cols-[1fr_36px_1fr] gap-2 items-stretch">
                    {/* A측 = 매치업 최초 작성자 */}
                    <div className="space-y-2">
                      <div className="px-3 py-2 text-xs font-semibold bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/70 rounded-lg">
                        <span className="block text-[10px] font-black uppercase tracking-wide text-amber-600/90">
                          작성자 (A)
                        </span>
                        <span className="mt-0.5 block font-bold text-amber-800">{matchup.left_label || 'A'}</span>
                      </div>
                      <div className="relative aspect-square rounded-xl overflow-hidden bg-amber-50/40 border border-amber-200/40">
                        {matchup.left_type === 'image' && (matchup.left_thumbnail_url || matchup.left_url) && (
                          <img src={safeMediaUrl(matchup.left_thumbnail_url || matchup.left_url)} alt="A" className="absolute inset-0 w-full h-full object-cover" />
                        )}
                        {matchup.left_type === 'video' && matchup.left_url && (
                          <video src={safeMediaUrl(matchup.left_url)} className="absolute inset-0 w-full h-full object-cover" muted playsInline preload="metadata" />
                        )}
                        {matchup.left_type === 'text' && (
                          <div className="absolute inset-0 flex items-center justify-center p-4 bg-gradient-to-br from-amber-900/90 via-orange-950/85 to-rose-950/80">
                            <p className="text-sm font-bold text-center text-amber-100">{matchup.left_text}</p>
                          </div>
                        )}
                        <span className="absolute top-2 left-2 text-[10px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-white px-1.5 py-0.5 rounded-md shadow-sm">
                          A
                        </span>
                      </div>
                    </div>

                    {/* VS */}
                    <div className="flex items-center justify-center mt-8">
                      <VsBadge variant="minimal" size="sm" animated={false} />
                    </div>

                    {/* B측 = 도전자 */}
                    <div className="space-y-2">
                      <div className="px-3 py-2 text-xs font-semibold bg-gradient-to-r from-emerald-950/80 via-teal-950/70 to-cyan-950/75 border border-dashed border-emerald-500/40 rounded-lg">
                        <span className="block text-[10px] font-black uppercase tracking-wide text-emerald-400">
                          ⚔️ 도전자 (B)
                        </span>
                        <span className="mt-0.5 block font-bold text-emerald-200/90">{matchup.right_label || 'B'}</span>
                      </div>
                      <div className="relative aspect-square rounded-xl border-2 border-dashed border-emerald-500/40 bg-gradient-to-br from-emerald-950/88 via-teal-950/78 to-cyan-950/82 flex flex-col items-center justify-center gap-3 px-3">
                        <div className="flex flex-col items-center gap-1.5">
                          <span className="text-xl">⚔️</span>
                          <span className="text-[11px] font-black text-emerald-300 tracking-wide">도전자 모집 중</span>
                          <span className="text-[9px] text-teal-400/70 text-center">아직 상대방이 없어요</span>
                        </div>
                        {!isMyMatchup && (
                          user ? (
                            <button
                              onClick={() => openChallengeDrawer(matchup)}
                              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white text-xs font-black rounded-xl hover:from-emerald-400 hover:to-cyan-400 shadow-[0_4px_16px_-4px_rgba(16,185,129,0.6)] transition-all hover:scale-105 active:scale-95"
                            >
                              <Swords size={13} /> 도전하기
                            </button>
                          ) : (
                            <button
                              onClick={openLoginModal}
                              className="flex items-center gap-1.5 px-3 py-2 border-2 border-emerald-500/70 text-emerald-300 text-xs font-black rounded-xl hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-colors"
                            >
                              <Swords size={13} /> 로그인하고 도전
                            </button>
                          )
                        )}
                        {isMyMatchup && (
                          <span className="text-[9px] text-teal-400/60 text-center px-2 leading-relaxed">공유해서 도전자를<br/>모집해 보세요!</span>
                        )}
                        <span className="absolute top-2 left-2 text-[10px] font-black bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-1.5 py-0.5 rounded-md shadow-sm">B</span>
                      </div>
                    </div>
                  </div>
                </div>

                {newMatchupAuthorPanel}

                {/* 콘텐츠 업로드 가이드라인 (CreateMatchupDrawer와 동일 스타일) */}
                <div className="mt-5 rounded-2xl border border-violet-200/50 bg-gradient-to-br from-violet-100/40 via-fuchsia-50/50 to-cyan-50/40 shadow-[0_4px_20px_-4px_rgba(139,92,246,0.15)] ring-1 ring-white/60">
                  <button
                    type="button"
                    onClick={() => setShowUploadGuide(!showUploadGuide)}
                    className={cn(
                      'w-full flex items-center justify-between px-4 py-3.5 text-left transition-all duration-200',
                      'bg-gradient-to-r from-violet-500/15 via-fuchsia-500/10 to-teal-500/15',
                      'hover:from-violet-500/25 hover:via-fuchsia-500/15 hover:to-teal-500/20',
                      showUploadGuide && 'from-violet-500/20 via-fuchsia-500/12 to-teal-500/18'
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
                        showUploadGuide && 'rotate-180'
                      )}
                    />
                  </button>
                  {showUploadGuide && (
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
              </div>
            </>
          ) : (
            /* 완료된 매치업: 베스트/추천 이미지 형식 (제목, 날짜, 설명) */
            <>
              <div className="px-6 pt-6 pb-5 space-y-4">
                <p className="text-sm text-violet-400/90">{formatDate(matchup.created_at)}</p>
                <div className="flex flex-col items-center gap-2 text-center">
                  <h1 className="text-xl sm:text-2xl font-black leading-snug bg-gradient-to-r from-violet-700 via-fuchsia-600 to-violet-700 bg-clip-text text-transparent">
                    {matchup.title}
                  </h1>
                  <VsBadge variant="minimal" size="sm" animated={false} />
                </div>
                {(matchup.description || matchup.right_description) && (
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start pt-1">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-wide text-violet-600/90 mb-1">
                        {matchup.left_label || 'A'} · 설명
                      </p>
                      {matchup.description ? (
                        <p className="text-sm text-gray-500 leading-relaxed">{matchup.description}</p>
                      ) : (
                        <p className="text-sm text-gray-300 italic">—</p>
                      )}
                    </div>
                    <div className="w-px self-stretch min-h-[2rem] bg-violet-200/60" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-wide text-fuchsia-600/90 mb-1">
                        {matchup.right_label || 'B'} · 도전 설명
                      </p>
                      {matchup.right_description ? (
                        <p className="text-sm text-gray-500 leading-relaxed">{matchup.right_description}</p>
                      ) : (
                        <p className="text-sm text-gray-300 italic">—</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </header>

        {/* ── 경쟁 영역 (완료된 매치업만) ──────────────────────────────────────────── */}
        {isComplete && (
        <section className="px-5 py-6">
          {challengerForfeit && (
            <div className="mb-4 rounded-xl border border-rose-200/80 bg-rose-50 px-4 py-3 text-center text-sm font-semibold text-rose-900 leading-relaxed">
              이 경쟁은 커뮤니티 가이드 위반으로 <strong>챌린저(B) 몰수패</strong>가 적용되었어요. (도전자 300P 차감)
            </div>
          )}
          {!isExpired && (
            <p className="text-xs text-gray-400 mb-3 text-center">투표는 1회 확정 (변경 불가)</p>
          )}

          {/* 옵션 + VS 뱃지 (베스트/추천 형식: 아바타+이름 카드 위) */}
          <div className="relative grid grid-cols-2 gap-3 sm:gap-5">
            {/* A측 = 작성자(매치업 연 사람) */}
            <OptionCard
              side="left"
              matchup={matchup}
              sideProfile={authorProfile || matchup.profiles}
              userVote={userVote}
              voteLocked={voteLocked}
              voteSubmitting={voteSubmitting}
              isExpired={isExpired}
              isComplete={isComplete}
              onVote={handleVote}
              user={user}
              percent={left}
              showResult={showResults}
              variant="best"
              onRequestReport={openReportModal}
              forfeitApplied={challengerForfeit}
            />

            {/* B측 = 도전자 */}
            {isComplete ? (
              <OptionCard
                side="right"
                matchup={matchup}
                sideProfile={matchup.right_profiles}
                userVote={userVote}
                voteLocked={voteLocked}
                voteSubmitting={voteSubmitting}
                isExpired={isExpired}
                isComplete={isComplete}
                onVote={handleVote}
                user={user}
                percent={right}
                showResult={showResults}
                variant="best"
                onRequestReport={openReportModal}
                forfeitApplied={challengerForfeit}
              />
            ) : (
              <ChallengerSlot
                user={user}
                isMyMatchup={isMyMatchup}
                onChallenge={() => openChallengeDrawer(matchup)}
                onLogin={openLoginModal}
              />
            )}

            {/* VS 뱃지 (청·적 대비 + 모션) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <VsBadge size="lg" className="z-20" />
            </div>
          </div>

          {/* 완료된 매치업: 카운트다운(진행 중일 때만) + 총 투표수 */}
          {isComplete && (
            <>
              {matchup?.expires_at && timer && !timer.expired && !challengerForfeit && (
                <div className="mt-5 pt-5 border-t border-violet-100/55">
                  <div className="bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-white rounded-xl px-5 py-4 text-center shadow-[0_8px_28px_-6px_rgba(251,146,60,0.45)]">
                    <p className="text-xs text-white/90 mb-1">투표 마감까지 남은 시간</p>
                    <p className="text-2xl sm:text-3xl font-black font-mono tabular-nums tracking-wider">
                      {String(timer.h).padStart(2, '0')}:{String(timer.m).padStart(2, '0')}:{String(timer.s).padStart(2, '0')}
                    </p>
                  </div>
                </div>
              )}
              <div className={`flex items-center justify-center gap-2 ${matchup?.expires_at && timer && !timer.expired && !challengerForfeit ? 'mt-4' : 'mt-5 pt-5 border-t border-violet-100/55'}`}>
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-100/80 to-fuchsia-100/70 border border-violet-200/50">
                  <Users size={14} className="text-violet-500" />
                  <span className="text-sm font-black bg-gradient-to-r from-violet-800 to-fuchsia-700 bg-clip-text text-transparent">
                    총 투표수: {formatNumber(matchup.total_votes || 0)}
                  </span>
                </span>
              </div>
            </>
          )}
        </section>
        )}

        {/* ── 액션 바 (완료된 매치업만) ───────────────────────────────────────────────── */}
        {isComplete && (
          <>
            <footer className="px-5 pb-5 pt-3 border-t border-violet-100/55">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleLike}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all select-none ${
                    liked
                      ? 'bg-red-50 text-red-500 scale-105 shadow-sm'
                      : 'bg-violet-50/70 text-violet-600/80 hover:bg-red-50 hover:text-red-400'
                  }`}
                >
                  <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
                  {formatNumber(matchup.likes_count || 0)}
                </button>
                <a href="#comments" className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-violet-600/85 bg-violet-50/60 hover:bg-violet-100/70 transition-colors">
                  💬 {commentCountDisplay}
                </a>
                <span className="text-xs text-gray-400 font-medium">친구들에게 공유하기</span>
                {SNS_LIST.map((sns) => (
                  <button
                    key={sns.id}
                    onClick={() => handleSnsShare(sns.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95 ${sns.color}`}
                  >
                    {sns.icon}
                    {sns.label}
                  </button>
                ))}
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-white/70 border border-violet-200/40 text-violet-800/90 hover:bg-violet-50 transition-colors"
                >
                  {linkCopied
                    ? <><Check size={14} className="text-green-500" /><span className="text-green-600">복사됨</span></>
                    : <><Link2 size={14} /><span>링크 복사</span></>}
                </button>
              </div>
            </footer>
          </>
        )}
      </article>

      {isComplete && matchup && (
        <div className="px-1 sm:px-0">
          <MatchupVoteStatsSection
            matchupId={matchup.id}
            matchupUserId={matchup.user_id}
            currentUserId={user?.id}
            leftLabel={matchup.left_label}
            rightLabel={matchup.right_label}
            expiresAt={matchup.expires_at}
          />
        </div>
      )}

      {/* ══ 댓글 섹션 (완료된 매치업만) ──────────────────────────────────────────── */}
      {isComplete && (
        <section
          id="comments"
          className="bg-gradient-to-br from-white/90 via-violet-50/55 to-fuchsia-50/35 border border-violet-200/45 rounded-2xl overflow-hidden shadow-[0_16px_44px_-18px_rgba(139,92,246,0.22)] backdrop-blur-[2px]"
        >
          <div className="px-5 pt-5 pb-4 border-b border-violet-100/55 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 shadow-[0_3px_12px_-2px_rgba(168,85,247,0.45)] shrink-0">
              <span className="text-sm">💬</span>
            </span>
            <div className="flex items-baseline gap-2">
              <h2 className="text-base font-black bg-gradient-to-r from-violet-700 via-fuchsia-600 to-cyan-600 bg-clip-text text-transparent">
                댓글
              </h2>
              <span className="text-sm text-violet-400/70 font-semibold tabular-nums">
                {commentsLoading
                  ? '…'
                  : (commentsTotal != null && commentsTotal > comments.length)
                    ? `${comments.length} / ${commentsTotal}`
                    : (commentsHasOlder
                      ? `${comments.length}+`
                      : commentCountDisplay)}
              </span>
            </div>
          </div>

          <div className="px-5 pt-4 pb-4 border-b border-violet-100/55">
            <div className="flex items-start gap-3">
              <Avatar src={myProfile?.avatar_url} alt={myProfile?.nickname} size="sm" className="mt-0.5" />
              <div className="flex-1 space-y-2">
                <textarea
                  ref={commentTextareaRef}
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
                  className="w-full bg-white/75 border border-violet-200/50 rounded-xl px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/25 focus:bg-white transition-all resize-none placeholder:text-violet-300/90"
                />
                <FandomGoldExclusiveEmojiBar
                  tierId={myFandomTier}
                  textareaRef={commentTextareaRef}
                  value={commentText}
                  onChange={setCommentText}
                  maxLength={500}
                  onTooLong={() => showToast('댓글은 500자까지 입력할 수 있어요', 'error')}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-300">{commentText.length} / 500</span>
                  <button
                    onClick={handleComment}
                    disabled={!commentText.trim() || submittingComment || !user}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-xs font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:from-violet-500 hover:to-fuchsia-500 shadow-[0_4px_20px_-4px_rgba(139,92,246,0.45)] active:scale-95 transition-all"
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
            {!commentsLoading && commentsHasOlder && (
              <div className="flex justify-center -mt-1 mb-1">
                <button
                  type="button"
                  onClick={() => void loadOlderComments()}
                  disabled={commentsLoadingMore}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-violet-200/80 bg-white/80 text-violet-700 hover:bg-violet-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {commentsLoadingMore ? '불러오는 중…' : '이전 댓글 더보기'}
                </button>
              </div>
            )}
            {commentsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-violet-200/40 flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-16 bg-violet-200/40 rounded" />
                      <div className="h-2.5 w-14 bg-fuchsia-200/35 rounded" />
                    </div>
                    <div className="h-12 bg-violet-100/50 rounded-xl" />
                  </div>
                </div>
              ))
            ) : comments.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-4xl mb-2">💬</p>
                <p className="text-sm font-medium text-gray-400">첫 번째 댓글을 남겨보세요!</p>
                <p className="text-xs text-gray-300 mt-1">여러분의 의견이 궁금해요</p>
              </div>
            ) : (
              commentTree.map((node) => (
                <CommentItem
                  key={node.id}
                  node={node}
                  depth={0}
                  currentUserId={user?.id}
                  user={user}
                  composerFandomTier={myFandomTier}
                  openLoginModal={openLoginModal}
                  onDelete={handleDeleteComment}
                  onSubmitReply={handleReply}
                  submittingReplyFor={submittingReplyFor}
                />
              ))
            )}
          </div>
        </section>
      )}

      <Modal
        isOpen={!!reportModal}
        onClose={() => !submittingReport && setReportModal(null)}
        title={reportModal?.side === 'left' ? `${leftLabel} 측 신고` : `${rightLabel} 측 신고`}
        className="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            허위·악의 신고는 제재 대상이 될 수 있어요. 부적절한 콘텐츠만 신고해 주세요.
          </p>
          <div>
            <label className="text-xs font-bold text-gray-500">사유 (선택)</label>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              rows={3}
              maxLength={400}
              disabled={submittingReport}
              placeholder="간단히 적어주세요"
              className="mt-1.5 w-full rounded-xl border border-violet-200/60 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400 resize-none disabled:opacity-50"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              disabled={submittingReport}
              onClick={() => setReportModal(null)}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-violet-50 text-violet-800 hover:bg-violet-100 disabled:opacity-40"
            >
              취소
            </button>
            <button
              type="button"
              disabled={submittingReport}
              onClick={() => void handleSubmitMatchupReport()}
              className="flex-1 py-3 rounded-xl text-sm font-black bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40"
            >
              {submittingReport ? '처리 중…' : '신고 접수'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Master 티어 전용 투표 이펙트 */}
      <VoteFireworks
        trigger={fireworkTrigger}
        x={fireworkPos.x}
        y={fireworkPos.y}
      />
      </div>
      </div>
    </MatchupsFeedLnbPageLayout>
  )
}

// ── 댓글 아이템 (트리: 답글 재귀) ─────────────────────────────────
function CommentItem({
  node,
  depth = 0,
  currentUserId,
  user,
  composerFandomTier,
  openLoginModal,
  onDelete,
  onSubmitReply,
  submittingReplyFor,
}) {
  const { showToast } = useUIStore()
  const { children = [], ...comment } = node
  const [localLike, setLocalLike] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [showReply, setShowReply] = useState(false)
  const [replyText, setReplyText] = useState('')
  const replyTextareaRef = useRef(null)
  const isOwn = currentUserId === comment.user_id
  const isSubmittingThis = submittingReplyFor === comment.id

  const handleReplySubmit = async (e) => {
    e.preventDefault()
    if (!user) {
      openLoginModal()
      return
    }
    const ok = await onSubmitReply(comment.id, replyText)
    if (ok) {
      setReplyText('')
      setShowReply(false)
    }
  }

  return (
    <div
      className={cn(
        depth > 0 && 'mt-3 ml-2 sm:ml-6 border-l-2 border-violet-200/60 pl-3 sm:pl-4'
      )}
    >
      {depth > 0 && (
        <p className="text-[10px] font-bold text-violet-400/90 mb-1.5 flex items-center gap-1">
          <CornerDownRight size={11} className="shrink-0" />
          답글
        </p>
      )}
      <div className="flex items-start gap-3">
        <Avatar src={comment.profiles?.avatar_url} alt={comment.profiles?.nickname} size="sm" className="shrink-0" />
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              'rounded-xl border border-violet-100/40 bg-violet-50/55 px-4 py-3',
              fandomTierHasGoldCommentAura(comment.profiles?.fandom_tier) && 'vics-fandom-comment-aura',
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 min-w-0">
                  <UserProfileLink
                    userId={comment.profiles?.id}
                    className="text-xs font-black text-[#22282E] hover:underline truncate"
                  >
                    {comment.profiles?.nickname || '사용자'}
                  </UserProfileLink>
                  <FandomBronzeStarBadge tierId={comment.profiles?.fandom_tier} size={12} />
                  <FoundingMemberBadge profile={comment.profiles} size={11} />
                  <FeaturedBadgeSpan profile={comment.profiles} className="translate-y-px shrink-0" />
                </span>
              </div>
              <span className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap">
                {formatDate(comment.created_at)}
              </span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
              {sanitizeText(comment.content)}
            </p>
          </div>

          <div className="flex items-center gap-3 mt-1.5 pl-1 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setLocalLike((v) => !v)
                setLikeCount((c) => (localLike ? Math.max(0, c - 1) : c + 1))
              }}
              className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                localLike ? 'text-red-500' : 'text-gray-400 hover:text-red-400'
              }`}
            >
              <Heart size={11} fill={localLike ? 'currentColor' : 'none'} />
              {likeCount > 0 ? likeCount : '좋아요'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!user) {
                  openLoginModal()
                  return
                }
                setShowReply((v) => !v)
              }}
              className="flex items-center gap-1 text-xs font-medium text-violet-500/90 hover:text-violet-800 transition-colors"
            >
              <CornerDownRight size={11} />
              답글 달기
            </button>
            {isOwn && (
              <button
                type="button"
                onClick={() => onDelete(comment.id)}
                className="text-xs text-gray-300 hover:text-red-400 transition-colors ml-auto"
              >
                삭제
              </button>
            )}
          </div>

          {showReply && user && (
            <form onSubmit={handleReplySubmit} className="mt-3 space-y-2">
              <textarea
                ref={replyTextareaRef}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="답글을 입력하세요…"
                rows={2}
                maxLength={500}
                className="w-full bg-white/80 border border-violet-200/50 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 resize-none placeholder:text-violet-300/80"
              />
              <FandomGoldExclusiveEmojiBar
                tierId={composerFandomTier}
                textareaRef={replyTextareaRef}
                value={replyText}
                onChange={setReplyText}
                maxLength={500}
                onTooLong={() => showToast('답글은 500자까지 입력할 수 있어요', 'error')}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-violet-300/90">{replyText.length} / 500</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowReply(false)
                      setReplyText('')
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-violet-500 hover:bg-violet-50 rounded-lg transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={!replyText.trim() || isSubmittingThis}
                    className="px-4 py-1.5 text-xs font-black rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:from-violet-500 hover:to-fuchsia-500"
                  >
                    {isSubmittingThis ? '등록 중…' : '답글 등록'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      {children.length > 0 && (
        <div className="space-y-0">
          {children.map((child) => (
            <CommentItem
              key={child.id}
              node={child}
              depth={depth + 1}
              currentUserId={currentUserId}
              user={user}
              composerFandomTier={composerFandomTier}
              openLoginModal={openLoginModal}
              onDelete={onDelete}
              onSubmitReply={onSubmitReply}
              submittingReplyFor={submittingReplyFor}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── 옵션 카드 ──────────────────────────────────────────────────────
function OptionCard({
  side,
  matchup,
  sideProfile,
  userVote,
  voteLocked,
  voteSubmitting = false,
  isExpired,
  isComplete,
  onVote,
  user,
  percent,
  showResult,
  variant,
  onRequestReport,
  forfeitApplied,
}) {
  const isLeft  = side === 'left'
  const type    = isLeft ? matchup.left_type  : matchup.right_type
  const url     = isLeft ? matchup.left_url   : matchup.right_url
  const text    = isLeft ? matchup.left_text  : matchup.right_text
  const label   = isLeft ? (matchup.left_label  || 'A') : (matchup.right_label  || 'B')
  const thumb   = isLeft ? matchup.left_thumbnail_url : matchup.right_thumbnail_url

  const voted   = userVote === side
  const canVote =
    isComplete &&
    !isExpired &&
    !forfeitApplied &&
    !(voteLocked && !voted) &&
    !(voteSubmitting && !userVote)
  const isBestVariant = variant === 'best'

  const forceLeftWin = Boolean(matchup.challenger_forfeit_at)
  const hasVotes = (matchup.total_votes || 0) > 0
  const isDraw  = !forceLeftWin && (matchup.left_votes || 0) === (matchup.right_votes || 0)
  const winner  = forceLeftWin ? 'left' : (isDraw ? null : (matchup.left_votes > matchup.right_votes ? 'left' : 'right'))
  const isWin   = !isDraw && side === winner
  const isLose  = !isDraw && side !== winner
  const showWinLoseBadge = isComplete && ((hasVotes && isExpired) || forceLeftWin)

  const sideUserId = sideProfile?.id || (isLeft ? matchup.user_id : matchup.right_user_id)
  const reportSelf = Boolean(user?.id && sideUserId && user.id === sideUserId)
  const showReportButton =
    isComplete && user && onRequestReport && !forfeitApplied && !reportSelf

  const reportButtonClass =
    'shrink-0 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black text-rose-700 bg-rose-50/95 border border-rose-200/90 shadow-sm hover:bg-rose-100 hover:border-rose-300 hover:text-rose-800 active:scale-[0.98] transition-all'

  const [viewerMedia, setViewerMedia] = useState(null)
  const viewPayload = { type, url, thumbnail: thumb, text, label: isLeft ? 'A' : 'B' }
  const canOpenViewer = canOpenMatchupMediaView(viewPayload)

  const handleMediaPreview = (e) => {
    if (e.target.closest('video')) return
    if (!canOpenViewer) return
    e.stopPropagation()
    setViewerMedia(viewPayload)
  }

  return (
    <div className="flex flex-col gap-2">
      {/* 베스트/추천: 카드 위 아바타+이름 */}
      {isBestVariant && (
        <div className={cn(
          'flex items-center gap-2 px-2.5 py-1.5 rounded-xl',
          isLeft
            ? 'bg-gradient-to-r from-fuchsia-50/80 to-pink-50/60 border border-fuchsia-100/60'
            : 'bg-gradient-to-r from-sky-50/80 to-blue-50/60 border border-sky-100/60',
        )}>
          <div className="flex-1 min-w-0">
            {sideProfile ? (
              <UserProfileLink userId={sideProfile.id} className="flex items-center gap-2 min-w-0">
                <Avatar src={sideProfile.avatar_url} alt={sideProfile.nickname} size="sm" />
                <span className="flex min-w-0 items-center gap-1">
                  <span className="text-sm font-bold text-[#22282E] truncate">{sideProfile.nickname || label || '사용자'}</span>
                  <FandomBronzeStarBadge tierId={sideProfile.fandom_tier} />
                  <FoundingMemberBadge profile={sideProfile} />
                  <FeaturedBadgeSpan profile={sideProfile} rankInfo={sideProfile._tierRankInfo} className="translate-y-px shrink-0" />
                </span>
              </UserProfileLink>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0',
                  isLeft
                    ? 'bg-gradient-to-br from-fuchsia-400 to-pink-500 text-white'
                    : 'bg-gradient-to-br from-sky-400 to-blue-500 text-white',
                )}>
                  {(label || (isLeft ? 'A' : 'B'))[0]}
                </div>
                <span className="text-sm font-bold text-[#22282E] truncate">{label}</span>
              </div>
            )}
          </div>
          {showReportButton && (
            <button
              type="button"
              onClick={() => onRequestReport(side)}
              className={reportButtonClass}
              aria-label={`${label} 측 신고하기`}
            >
              <Flag size={12} className="shrink-0 fill-rose-200/80 text-rose-600" aria-hidden />
              신고
            </button>
          )}
        </div>
      )}
      {/* 미디어 */}
      <div
        onClick={handleMediaPreview}
        className={`relative group rounded-xl transition-all duration-200 ${
          canOpenViewer ? 'cursor-zoom-in' : 'cursor-default'
        } ${
          voted
            ? isLeft
              ? 'ring-[3px] ring-fuchsia-500 shadow-[0_0_28px_rgba(217,70,239,0.35)]'
              : 'ring-[3px] ring-sky-500 shadow-[0_0_28px_rgba(14,165,233,0.35)]'
            : canVote && user
              ? 'hover:-translate-y-0.5 hover:shadow-lg'
              : ''
        }`}
      >
        <MatchupThumbFrame side={isLeft ? 'left' : 'right'} className="aspect-square w-full">
          {type === 'image' && (url || thumb) && (
            <img
              src={safeMediaUrl(thumb || url)}
              alt={isLeft ? 'A측' : 'B측'}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-400 group-hover:scale-105"
            />
          )}
          {type === 'video' && url && (
            <div className="relative h-full w-full bg-black">
              <video
                src={safeMediaUrl(url)}
                className="h-full w-full object-cover"
                controls
                playsInline
                preload="metadata"
              />
            </div>
          )}
          {type === 'text' && (
            <div className={cn(
              'flex h-full w-full items-center justify-center p-4',
              isLeft
                ? 'bg-gradient-to-br from-amber-950/90 via-orange-900/80 to-rose-950/85'
                : 'bg-gradient-to-br from-violet-950/90 via-fuchsia-900/80 to-indigo-950/85',
            )}>
              <p className="text-center text-sm font-bold leading-relaxed text-white/90 drop-shadow-sm sm:text-base">{text}</p>
            </div>
          )}
          {type !== 'text' && (
            <div className="pointer-events-none absolute inset-0 z-[8] bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          )}

          {/** 투표됨 뱃지 */}
          {voted && (
            <div
              className={`absolute right-2 top-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-black text-white shadow-md ${
                isLeft
                  ? 'bg-gradient-to-r from-fuchsia-600 to-pink-500 shadow-[0_0_16px_rgba(217,70,239,0.5)]'
                  : 'bg-gradient-to-r from-sky-500 to-blue-600 shadow-[0_0_16px_rgba(14,165,233,0.5)]'
              }`}
            >
              ✓ 내 선택
            </div>
          )}
        </MatchupThumbFrame>

        {/* WIN / 패배 / 무승부 뱃지 (투표완료 시) */}
        {showWinLoseBadge && (
          <div className="absolute top-2 left-2 z-10">
            {isWin && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-black bg-gradient-to-r from-emerald-400 to-green-500 text-white px-2 py-0.5 rounded-full shadow-[0_0_12px_rgba(74,222,128,0.55)]">
                👑 WIN
              </span>
            )}
            {isLose && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-black bg-gradient-to-r from-rose-500 to-red-500 text-white px-2 py-0.5 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.4)]">
                ✗ 패배
              </span>
            )}
            {isDraw && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-black bg-gradient-to-r from-slate-500 to-gray-500 text-white px-2 py-0.5 rounded-full shadow-sm">
                🤝 무승부
              </span>
            )}
          </div>
        )}

        {canOpenViewer && type !== 'text' && (
          <div className="pointer-events-none absolute inset-0 z-[12] flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <span className="rounded-full bg-black/55 px-3 py-1.5 text-xs font-black text-white backdrop-blur-sm">
              탭해서 크게 보기
            </span>
          </div>
        )}
      </div>

      {/* 결과 바 (투표 후 또는 결과 존재 시) */}
      {showResult && (
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className={`text-xs font-bold ${isLeft ? 'text-fuchsia-800' : 'text-sky-800'}`}>{label}</span>
            <span className={`text-xs font-black tabular-nums ${isLeft ? 'text-fuchsia-700' : 'text-sky-700'}`}>{percent}%</span>
          </div>
          <div className={`h-2.5 rounded-full overflow-hidden ${isLeft ? 'bg-fuchsia-100 ring-1 ring-fuchsia-200/60' : 'bg-sky-100 ring-1 ring-sky-200/60'}`}>
            <div
              className={`h-full rounded-full ${
                voted
                  ? isLeft
                    ? 'bg-gradient-to-r from-fuchsia-500 via-pink-500 to-rose-500 shadow-[0_0_12px_rgba(217,70,239,0.45)] animate-vote-bar-rise'
                    : 'bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600 shadow-[0_0_12px_rgba(14,165,233,0.45)] animate-vote-bar-rise-delayed'
                  : isLeft
                    ? 'bg-violet-200/70 animate-vote-bar-rise'
                    : 'bg-fuchsia-200/70 animate-vote-bar-rise-delayed'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {/* 투표 버튼 */}
      {isComplete && !isExpired && (
        <button
          type="button"
          onClick={(e) => {
            if (!user || voteSubmitting) return
            onVote(side, e)
          }}
          disabled={!voted && (!user || (voteLocked && !!user) || voteSubmitting)}
          title={
            !user
              ? '로그인 후 투표할 수 있어요'
              : voteSubmitting && !userVote
                ? '투표 처리 중…'
                : undefined
          }
          className={`w-full py-3 rounded-xl text-sm font-black transition-all active:scale-[0.97] flex items-center justify-center gap-1.5 ${
            voted
              ? isLeft
                ? 'bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white shadow-[0_0_24px_rgba(217,70,239,0.45)]'
                : 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-[0_0_24px_rgba(14,165,233,0.45)]'
              : !user
                ? 'cursor-not-allowed bg-slate-100 text-slate-400 ring-1 ring-slate-200/80'
                : voteLocked
                  ? 'bg-violet-100/60 text-violet-300 cursor-not-allowed'
                  : voteSubmitting && !userVote
                    ? 'cursor-wait opacity-90 bg-slate-200/90 text-slate-600'
                    : isLeft
                      ? 'bg-gradient-to-r from-fuchsia-500 to-pink-400 text-white hover:shadow-[0_0_28px_rgba(217,70,239,0.55)] hover:scale-[1.01]'
                      : 'bg-gradient-to-r from-sky-400 to-blue-500 text-white hover:shadow-[0_0_28px_rgba(14,165,233,0.55)] hover:scale-[1.01]'
          }`}
        >
          {voteSubmitting && !userVote ? (
            <>
              <span className="h-4 w-4 shrink-0 rounded-full border-2 border-current/30 border-t-current animate-spin" aria-hidden />
              처리 중…
            </>
          ) : (
            <>
              {isBestVariant && <ThumbsUp size={14} className={voted ? 'fill-current' : ''} />}
              {voted ? `✓ ${label}에 투표함` : !user ? '로그인 후 투표' : `${label}에 투표하기`}
            </>
          )}
        </button>
      )}
      {isExpired && (
        <div className={cn(
          'w-full py-2.5 rounded-xl text-xs font-bold text-center',
          voted
            ? isLeft
              ? 'bg-gradient-to-r from-fuchsia-100/80 to-pink-100/60 text-fuchsia-700 border border-fuchsia-200/50'
              : 'bg-gradient-to-r from-sky-100/80 to-blue-100/60 text-sky-700 border border-sky-200/50'
            : 'bg-violet-100/50 text-violet-400',
        )}>
          {voted ? `✓ ${label} 투표` : forfeitApplied ? '몰수패로 경쟁 종료' : '마감된 투표'}
        </div>
      )}

      {!isBestVariant && showReportButton && (
        <button
          type="button"
          onClick={() => onRequestReport(side)}
          className={cn(reportButtonClass, 'w-full py-2.5 gap-1.5')}
          aria-label={`${label} 측 신고하기`}
        >
          <Flag size={13} className="shrink-0 fill-rose-200/80 text-rose-600" aria-hidden />
          {label} 측 신고
        </button>
      )}

      <MatchupMediaViewer
        open={Boolean(viewerMedia)}
        media={viewerMedia}
        onClose={() => setViewerMedia(null)}
      />
    </div>
  )
}

// ── 도전자 슬롯 ───────────────────────────────────────────────────
function ChallengerSlot({ user, isMyMatchup, onChallenge, onLogin }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="aspect-square rounded-xl overflow-hidden border border-dashed border-emerald-400/35 bg-gradient-to-br from-emerald-950/88 via-teal-950/78 to-cyan-950/82 flex flex-col items-center justify-center gap-3 px-3">
        <span className="text-4xl sm:text-5xl">⚔️</span>
        <div className="text-center">
          <p className="text-sm font-black text-emerald-300 tracking-wide">도전자 모집 중</p>
          <p className="text-xs text-teal-400/80 mt-0.5">아직 상대방이 없어요</p>
        </div>
        {!isMyMatchup && (
          user ? (
            <button
              onClick={onChallenge}
              className="flex items-center gap-1.5 px-5 py-2.5 text-[#0f1f0f] text-xs font-black rounded-xl bg-gradient-to-r from-lime-400 via-emerald-400 to-teal-500 shadow-[0_0_24px_rgba(132,204,22,0.5)] hover:shadow-[0_0_32px_rgba(132,204,22,0.65)] hover:scale-[1.03] active:scale-[0.97] transition-all"
            >
              <Swords size={13} /> 도전하기
            </button>
          ) : (
            <button
              onClick={onLogin}
              className="flex items-center gap-1.5 px-4 py-2 border-2 border-transparent text-[#0f1f0f] text-xs font-black rounded-xl bg-gradient-to-r from-lime-400/90 to-emerald-500 hover:from-lime-300 hover:to-emerald-400 transition-all shadow-md"
            >
              <Swords size={13} /> 로그인하고 도전
            </button>
          )
        )}
      </div>
    </div>
  )
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

  const voteStats = getVoteResultStats(matchup, votedSide, leftPct, rightPct)
  const { isDraw, winSide, userWins } = voteStats
  const winLabel   = winSide === 'left' ? leftLabel : winSide === 'right' ? rightLabel : null
  const winPct     = winSide === 'left' ? leftPct   : winSide === 'right' ? rightPct  : 50
  const headline   = getVoteResultHeadline(voteStats, winLabel)

  const aiComment = generateAIComment(matchup, votedSide, leftPct, rightPct)
  const aiInsight = isDraw
    ? `${voteStats.totalVotes}표로 50:50 무승부예요 🤝`
    : generateAIInsight(voteStats, winPct)

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
        className={`w-full sm:max-w-sm bg-gradient-to-b from-violet-50/95 via-white to-fuchsia-50/40 border-t border-x border-violet-200/30 sm:border sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden transition-all duration-300 ease-out flex flex-col max-h-[95dvh] ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
      >
        {/* ── 핸들 + 닫기 ── */}
        <div className="relative flex items-center justify-center pt-4 pb-2 shrink-0">
          <div className="w-10 h-1 bg-violet-200/80 rounded-full sm:hidden" />
          <button
            onClick={handleClose}
            className="absolute right-4 top-3 p-1.5 rounded-full hover:bg-violet-100 text-violet-400 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── 스크롤 영역 ── */}
        <div className="overflow-y-auto flex-1">

          {/* 승리 발표 */}
          <div className="px-5 pb-3 text-center">
            <p className={`text-base font-black leading-snug ${isDraw ? 'text-[#22282E]' : userWins ? 'text-[#22282E]' : 'text-gray-500'}`}>
              {headline.title}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {headline.subtitle}
            </p>
          </div>

          {/* ══ 공유용 스토리 카드 ══ */}
          <div className="px-4 pb-1">
            <div
              ref={cardRef}
              className="rounded-2xl overflow-hidden border border-violet-400/30 shadow-[0_12px_40px_-8px_rgba(139,92,246,0.35)]"
              style={{ background: 'linear-gradient(145deg, #1e1b4b 0%, #312e81 45%, #1e293b 100%)' }}
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
                  isWin={!isDraw && winSide === 'left'}
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
                  isWin={!isDraw && winSide === 'right'}
                  isVoted={votedSide === 'right'}
                  animated={animated}
                  alignRight
                />
                {/* 가운데 구분선 + VS */}
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center z-20 pointer-events-none">
                  <div className="w-px h-full bg-white/20" />
                  <div className="absolute">
                    <VsBadge variant="story" size="md" />
                  </div>
                </div>
              </div>

              {/* 통합 게이지 바 */}
              <div className="h-2 flex">
                <div
                  className={`h-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-rose-400 shadow-[0_0_12px_rgba(217,70,239,0.4)] ${animated ? 'animate-vote-bar-rise' : ''}`}
                  style={{ width: animated ? `${leftPct}%` : '0%' }}
                />
                <div
                  className={`h-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600 shadow-[0_0_12px_rgba(14,165,233,0.4)] ${animated ? 'animate-vote-bar-rise-delayed' : ''}`}
                  style={{ width: animated ? `${rightPct}%` : '0%' }}
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
              isDraw
                ? 'bg-violet-100/70 border border-violet-200/60 text-violet-900'
                : userWins
                ? 'bg-amber-50 border border-amber-100 text-amber-800'
                : 'bg-fuchsia-50 border border-fuchsia-100 text-fuchsia-900'
            }`}>
              <span className="text-base shrink-0 mt-0.5">{isDraw ? '🤝' : userWins ? '📊' : '💡'}</span>
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

            {/* Secondary: 다른 라이벌과 재경쟁 (아웃라인) */}
            <button
              onClick={handleRebattle}
              className="w-full py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2
                border-2 border-violet-600 text-violet-800
                hover:bg-violet-700 hover:text-white hover:border-violet-700 active:scale-[0.98] transition-all duration-200"
            >
              🔄 다른 라이벌과 경쟁하기
            </button>

            {/* Tertiary: 다른 매치업 구경가기 (고스트) */}
            <button
              onClick={handleNextMatchup}
              className="w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-1.5
                border border-violet-200/70 text-violet-600
                hover:border-violet-300 hover:text-violet-800 active:scale-[0.98] transition-all duration-200"
            >
              <ChevronRight size={15} />
              ⏭️ 다른 매치업 구경가기
            </button>

            {/* 계속 보기 */}
            <button
              onClick={handleClose}
              className="w-full py-1.5 text-xs text-violet-300 hover:text-violet-500 transition-colors"
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
          <img src={safeMediaUrl(url)} alt={label} className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ${isWin ? '' : 'brightness-50 saturate-50'}`} />
        ) : type === 'text' ? (
          <div className="absolute inset-0 bg-white/10 flex items-center justify-center p-3">
            <p className="text-white text-xs font-bold text-center leading-snug">{text}</p>
          </div>
        ) : (
          <div className="absolute inset-0 bg-white/10 flex items-center justify-center">
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
              className={`h-full rounded-full ${isWin ? 'bg-gradient-to-r from-lime-400 to-emerald-400' : 'bg-white/30'} ${animated ? (alignRight ? 'animate-vote-bar-rise-delayed' : 'animate-vote-bar-rise') : ''}`}
              style={{ width: animated ? `${pct}%` : '0%' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 매치업 없음 / 데모 ID ─────────────────────────────────────────
function MatchupDetailNotFound({ isDemo, onBack, onHome }) {
  return (
    <div className="relative -mx-4 px-4 sm:mx-0 sm:px-0 pb-6">
      <div className="max-w-lg mx-auto py-16 px-6 text-center">
        <p className="text-4xl mb-4">{isDemo ? '🎭' : '🔍'}</p>
        <h1 className="text-lg font-black text-[#22282E] mb-2">
          {isDemo ? '데모 매치업은 상세 페이지가 없어요' : '매치업을 찾을 수 없어요'}
        </h1>
        <p className="text-sm text-gray-500 mb-8 leading-relaxed">
          {isDemo
            ? '메인에 표시되는 샘플 카드예요. 실제 매치업을 만들거나 피드에서 다른 카드를 눌러보세요.'
            : '삭제되었거나 주소가 잘못됐을 수 있어요.'}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-bold text-violet-800 bg-violet-100 hover:bg-violet-200/80 transition-colors"
          >
            이전으로
          </button>
          <button
            type="button"
            onClick={onHome}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-fuchsia-600 to-sky-500 hover:opacity-95 transition-opacity"
          >
            홈으로
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 스켈레톤 ─────────────────────────────────────────────────────
function MatchupDetailSkeleton() {
  return (
    <div className="relative -mx-4 px-4 sm:mx-0 sm:px-0 pb-6">
      <div className="pointer-events-none absolute inset-x-0 -top-3 bottom-0 -z-10 sm:-inset-x-3 sm:rounded-[2rem] bg-gradient-to-b from-violet-500/[0.09] via-fuchsia-400/[0.05] to-cyan-400/[0.11]" />
      <div className="max-w-3xl mx-auto space-y-5 animate-pulse">
        <div className="h-9 bg-gradient-to-r from-violet-200/60 to-violet-100/40 rounded-xl w-28" />
        <div className="bg-gradient-to-br from-white/90 via-violet-50/60 to-cyan-50/40 border border-violet-200/40 rounded-2xl p-6 space-y-5 overflow-hidden relative">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-violet-300/60 via-fuchsia-300/50 to-cyan-300/40 rounded-t-2xl" />
          <div className="h-7 bg-violet-200/50 rounded-xl w-3/4 mx-auto" />
          <div className="h-4 bg-violet-100/50 rounded w-1/2 mx-auto" />
          <div className="grid grid-cols-2 gap-4">
            <div className="aspect-square bg-gradient-to-br from-fuchsia-100/50 to-pink-100/40 rounded-xl" />
            <div className="aspect-square bg-gradient-to-br from-sky-100/50 to-blue-100/40 rounded-xl" />
          </div>
          <div className="h-12 bg-violet-100/50 rounded-xl" />
          <div className="h-12 bg-violet-100/50 rounded-xl" />
        </div>
        <div className="bg-gradient-to-br from-white/85 to-violet-50/50 border border-violet-200/40 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-200/70 to-fuchsia-200/60 rounded-xl" />
            <div className="h-5 bg-violet-200/50 rounded w-16" />
          </div>
          <div className="h-24 bg-violet-100/50 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
