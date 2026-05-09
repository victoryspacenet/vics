import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Heart, MessageCircle, Share2, Link2, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { safeMediaUrl } from '../../lib/sanitize'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { Avatar } from '../ui/Avatar'
import { FeaturedBadgeSpan } from '../ui/FeaturedBadge'
import { UserProfileLink } from '../ui/UserProfileLink'
import { LevelBadge } from '../ui/LevelBadge'
import { TierBadge } from '../ui/TierBadge'
import { VoteBar } from './VoteBar'
import { VoteFireworks } from '../ui/VoteFireworks'
import { MatchupThumbFrame } from '../ui/MatchupThumbFrame'
import { getTier, tierAtLeast } from '../../lib/tiers'
import { isFeedBannerHighlightActive } from '../../lib/bannerHighlightBoost'
import { isMatchupCreatorVipTierGlow, VIP_MATCHUP_SURFACE_CLASS } from '../../lib/matchupCreatorVipGlow'
import { formatDate, formatNumber, copyToClipboard, calcPercent, cn } from '../../lib/utils'
import { fandomTierHasDiamondListNicknameAura } from '../../lib/fandomTiers'
import { FandomBronzeStarBadge } from '../fandom/FandomBronzeStarBadge'

export function MatchupCard({ matchup: initialMatchup, compact, onVoteUpdate }) {
  const { user, profile, fetchProfile } = useAuthStore()
  const { showToast } = useUIStore()
  const navigate = useNavigate()

  const [matchup, setMatchup] = useState(initialMatchup)
  const [userVote, setUserVote] = useState(null)
  const [isVoting, setIsVoting] = useState(false)
  const [voteLocked, setVoteLocked] = useState(false)
  const [liked, setLiked] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [fireworkTrigger, setFireworkTrigger] = useState(0)
  const [fireworkPos, setFireworkPos] = useState({ x: 0, y: 0 })

  const isComplete = matchup.right_type != null
  const userTier = getTier(profile || {})

  useEffect(() => {
    setMatchup(initialMatchup)
  }, [initialMatchup])

  useEffect(() => {
    if (user && matchup.id) {
      fetchUserVote()
      fetchUserLike()
    }
  }, [user, matchup.id])

  const fetchUserVote = async () => {
    const { data } = await supabase
      .from('votes')
      .select('side')
      .eq('user_id', user.id)
      .eq('matchup_id', matchup.id)
      .maybeSingle()
    if (data) {
      setUserVote(data.side)
      setVoteLocked(true)
    }
  }

  const fetchUserLike = async () => {
    const { data } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', user.id)
      .eq('matchup_id', matchup.id)
      .maybeSingle()
    setLiked(!!data)
  }

  const handleVote = async (side, e) => {
    if (!user) return
    if (isVoting || !isComplete) return
    if (tierAtLeast(userTier, 'master') && e) {
      setFireworkPos({ x: e.clientX, y: e.clientY })
      setFireworkTrigger((t) => t + 1)
    }
    setIsVoting(true)
    try {
      if (!userVote) {
        // 신규 투표
        const { error } = await supabase
          .from('votes')
          .insert({ user_id: user.id, matchup_id: matchup.id, side })
        if (error) throw error

        setUserVote(side)
        setMatchup((prev) => ({
          ...prev,
          left_votes: side === 'left' ? (prev.left_votes || 0) + 1 : prev.left_votes,
          right_votes: side === 'right' ? (prev.right_votes || 0) + 1 : prev.right_votes,
          total_votes: (prev.total_votes || 0) + 1,
        }))
        showToast('투표 완료! 매치업 종료 후 결과에 따라 포인트가 지급돼요', 'success')
        setVoteLocked(true)
        setTimeout(() => fetchProfile(user.id), 800)
      }
      onVoteUpdate?.()
    } catch (err) {
      showToast('투표 중 오류가 발생했어요', 'error')
    } finally {
      setIsVoting(false)
    }
  }

  const handleLike = async () => {
    if (!user) return
    try {
      if (liked) {
        await supabase.from('likes').delete()
          .eq('user_id', user.id).eq('matchup_id', matchup.id)
        setLiked(false)
        setMatchup((prev) => ({ ...prev, likes_count: Math.max(0, (prev.likes_count || 0) - 1) }))
      } else {
        await supabase.from('likes').insert({ user_id: user.id, matchup_id: matchup.id })
        setLiked(true)
        setMatchup((prev) => ({ ...prev, likes_count: (prev.likes_count || 0) + 1 }))
      }
    } catch (err) {
      showToast('오류가 발생했어요', 'error')
    }
  }

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/matchup/${matchup.id}`
    await copyToClipboard(url)
    setLinkCopied(true)
    showToast('링크가 복사됐어요!', 'success')
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const handleShare = () => {
    const url = `${window.location.origin}/matchup/${matchup.id}`
    if (navigator.share) {
      navigator.share({ title: matchup.title, url })
    } else {
      handleCopyLink()
    }
  }

  const { left, right } = calcPercent(matchup.left_votes, matchup.right_votes)
  const creator = matchup.profiles
  const bannerGlow = isFeedBannerHighlightActive(matchup)
  const vipFrame =
    !bannerGlow && isMatchupCreatorVipTierGlow(creator, matchup._creatorRankInfo)

  return (
    <div
      className={cn(
        'rounded-2xl border transition-all overflow-hidden',
        bannerGlow
          ? 'vics-feed-banner-highlight shadow-none'
          : 'border-gray-100/90 bg-gradient-to-br from-white via-white to-slate-50/50 shadow-card hover:shadow-card-hover hover:via-cyan-50/15',
        vipFrame && VIP_MATCHUP_SURFACE_CLASS,
        vipFrame && 'sm:scale-[1.006]',
      )}
    >
      {/* 헤더 */}
      <div className="relative z-[6] px-4 pt-4 pb-3 flex items-start gap-3">
        <UserProfileLink userId={creator?.id} className="inline-flex shrink-0">
          <Avatar src={creator?.avatar_url} alt={creator?.nickname} size="sm" />
        </UserProfileLink>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {bannerGlow && (
              <span className="shrink-0 rounded-full border border-white/50 bg-gradient-to-r from-fuchsia-600 via-violet-600 to-cyan-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow-[0_0_12px_rgba(217,70,239,0.5)]">
                네온 부스트
              </span>
            )}
            <UserProfileLink
              userId={creator?.id}
              className={cn(
                'text-sm font-semibold text-[#22282E] hover:underline truncate',
                fandomTierHasDiamondListNicknameAura(creator?.fandom_tier) && 'vics-fandom-diamond-nickname-aura',
              )}
            >
              {creator?.nickname || '사용자'}
            </UserProfileLink>
            <FandomBronzeStarBadge tierId={creator?.fandom_tier} />
            <FeaturedBadgeSpan badgeId={creator?.featured_badge} className="translate-y-px" />
            <LevelBadge points={creator?.points || 0} variant="badge" />
            <TierBadge profile={creator} rankInfo={matchup._creatorRankInfo || {}} variant="compact" />
            <span className="text-xs text-gray-400">{formatDate(matchup.created_at)}</span>
          </div>
          <Link to={`/matchup/${matchup.id}`}>
            <h3 className="text-sm font-bold text-[#22282E] mt-0.5 hover:underline line-clamp-1">
              {matchup.title}
            </h3>
          </Link>
        </div>
      </div>

      {matchup.description && !compact && (
        <p className="px-4 text-xs text-gray-500 mb-3 line-clamp-2">{matchup.description}</p>
      )}

      {/* 콘텐츠 영역 */}
      <Link to={`/matchup/${matchup.id}`} className="block">
        <div className="grid grid-cols-2 gap-1 px-1 mb-1">
          <ContentBox
            type={matchup.left_type}
            url={matchup.left_url}
            text={matchup.left_text}
            thumbnail={matchup.left_thumbnail_url}
            label={matchup.left_label || 'A'}
            voted={userVote === 'left'}
            compact={compact}
            side="left"
          />
          {isComplete ? (
            <ContentBox
              type={matchup.right_type}
              url={matchup.right_url}
              text={matchup.right_text}
              thumbnail={matchup.right_thumbnail_url}
              label={matchup.right_label || 'B'}
              voted={userVote === 'right'}
              compact={compact}
              side="right"
            />
          ) : (
            <div className="flex items-center justify-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 aspect-square text-gray-300 text-xs">
              도전자 모집 중
            </div>
          )}
        </div>
      </Link>

      {/* 투표 버튼 */}
      {isComplete && (
        <div className="grid grid-cols-2 gap-1 px-1 mb-3">
          <VoteButton
            side="left"
            label={matchup.left_label || 'A'}
            voted={userVote === 'left'}
            locked={voteLocked && userVote !== 'left'}
            guestLocked={!user}
            onClick={(e) => handleVote('left', e)}
          />
          <VoteButton
            side="right"
            label={matchup.right_label || 'B'}
            voted={userVote === 'right'}
            locked={voteLocked && userVote !== 'right'}
            guestLocked={!user}
            onClick={(e) => handleVote('right', e)}
          />
        </div>
      )}

      {/* 투표 결과 바 */}
      {userVote && isComplete && (
        <div className="px-4 mb-3">
          <VoteBar
            leftPercent={left}
            rightPercent={right}
            leftLabel={matchup.left_label || 'A'}
            rightLabel={matchup.right_label || 'B'}
            totalVotes={matchup.total_votes || 0}
          />
        </div>
      )}

      {/* 하단 액션 */}
      <div className="px-4 pb-4 flex items-center gap-1 border-t border-gray-50 pt-3">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors ${
            liked ? 'text-red-500' : 'text-gray-400 hover:text-red-400 hover:bg-gray-50'
          }`}
        >
          <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
          <span>{formatNumber(matchup.likes_count || 0)}</span>
        </button>

        <Link
          to={`/matchup/${matchup.id}#comments`}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:text-[#22282E] hover:bg-gray-50 transition-colors"
        >
          <MessageCircle size={14} />
          <span>{formatNumber(matchup.comments_count || 0)}</span>
        </Link>

        <div className="flex-1" />

        <span className="text-xs text-gray-400 mr-2">
          {formatNumber(matchup.total_votes || 0)}표
        </span>

        <button
          onClick={handleCopyLink}
          className="p-1.5 rounded-lg text-gray-400 hover:text-[#22282E] hover:bg-gray-50 transition-colors"
        >
          {linkCopied ? <Check size={14} className="text-green-500" /> : <Link2 size={14} />}
        </button>

        <button
          onClick={handleShare}
          className="p-1.5 rounded-lg text-gray-400 hover:text-[#22282E] hover:bg-gray-50 transition-colors"
        >
          <Share2 size={14} />
        </button>
      </div>

      <VoteFireworks trigger={fireworkTrigger} x={fireworkPos.x} y={fireworkPos.y} />
    </div>
  )
}

function ContentBox({ type, url, text, thumbnail, label, voted, compact, side = 'left' }) {
  const height = compact ? 'h-28' : 'h-36'
  const neonRing =
    side === 'left'
      ? 'ring-2 ring-fuchsia-500 shadow-[0_0_20px_rgba(217,70,239,0.35)]'
      : 'ring-2 ring-sky-500 shadow-[0_0_20px_rgba(14,165,233,0.35)]'
  const labelBar =
    side === 'left'
      ? 'bg-gradient-to-r from-fuchsia-600 to-pink-500'
      : 'bg-gradient-to-r from-sky-500 to-blue-600'
  return (
    <MatchupThumbFrame side={side} className={cn('w-full', height)} innerClassName="h-full">
      {voted && (
        <div className={`pointer-events-none absolute inset-0 z-[8] rounded-[10px] ${neonRing}`} />
      )}
      <span className={`absolute left-2 top-2 z-10 ${labelBar} rounded-md px-2 py-0.5 text-xs font-bold text-white shadow-sm`}>
        {label}
      </span>
      {type === 'image' && url && (
        <img src={safeMediaUrl(thumbnail || url)} alt={label ?? ''} className="h-full w-full object-cover" />
      )}
      {type === 'video' && (url || thumbnail) && (
        <img src={safeMediaUrl(thumbnail || url)} alt={label ?? ''} className="h-full w-full object-cover" />
      )}
      {type === 'text' && (
        <div className="flex h-full w-full items-center justify-center p-3">
          <p className="line-clamp-2 text-center text-xs font-medium text-[#22282E]">{text}</p>
        </div>
      )}
    </MatchupThumbFrame>
  )
}

function VoteButton({ side, label, voted, locked, guestLocked, onClick }) {
  const isLeft = side === 'left'
  const chosen =
    'text-white shadow-lg active:scale-[0.98] ' +
    (isLeft
      ? 'bg-gradient-to-r from-fuchsia-600 to-pink-500 shadow-[0_0_22px_rgba(217,70,239,0.45)]'
      : 'bg-gradient-to-r from-sky-500 to-blue-600 shadow-[0_0_22px_rgba(14,165,233,0.45)]')
  const idle =
    (isLeft
      ? 'bg-gradient-to-r from-fuchsia-500 to-pink-400 text-white hover:shadow-[0_0_20px_rgba(217,70,239,0.4)] hover:scale-[1.02]'
      : 'bg-gradient-to-r from-sky-400 to-blue-500 text-white hover:shadow-[0_0_20px_rgba(14,165,233,0.4)] hover:scale-[1.02]') +
    ' active:scale-[0.97]'
  const disabled = locked || guestLocked
  const guestIdle = guestLocked && !voted && !locked
  return (
    <button
      type="button"
      title={guestIdle ? '로그인 후 투표할 수 있어요' : undefined}
      onClick={onClick}
      disabled={disabled}
      className={`py-2 rounded-xl text-xs font-black transition-all ${
        voted ? chosen : guestIdle ? 'cursor-not-allowed bg-slate-100 text-slate-400 ring-1 ring-slate-200/90 shadow-none' : locked ? 'bg-gray-100 text-gray-300 cursor-not-allowed shadow-none' : idle
      }`}
    >
      {voted ? `✓ ${label}에 투표함` : guestIdle ? '로그인 후 투표' : `${label} 선택`}
    </button>
  )
}
