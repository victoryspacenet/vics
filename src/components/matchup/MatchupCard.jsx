import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Heart, MessageCircle, Share2, Link2, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { Avatar } from '../ui/Avatar'
import { LevelBadge } from '../ui/LevelBadge'
import { VoteBar } from './VoteBar'
import { formatDate, formatNumber, copyToClipboard, calcPercent } from '../../lib/utils'

export function MatchupCard({ matchup: initialMatchup, compact, onVoteUpdate }) {
  const { user, fetchProfile } = useAuthStore()
  const { showToast, openLoginModal } = useUIStore()
  const navigate = useNavigate()

  const [matchup, setMatchup] = useState(initialMatchup)
  const [userVote, setUserVote] = useState(null)
  const [isVoting, setIsVoting] = useState(false)
  const [voteLocked, setVoteLocked] = useState(false)
  const [liked, setLiked] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const isComplete = matchup.right_type != null

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

  const handleVote = async (side) => {
    if (!user) { openLoginModal(); return }
    if (isVoting || !isComplete) return

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
        showToast('투표 완료! +2pt 획득 🎉', 'success')
        // 포인트 반영을 위해 프로필 갱신 (약간의 딜레이)
        setTimeout(() => fetchProfile(user.id), 800)

        // 5초 후 투표 잠금
        setTimeout(() => setVoteLocked(true), 5000)
      } else if (!voteLocked && userVote !== side) {
        // 투표 변경 (5초 내)
        const { error } = await supabase
          .from('votes')
          .update({ side })
          .eq('user_id', user.id)
          .eq('matchup_id', matchup.id)
        if (error) throw error

        setMatchup((prev) => ({
          ...prev,
          left_votes: side === 'left'
            ? (prev.left_votes || 0) + 1
            : userVote === 'left' ? (prev.left_votes || 0) - 1 : prev.left_votes,
          right_votes: side === 'right'
            ? (prev.right_votes || 0) + 1
            : userVote === 'right' ? (prev.right_votes || 0) - 1 : prev.right_votes,
        }))
        setUserVote(side)
        showToast('투표가 변경됐어요', 'info')
      }
      onVoteUpdate?.()
    } catch (err) {
      showToast('투표 중 오류가 발생했어요', 'error')
    } finally {
      setIsVoting(false)
    }
  }

  const handleLike = async () => {
    if (!user) { openLoginModal(); return }
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
  const profile = matchup.profiles

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-card hover:shadow-card-hover transition-shadow overflow-hidden">
      {/* 헤더 */}
      <div className="px-4 pt-4 pb-3 flex items-start gap-3">
        <Link to={`/profile/${profile?.id}`}>
          <Avatar src={profile?.avatar_url} alt={profile?.nickname} size="sm" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/profile/${profile?.id}`}
              className="text-sm font-semibold text-[#22282E] hover:underline truncate"
            >
              {profile?.nickname || '사용자'}
            </Link>
            <LevelBadge points={profile?.points || 0} variant="badge" />
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
            onClick={() => handleVote('left')}
          />
          <VoteButton
            side="right"
            label={matchup.right_label || 'B'}
            voted={userVote === 'right'}
            locked={voteLocked && userVote !== 'right'}
            onClick={() => handleVote('right')}
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
    </div>
  )
}

function ContentBox({ type, url, text, thumbnail, label, voted, compact }) {
  const height = compact ? 'h-28' : 'h-36'
  return (
    <div className={`relative rounded-xl overflow-hidden ${height} bg-gray-50`}>
      {voted && (
        <div className="absolute inset-0 ring-2 ring-[#22282E] rounded-xl z-10 pointer-events-none" />
      )}
      <span className="absolute top-2 left-2 bg-[#22282E]/80 text-white text-xs font-bold px-2 py-0.5 rounded-md z-10">
        {label}
      </span>
      {type === 'image' && url && (
        <img src={thumbnail || url} alt={label} className="w-full h-full object-cover" />
      )}
      {type === 'video' && (url || thumbnail) && (
        <img src={thumbnail || url} alt={label} className="w-full h-full object-cover" />
      )}
      {type === 'text' && (
        <div className="w-full h-full flex items-center justify-center p-3">
          <p className="text-xs text-center text-[#22282E] font-medium line-clamp-2">{text}</p>
        </div>
      )}
    </div>
  )
}

function VoteButton({ side, label, voted, locked, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={locked}
      className={`py-2 rounded-xl text-xs font-bold transition-all ${
        voted
          ? 'bg-[#22282E] text-white'
          : locked
          ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
          : 'bg-gray-50 text-gray-600 hover:bg-gray-100 active:scale-[0.97]'
      }`}
    >
      {voted ? `✓ ${label}에 투표함` : `${label} 선택`}
    </button>
  )
}
