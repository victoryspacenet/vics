import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Users, ArrowRight, Heart, MessageCircle, Swords, Play } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { voteViaApi } from '../../lib/voteApi'
import { VsBadge } from '../ui/VsBadge'
import { MatchupThumbFrame } from '../ui/MatchupThumbFrame'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { formatDate, formatNumber, calcPercent, cn } from '../../lib/utils'
import { formatMatchupRegisteredAt } from '../../lib/matchupRegisteredAt'
import { safeMediaUrl } from '../../lib/sanitize'
import { getTier, tierAtLeast } from '../../lib/tiers'
import { isFeedBannerHighlightActive } from '../../lib/bannerHighlightBoost'
import { VIP_MATCHUP_SURFACE_CLASS } from '../../lib/matchupCreatorVipGlow'
import { MatchupMediaOpenButton, MatchupMediaViewer } from './MatchupMediaViewer'
import { matchupSideToMedia } from '../../lib/matchupMediaView'
import { useMatchupEngagement } from './MatchupEngagementContext'
import { MatchupFeedParticipants } from './MatchupFeedParticipants'
import { resolveMatchupSideType, readMatchupSideText } from '../../lib/matchupSideDisplay'

// variant별 스타일 맵
const VARIANT_STYLE = {
  best: {
    badge: (rank) =>
      rank === 1 ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-900 shadow-[0_2px_8px_rgba(251,191,36,0.4)]' :
      rank === 2 ? 'bg-gradient-to-r from-gray-300 to-gray-200 text-gray-700' :
      rank === 3 ? 'bg-gradient-to-r from-orange-400 to-amber-300 text-orange-900' :
                   'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800',
    label: (rank) => rank != null ? `🔥 RANK ${rank}` : '🔥 RANK',
    border: 'border-amber-200/70 hover:border-amber-300/80',
    bg: 'from-white via-amber-50/55 to-orange-50/40',
    topBar: 'from-amber-400 via-orange-500 to-rose-400',
    shadow: 'shadow-[0_4px_24px_-6px_rgba(251,146,60,0.22)] lg:shadow-[0_6px_32px_-8px_rgba(251,146,60,0.26)]',
    hoverShadow: 'hover:shadow-[0_8px_32px_-6px_rgba(251,146,60,0.38)]',
  },
  hot: {
    badge: () => 'bg-gradient-to-r from-violet-500 to-fuchsia-400 text-white shadow-[0_2px_8px_rgba(168,85,247,0.4)]',
    label: () => '✨ 박빙',
    border: 'border-fuchsia-200/65 hover:border-fuchsia-300/75',
    bg: 'from-white via-violet-50/55 to-fuchsia-50/40',
    topBar: 'from-violet-500 via-fuchsia-500 to-pink-400',
    shadow: 'shadow-[0_4px_24px_-6px_rgba(168,85,247,0.2)] lg:shadow-[0_6px_32px_-8px_rgba(168,85,247,0.24)]',
    hoverShadow: 'hover:shadow-[0_8px_32px_-6px_rgba(168,85,247,0.36)]',
  },
  new: {
    badge: () => 'bg-gradient-to-r from-emerald-400 to-teal-400 text-white shadow-[0_2px_8px_rgba(20,184,166,0.4)]',
    label: () => '⚡ NEW',
    border: 'border-emerald-200/65 hover:border-emerald-300/75',
    bg: 'from-white via-emerald-50/55 to-cyan-50/40',
    topBar: 'from-emerald-400 via-teal-500 to-cyan-400',
    shadow: 'shadow-[0_4px_24px_-6px_rgba(20,184,166,0.2)] lg:shadow-[0_6px_32px_-8px_rgba(20,184,166,0.24)]',
    hoverShadow: 'hover:shadow-[0_8px_32px_-6px_rgba(20,184,166,0.34)]',
  },
  default: {
    badge: () => '',
    label: () => '',
    border: 'border-gray-200/80 hover:border-gray-300/80',
    bg: 'from-white via-white to-slate-50/55',
    topBar: null,
    shadow: 'shadow-sm lg:shadow-md',
    hoverShadow: 'hover:shadow-md lg:hover:shadow-lg',
  },
}

/** 도전자 모집 중(양측 미완성·만료 전) — 메인 NEW 탭·matchupsNewWaiting과 동일 기준 */
function isNewWaitingMatchup(matchup) {
  if (matchup?.right_type != null) return false
  if (matchup?.status && matchup.status !== 'active') return false
  if (matchup?.expires_at && new Date(matchup.expires_at) <= new Date()) return false
  return true
}

function resolveFeedCardVariant({ listBadge, listBadgeVariant, variantProp, matchup }) {
  if (variantProp && VARIANT_STYLE[variantProp]) return variantProp

  if (listBadge) {
    if (listBadgeVariant === 'best' || listBadgeVariant === 'hot') return listBadgeVariant
    return 'default'
  }

  if (isNewWaitingMatchup(matchup)) return 'new'

  return 'default'
}

const LIST_BADGE_LABELS = { best: '베스트', hot: '추천', new: 'NEW' }

export function FeedCard({
  matchup: initialMatchup,
  variant: variantProp,
  rank,
  listBadge,
  /** `listBadge`일 때 메인 피드 역할 (`best`/`hot`만) */
  listBadgeVariant,
  onVoteUpdate,
  eagerMedia = false,
}) {
  const variant = resolveFeedCardVariant({
    listBadge,
    listBadgeVariant,
    variantProp,
    matchup: initialMatchup,
  })
  const { user } = useAuthStore()
  const { showToast, openLoginModal, openChallengeDrawer } = useUIStore()
  const batchEngagement = useMatchupEngagement(initialMatchup?.id)

  const [matchup, setMatchup] = useState(initialMatchup)
  const [userVote, setUserVote] = useState(null)
  const [liked, setLiked] = useState(false)
  const [voteLocked, setVoteLocked] = useState(false)
  const [isVoting, setIsVoting] = useState(false)
  const [barAnimated, setBarAnimated] = useState(false)
  const [viewerMedia, setViewerMedia] = useState(null)

  const isComplete = !!matchup.right_type
  const { left, right } = calcPercent(matchup.left_votes, matchup.right_votes)
  const profile = matchup.profiles

  const vs = VARIANT_STYLE[variant] || VARIANT_STYLE.default
  const showVariantBadge = listBadge
    ? variant === 'best' || variant === 'hot'
    : variant === 'new'
  const variantBadgeLabel = listBadge ? LIST_BADGE_LABELS[variant] : vs.label(rank)

  useEffect(() => { setMatchup(initialMatchup) }, [initialMatchup])

  useEffect(() => {
    if (!user || !matchup.id) return
    if (batchEngagement?.ready) {
      const side = batchEngagement.userVote
      if (side) {
        setUserVote(side)
        setVoteLocked(true)
        setBarAnimated(true)
      } else {
        setUserVote(null)
        setVoteLocked(false)
      }
      setLiked(batchEngagement.liked)
      return
    }
    void fetchUserVote()
    void fetchUserLike()
  }, [user, matchup.id, batchEngagement?.ready, batchEngagement?.userVote, batchEngagement?.liked])

  // 바 애니메이션: userVote 확정 후 실행
  useEffect(() => {
    if (userVote) {
      const t = setTimeout(() => setBarAnimated(true), 50)
      return () => clearTimeout(t)
    }
  }, [userVote])

  const fetchUserVote = async () => {
    const { data } = await supabase
      .from('votes').select('side')
      .eq('user_id', user.id).eq('matchup_id', matchup.id).maybeSingle()
    if (data) { setUserVote(data.side); setVoteLocked(true); setBarAnimated(true) }
  }
  const fetchUserLike = async () => {
    const { data } = await supabase
      .from('likes').select('id')
      .eq('user_id', user.id).eq('matchup_id', matchup.id).maybeSingle()
    setLiked(!!data)
  }

  const handleVote = async (side) => {
    if (!user) return
    if (isVoting || !isComplete) return
    setIsVoting(true)
    try {
      if (!userVote) {
        const result = await voteViaApi(matchup.id, side)
        if (result.error) {
          showToast(result.error, 'error')
          return
        }
        setUserVote(side)
        setMatchup((p) => ({
          ...p,
          left_votes:  side === 'left'  ? (p.left_votes  || 0) + 1 : p.left_votes,
          right_votes: side === 'right' ? (p.right_votes || 0) + 1 : p.right_votes,
          total_votes: (p.total_votes || 0) + 1,
        }))
        showToast('투표 완료! 매치업 종료 후 결과에 따라 포인트가 지급돼요', 'success')
        setVoteLocked(true)
        onVoteUpdate?.()
      }
    } catch { showToast('투표 중 오류가 발생했어요', 'error') }
    finally { setIsVoting(false) }
  }

  const handleLike = async (e) => {
    e.preventDefault(); e.stopPropagation()
    if (!user) { openLoginModal('vote'); return }
    try {
      if (liked) {
        await supabase.from('likes').delete().eq('user_id', user.id).eq('matchup_id', matchup.id)
        setLiked(false)
        setMatchup((p) => ({ ...p, likes_count: Math.max(0, (p.likes_count || 0) - 1) }))
      } else {
        await supabase.from('likes').insert({ user_id: user.id, matchup_id: matchup.id })
        setLiked(true)
        setMatchup((p) => ({ ...p, likes_count: (p.likes_count || 0) + 1 }))
      }
    } catch { showToast('오류가 발생했어요', 'error') }
  }

  const showVoteBar = userVote && isComplete
  const bannerGlow = isFeedBannerHighlightActive(matchup)
  const creatorRankInfo = matchup._creatorRankInfo || {}
  const creatorTier = getTier(profile || {}, creatorRankInfo)
  const premiumFrame =
    !bannerGlow && profile?.id && tierAtLeast(creatorTier, 'vip')

  return (
    <div
      className={cn(
        'relative border rounded-2xl transition-all duration-300 overflow-hidden',
        bannerGlow
          ? 'vics-feed-banner-highlight vics-feed-banner-highlight--feed-lg shadow-none'
          : cn(
              `bg-gradient-to-br ${vs.bg ?? 'from-white via-white to-slate-50/55'}`,
              vs.shadow ?? 'shadow-sm',
              vs.hoverShadow ?? 'hover:shadow-md',
              vs.border,
              'hover:-translate-y-0.5',
            ),
        premiumFrame && VIP_MATCHUP_SURFACE_CLASS,
        premiumFrame && 'sm:scale-[1.008] sm:hover:scale-[1.01]',
      )}
    >
      {/* 카드 상단 컬러 라인 */}
      {!bannerGlow && vs.topBar && (
        <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${vs.topBar}`} />
      )}

      {/* ── 카드 헤더 ── */}
      <div className="relative z-[6] px-4 pt-4 pb-2 lg:px-4 lg:pt-3.5 lg:pb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
          {showVariantBadge && (
            <span className={`shrink-0 text-[11px] font-black px-2 py-0.5 rounded-full ${listBadge ? vs.badge(variant === 'best' ? 1 : null) : vs.badge(rank)}`}>
              {variantBadgeLabel}
            </span>
          )}
          {bannerGlow && (
            <span className="shrink-0 rounded-full border border-white/50 bg-gradient-to-r from-fuchsia-600 via-violet-600 to-cyan-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow-[0_0_14px_rgba(217,70,239,0.55)]">
              네온 부스트
            </span>
          )}
          {premiumFrame && creatorTier.id === 'vip' && (
            <span className="shrink-0 rounded-full border border-violet-400/50 bg-violet-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-violet-700">
              VIP
            </span>
          )}
          {premiumFrame && creatorTier.id === 'goat' && (
            <span className="shrink-0 rounded-full border border-amber-400/50 bg-amber-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-900">
              GOAT
            </span>
          )}
          <Link
            to={`/matchup/${matchup.id}`}
            className="text-sm lg:text-base font-black text-[#22282E] line-clamp-2 hover:underline flex-1 min-w-0 leading-snug"
          >
            {matchup.title}
          </Link>
        </div>
        <span className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap">
          {!listBadge && variant === 'new'
            ? `🆕 ${formatMatchupRegisteredAt(matchup, formatDate)} 생성됨`
            : formatMatchupRegisteredAt(matchup, formatDate)}
        </span>
      </div>

      {/* ── 추천: 태그 노출 (listBadge가 아닐 때만) ── */}
      {!listBadge && variant === 'hot' && matchup.tags?.length > 0 && (
        <div className="px-4 lg:px-4 pb-2 flex flex-wrap gap-1.5">
          {matchup.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="text-[10px] font-bold text-violet-500 bg-violet-50 px-2 py-0.5 rounded-full">
              #{tag.replace(/\s/g, '_')}
            </span>
          ))}
        </div>
      )}

      {/* ── 참가자 (유저 A · vs · 유저 B) ── */}
      <MatchupFeedParticipants
        className="px-4 lg:px-4 pb-2"
        leftProfile={profile}
        rightProfile={matchup.right_profiles}
        leftRankInfo={matchup._creatorRankInfo}
        rightRankInfo={matchup._rightCreatorRankInfo}
        showRight={matchup.right_type != null}
        size="feed"
      />

      {/* ── 썸네일 경쟁 영역 ── */}
      <div className="px-3 lg:px-4 pb-2">
        <div className="relative isolate grid grid-cols-2 gap-2 lg:gap-3 items-stretch w-full lg:max-w-xl lg:mx-auto">
          {/* A 썸네일 */}
          <ThumbnailCell
            type={matchup.left_type}
            url={matchup.left_url}
            thumbnail={matchup.left_thumbnail_url}
            text={matchup.left_text}
            label={matchup.left_label || 'A'}
            voted={userVote === 'left'}
            side="left"
            eagerMedia={eagerMedia}
            onOpenMedia={setViewerMedia}
            media={matchupSideToMedia(matchup, 'left')}
          />

          {/* B 썸네일 or 도전자 슬롯 */}
          {isComplete ? (
            <ThumbnailCell
              type={matchup.right_type}
              url={matchup.right_url}
              thumbnail={matchup.right_thumbnail_url}
              text={matchup.right_text}
              label={matchup.right_label || 'B'}
              voted={userVote === 'right'}
              side="right"
              eagerMedia={eagerMedia}
              onOpenMedia={setViewerMedia}
              media={matchupSideToMedia(matchup, 'right')}
            />
          ) : (
            <div className="relative z-0 aspect-square rounded-xl overflow-hidden border border-dashed border-emerald-400/35 bg-gradient-to-br from-emerald-950/85 via-teal-950/75 to-cyan-950/80 flex flex-col items-center justify-center gap-1.5">
              <span className="text-2xl">⚔️</span>
              <span className="text-[10px] font-black text-emerald-300 tracking-wide text-center leading-tight">도전자 모집 중</span>
              <span className="text-[9px] font-semibold text-teal-400/80 text-center">먼저 도전해보세요!</span>
            </div>
          )}

          {/* VS 중앙 배지 — 썸네일 콘텐츠 위에 표시 */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2">
            <VsBadge size="lg" className="lg:hidden" />
            <VsBadge size="md" className="hidden lg:block" />
          </div>
        </div>

        {/* 투표율 바 (애니메이션) */}
        {showVoteBar && (
          <div className="mt-2.5 lg:max-w-xl lg:mx-auto">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-fuchsia-700 w-9 text-right shrink-0 tabular-nums">{left}%</span>
              <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden flex ring-1 ring-gray-200/80">
                <div
                  className={`bg-gradient-to-r from-fuchsia-500 via-pink-500 to-rose-400 h-full shadow-[0_0_10px_rgba(217,70,239,0.35)] ${barAnimated ? 'animate-vote-bar-rise' : ''}`}
                  style={{ width: barAnimated ? `${left}%` : '0%' }}
                />
                <div
                  className={`bg-gradient-to-r from-sky-400 to-blue-600 h-full shadow-[0_0_10px_rgba(14,165,233,0.35)] ${barAnimated ? 'animate-vote-bar-rise-delayed' : ''}`}
                  style={{ width: barAnimated ? `${right}%` : '0%' }}
                />
              </div>
              <span className="text-xs font-black text-sky-700 w-9 shrink-0 tabular-nums">{right}%</span>
            </div>
          </div>
        )}
      </div>

      {/* ── 하단 액션 ── */}
      <div className={cn(
        'px-4 lg:px-4 pb-3.5 lg:pb-4 pt-2 flex items-center justify-between border-t',
        variant === 'best' ? 'border-amber-100/80' :
        variant === 'hot' ? 'border-fuchsia-100/80' :
        variant === 'new' ? 'border-emerald-100/80' :
        'border-gray-100/80',
      )}>
        <div className="flex items-center gap-3">
          {/* 참여자 */}
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Users className="w-[11px] h-[11px] shrink-0" />
            <span>{formatNumber(matchup.total_votes || 0)}</span>
          </div>
          {/* 좋아요 */}
          <button
            onClick={handleLike}
            className={`flex items-center gap-1 text-xs font-medium transition-all active:scale-90 ${
              liked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'
            }`}
          >
            <Heart className="w-3 h-3" fill={liked ? 'currentColor' : 'none'} />
            <span>{formatNumber(matchup.likes_count || 0)}</span>
          </button>
          {/* 댓글 */}
          <Link
            to={`/matchup/${matchup.id}#comments`}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#22282E] transition-colors"
          >
            <MessageCircle className="w-3 h-3" />
            <span>{formatNumber(matchup.comments_count || 0)}</span>
          </Link>
        </div>

        {/* CTA 버튼 */}
        {!isComplete && user && matchup.user_id !== user.id ? (
          <button
            onClick={() => openChallengeDrawer(matchup)}
            className="flex items-center gap-1 text-xs font-black text-[#0f1f0f]
              bg-gradient-to-r from-lime-400 via-emerald-400 to-teal-500
              px-3 py-1.5 rounded-xl
              hover:scale-[1.04] active:scale-[0.96] transition-all shadow-[0_0_18px_rgba(132,204,22,0.45)]"
          >
            <Swords className="w-[11px] h-[11px]" />
            도전하기
          </button>
        ) : (
          <Link
            to={`/matchup/${matchup.id}`}
            className="flex items-center gap-1 text-xs font-black text-white bg-gradient-to-r from-fuchsia-600 to-sky-500 hover:shadow-[0_0_18px_rgba(217,70,239,0.4)] px-3 py-1.5 rounded-xl transition-all"
          >
            {userVote ? '결과 보기' : '상세/투표'}
            <ArrowRight className="w-[11px] h-[11px]" />
          </Link>
        )}
      </div>

      <MatchupMediaViewer
        open={Boolean(viewerMedia)}
        media={viewerMedia}
        onClose={() => setViewerMedia(null)}
      />
    </div>
  )
}

// ── 썸네일 셀 (탭 시 크게 보기) ─────────────────────────────────────
function ThumbnailCell({
  type,
  url,
  thumbnail,
  text,
  label,
  voted,
  side = 'left',
  eagerMedia = false,
  media,
  onOpenMedia,
}) {
  const resolvedType = resolveMatchupSideType(type, { text, url, thumbnail })
  const displayText = readMatchupSideText(resolvedType, text)
  const ring =
    side === 'left'
      ? 'ring-[2.5px] ring-fuchsia-500 shadow-[0_0_18px_rgba(217,70,239,0.35)]'
      : 'ring-[2.5px] ring-sky-500 shadow-[0_0_18px_rgba(14,165,233,0.35)]'
  return (
    <div
      className={`relative z-0 aspect-square w-full transition-all duration-200 rounded-xl ${
        voted ? ring : ''
      }`}
    >
      <MatchupThumbFrame side={side} className="h-full w-full rounded-xl">
        <MatchupMediaOpenButton media={media} onOpen={onOpenMedia} className="h-full min-h-0">
        {/* 콘텐츠 */}
        {resolvedType === 'image' && (url || thumbnail) && (
          <img
            src={safeMediaUrl(thumbnail || url)}
            alt={side === 'left' ? 'A측' : 'B측'}
            className="h-full w-full object-cover"
            loading={eagerMedia ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={eagerMedia ? 'high' : 'low'}
          />
        )}
        {resolvedType === 'video' && (
          <>
            {(thumbnail || url) && (
              <img
                src={safeMediaUrl(thumbnail || url)}
                alt={side === 'left' ? 'A측' : 'B측'}
                className="h-full w-full object-cover"
                loading={eagerMedia ? 'eager' : 'lazy'}
                decoding="async"
                fetchPriority={eagerMedia ? 'high' : 'low'}
              />
            )}
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/30">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <Play className="ml-0.5 w-3.5 h-3.5 fill-white text-white" />
              </div>
            </div>
          </>
        )}
        {resolvedType === 'text' && (
          <div className={cn(
            'flex h-full w-full items-center justify-center p-3',
            side === 'left'
              ? 'bg-gradient-to-br from-amber-950/90 via-orange-900/80 to-rose-950/85'
              : 'bg-gradient-to-br from-violet-950/90 via-fuchsia-900/80 to-indigo-950/85',
          )}>
            <p className="line-clamp-4 whitespace-pre-wrap text-center text-xs font-bold leading-relaxed text-white/90 drop-shadow-sm">{displayText || '—'}</p>
          </div>
        )}

        {/* 그라데이션 오버레이 */}
        {resolvedType !== 'text' && (
          <div className="pointer-events-none absolute inset-0 z-[8] bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        )}

        {/* 투표됨 체크 */}
        {voted && (
          <div className="pointer-events-none absolute bottom-2 right-2 z-10">
          <span
            className={`text-[11px] font-black text-white px-1.5 py-0.5 rounded-md ${
              side === 'left'
                ? 'bg-gradient-to-r from-fuchsia-600 to-pink-500'
                : 'bg-gradient-to-r from-sky-500 to-blue-600'
            }`}
          >
            ✓
          </span>
          </div>
        )}
        </MatchupMediaOpenButton>
      </MatchupThumbFrame>
    </div>
  )
}
