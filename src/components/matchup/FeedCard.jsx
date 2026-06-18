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
import { safeMediaUrl } from '../../lib/sanitize'
import { LevelBadge } from '../ui/LevelBadge'
import { TierBadge } from '../ui/TierBadge'
import { getTier, tierAtLeast } from '../../lib/tiers'
import { Avatar } from '../ui/Avatar'
import { FeaturedBadgeSpan } from '../ui/FeaturedBadge'
import { UserProfileLink } from '../ui/UserProfileLink'
import { isFeedBannerHighlightActive } from '../../lib/bannerHighlightBoost'
import { VIP_MATCHUP_SURFACE_CLASS } from '../../lib/matchupCreatorVipGlow'
import { fandomTierHasDiamondListNicknameAura } from '../../lib/fandomTiers'
import { FandomBronzeStarBadge } from '../fandom/FandomBronzeStarBadge'
import { MatchupMediaOpenButton, MatchupMediaViewer } from './MatchupMediaViewer'
import { matchupSideToMedia } from '../../lib/matchupMediaView'
import { useMatchupEngagement } from './MatchupEngagementContext'

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
}

// matchup.id 기반 안정적 랜덤 배지 (베스트/추천/NEW)
function getRandomBadgeVariant(id) {
  const variants = ['best', 'hot', 'new']
  let h = 0
  for (let i = 0; i < String(id).length; i++) h += String(id).charCodeAt(i)
  return variants[Math.abs(h) % 3]
}

const LIST_BADGE_LABELS = { best: '베스트', hot: '추천', new: 'NEW' }

export function FeedCard({
  matchup: initialMatchup,
  variant: variantProp,
  rank,
  listBadge,
  /** `listBadge`일 때 우선 적용하는 역할 (`best`/`hot`). 없으면 id 해시 폴백. */
  listBadgeVariant,
  onVoteUpdate,
  eagerMedia = false,
}) {
  const variant = listBadge
    ? listBadgeVariant && ['best', 'hot', 'new'].includes(listBadgeVariant)
      ? listBadgeVariant
      : getRandomBadgeVariant(initialMatchup.id)
    : (variantProp ?? 'new')
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

  const vs = VARIANT_STYLE[variant] || VARIANT_STYLE.new

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
        'relative border rounded-2xl lg:rounded-3xl transition-all duration-300 overflow-hidden',
        bannerGlow
          ? 'vics-feed-banner-highlight vics-feed-banner-highlight--feed-lg shadow-none lg:shadow-none'
          : cn(
              `bg-gradient-to-br ${vs.bg ?? 'from-white via-white to-slate-50/55'}`,
              vs.shadow ?? 'shadow-sm lg:shadow-md',
              vs.hoverShadow ?? 'hover:shadow-md lg:hover:shadow-lg',
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
      <div className="relative z-[6] px-4 pt-4 pb-2 lg:px-6 lg:pt-5 lg:pb-3 flex items-start justify-between gap-2 lg:gap-3">
        <div className="flex items-center gap-2 lg:gap-2.5 min-w-0 flex-1 flex-wrap">
          {/* 변형 뱃지 */}
          <span className={`shrink-0 text-[11px] lg:text-xs font-black px-2 py-0.5 lg:px-2.5 lg:py-1 rounded-full ${listBadge ? vs.badge(variant === 'best' ? 1 : null) : vs.badge(rank)}`}>
            {listBadge ? LIST_BADGE_LABELS[variant] : vs.label(rank)}
          </span>
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
            className="text-sm lg:text-lg xl:text-xl font-black text-[#22282E] line-clamp-2 lg:line-clamp-1 hover:underline flex-1 min-w-0 leading-snug"
          >
            {matchup.title}
          </Link>
        </div>
        <span className="text-[11px] lg:text-sm text-gray-400 shrink-0 whitespace-nowrap">
          {!listBadge && variant === 'new' ? `🆕 ${formatDate(matchup.created_at)} 생성됨` : formatDate(matchup.created_at)}
        </span>
      </div>

      {/* ── 추천: 태그 노출 (listBadge가 아닐 때만) ── */}
      {!listBadge && variant === 'hot' && matchup.tags?.length > 0 && (
        <div className="px-4 lg:px-6 pb-2 flex flex-wrap gap-1.5 lg:gap-2">
          {matchup.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="text-[10px] lg:text-xs font-bold text-violet-500 bg-violet-50 px-2 py-0.5 lg:px-2.5 rounded-full">
              #{tag.replace(/\s/g, '_')}
            </span>
          ))}
        </div>
      )}

      {/* ── 작성자 ── */}
      <div className="px-4 lg:px-6 pb-2.5 lg:pb-3 flex items-center gap-1.5 lg:gap-2">
        <UserProfileLink userId={profile?.id} className="inline-flex shrink-0">
          <Avatar src={profile?.avatar_url} alt={profile?.nickname} size="xs" className="lg:w-8 lg:h-8 lg:text-sm" />
        </UserProfileLink>
        <UserProfileLink
          userId={profile?.id}
          className={cn(
            'text-xs lg:text-sm font-medium text-gray-500 min-w-0',
            fandomTierHasDiamondListNicknameAura(profile?.fandom_tier) &&
              'vics-fandom-diamond-nickname-aura text-slate-800',
          )}
        >
          {profile?.nickname || '사용자'}
        </UserProfileLink>
        <FandomBronzeStarBadge tierId={profile?.fandom_tier} />
        <FeaturedBadgeSpan badgeId={profile?.featured_badge} className="text-xs lg:text-sm translate-y-px" />
        <LevelBadge points={profile?.points || 0} variant="badge" className="text-[10px] lg:text-[11px] px-1.5 py-0 lg:px-2" />
        <TierBadge profile={profile} rankInfo={matchup._creatorRankInfo || {}} variant="compact" className="text-[9px] lg:text-[10px]" />
      </div>

      {/* ── 썸네일 경쟁 영역 ── */}
      <div className="px-3 lg:px-5 pb-2 lg:pb-3">
        <div className="relative grid grid-cols-2 gap-2 lg:gap-4 xl:gap-5 items-stretch">
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
            <div className="aspect-square rounded-xl lg:rounded-2xl overflow-hidden border border-dashed border-emerald-400/35 bg-gradient-to-br from-emerald-950/85 via-teal-950/75 to-cyan-950/80 flex flex-col items-center justify-center gap-1.5 lg:gap-2.5">
              <span className="text-2xl lg:text-4xl">⚔️</span>
              <span className="text-[10px] lg:text-sm font-black text-emerald-300 tracking-wide text-center leading-tight">도전자 모집 중</span>
              <span className="text-[9px] lg:text-xs font-semibold text-teal-400/80 text-center">먼저 도전해보세요!</span>
            </div>
          )}

          {/* VS 중앙 배지 */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none scale-100 lg:scale-110 xl:scale-125">
            <VsBadge size="lg" className="z-20" />
          </div>
        </div>

        {/* 투표율 바 (애니메이션) */}
        {showVoteBar && (
          <div className="mt-2.5 lg:mt-3.5">
            <div className="flex items-center gap-1.5 lg:gap-2">
              <span className="text-xs lg:text-sm font-black text-fuchsia-700 w-9 lg:w-11 text-right shrink-0 tabular-nums">{left}%</span>
              <div className="flex-1 h-2.5 lg:h-3.5 bg-gray-100 rounded-full overflow-hidden flex ring-1 ring-gray-200/80">
                <div
                  className={`bg-gradient-to-r from-fuchsia-500 via-pink-500 to-rose-400 h-full shadow-[0_0_10px_rgba(217,70,239,0.35)] ${barAnimated ? 'animate-vote-bar-rise' : ''}`}
                  style={{ width: barAnimated ? `${left}%` : '0%' }}
                />
                <div
                  className={`bg-gradient-to-r from-sky-400 to-blue-600 h-full shadow-[0_0_10px_rgba(14,165,233,0.35)] ${barAnimated ? 'animate-vote-bar-rise-delayed' : ''}`}
                  style={{ width: barAnimated ? `${right}%` : '0%' }}
                />
              </div>
              <span className="text-xs lg:text-sm font-black text-sky-700 w-9 lg:w-11 shrink-0 tabular-nums">{right}%</span>
            </div>
          </div>
        )}
      </div>

      {/* ── 하단 액션 ── */}
      <div className={cn(
        'px-4 lg:px-6 pb-3.5 lg:pb-5 pt-2 lg:pt-3 flex items-center justify-between border-t',
        variant === 'best' ? 'border-amber-100/80' :
        variant === 'hot' ? 'border-fuchsia-100/80' :
        'border-emerald-100/80',
      )}>
        <div className="flex items-center gap-3 lg:gap-4">
          {/* 참여자 */}
          <div className="flex items-center gap-1 lg:gap-1.5 text-xs lg:text-sm text-gray-400">
            <Users className="w-[11px] h-[11px] lg:w-[14px] lg:h-[14px] shrink-0" />
            <span>{formatNumber(matchup.total_votes || 0)}</span>
          </div>
          {/* 좋아요 */}
          <button
            onClick={handleLike}
            className={`flex items-center gap-1 lg:gap-1.5 text-xs lg:text-sm font-medium transition-all active:scale-90 ${
              liked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'
            }`}
          >
            <Heart className="w-3 h-3 lg:w-3.5 lg:h-3.5" fill={liked ? 'currentColor' : 'none'} />
            <span>{formatNumber(matchup.likes_count || 0)}</span>
          </button>
          {/* 댓글 */}
          <Link
            to={`/matchup/${matchup.id}#comments`}
            className="flex items-center gap-1 lg:gap-1.5 text-xs lg:text-sm text-gray-400 hover:text-[#22282E] transition-colors"
          >
            <MessageCircle className="w-3 h-3 lg:w-3.5 lg:h-3.5" />
            <span>{formatNumber(matchup.comments_count || 0)}</span>
          </Link>
        </div>

        {/* CTA 버튼 */}
        {!isComplete && user && matchup.user_id !== user.id ? (
          <button
            onClick={() => openChallengeDrawer(matchup)}
            className="flex items-center gap-1 lg:gap-1.5 text-xs lg:text-sm font-black text-[#0f1f0f]
              bg-gradient-to-r from-lime-400 via-emerald-400 to-teal-500
              px-3 py-1.5 lg:px-4 lg:py-2 rounded-xl
              hover:scale-[1.04] active:scale-[0.96] transition-all shadow-[0_0_18px_rgba(132,204,22,0.45)]"
          >
            <Swords className="w-[11px] h-[11px] lg:w-3.5 lg:h-3.5" />
            도전하기
          </button>
        ) : (
          <Link
            to={`/matchup/${matchup.id}`}
            className="flex items-center gap-1 lg:gap-1.5 text-xs lg:text-sm font-black text-white bg-gradient-to-r from-fuchsia-600 to-sky-500 hover:shadow-[0_0_18px_rgba(217,70,239,0.4)] px-3 py-1.5 lg:px-4 lg:py-2 rounded-xl transition-all"
          >
            {userVote ? '결과 보기' : '상세/투표'}
            <ArrowRight className="w-[11px] h-[11px] lg:w-3.5 lg:h-3.5" />
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
  const ring =
    side === 'left'
      ? 'ring-[2.5px] ring-fuchsia-500 shadow-[0_0_18px_rgba(217,70,239,0.35)]'
      : 'ring-[2.5px] ring-sky-500 shadow-[0_0_18px_rgba(14,165,233,0.35)]'
  return (
    <div
      className={`relative aspect-square w-full transition-all duration-200 rounded-xl lg:rounded-2xl ${
        voted ? ring : ''
      }`}
    >
      <MatchupThumbFrame side={side} className="h-full w-full rounded-xl lg:rounded-2xl">
        <MatchupMediaOpenButton media={media} onOpen={onOpenMedia} className="h-full min-h-0">
        {/* 콘텐츠 */}
        {type === 'image' && (url || thumbnail) && (
          <img
            src={safeMediaUrl(thumbnail || url)}
            alt={label}
            className="h-full w-full object-cover"
            loading={eagerMedia ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={eagerMedia ? 'high' : 'low'}
          />
        )}
        {type === 'video' && (
          <>
            {(thumbnail || url) && (
              <img
                src={safeMediaUrl(thumbnail || url)}
                alt={label ?? ''}
                className="h-full w-full object-cover"
                loading={eagerMedia ? 'eager' : 'lazy'}
                decoding="async"
                fetchPriority={eagerMedia ? 'high' : 'low'}
              />
            )}
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/30">
              <div className="flex h-8 w-8 lg:h-11 lg:w-11 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <Play className="ml-0.5 w-3.5 h-3.5 lg:w-5 lg:h-5 fill-white text-white" />
              </div>
            </div>
          </>
        )}
        {type === 'text' && (
          <div className={cn(
            'flex h-full w-full items-center justify-center p-3 lg:p-5',
            side === 'left'
              ? 'bg-gradient-to-br from-amber-950/90 via-orange-900/80 to-rose-950/85'
              : 'bg-gradient-to-br from-violet-950/90 via-fuchsia-900/80 to-indigo-950/85',
          )}>
            <p className="line-clamp-4 lg:line-clamp-6 text-center text-xs lg:text-base font-bold leading-relaxed text-white/90 drop-shadow-sm">{text}</p>
          </div>
        )}

        {/* 그라데이션 오버레이 */}
        {type !== 'text' && (
          <div className="pointer-events-none absolute inset-0 z-[8] bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        )}

        {/* 라벨 (하단) */}
        <div className="pointer-events-none absolute bottom-2 left-2 right-2 lg:bottom-3 lg:left-3 lg:right-3 z-10 flex items-end justify-between">
        <span className={`text-[11px] lg:text-sm font-black px-1.5 py-0.5 lg:px-2 lg:py-1 rounded-md ${
          type === 'text'
            ? side === 'left'
              ? 'bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white'
              : 'bg-gradient-to-r from-sky-500 to-blue-600 text-white'
            : 'text-white drop-shadow-md'
        }`}>
          {label}
        </span>
        {/* 투표됨 체크 */}
        {voted && (
          <span
            className={`text-[11px] lg:text-sm font-black text-white px-1.5 py-0.5 lg:px-2 rounded-md ${
              side === 'left'
                ? 'bg-gradient-to-r from-fuchsia-600 to-pink-500'
                : 'bg-gradient-to-r from-sky-500 to-blue-600'
            }`}
          >
            ✓
          </span>
        )}
      </div>
        </MatchupMediaOpenButton>
      </MatchupThumbFrame>
    </div>
  )
}
