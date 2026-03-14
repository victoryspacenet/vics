import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Users, ArrowRight, Heart, MessageCircle, Swords, Play } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { formatDate, formatNumber, calcPercent } from '../../lib/utils'
import { LevelBadge } from '../ui/LevelBadge'
import { Avatar } from '../ui/Avatar'

// variant별 스타일 맵
const VARIANT_STYLE = {
  best: {
    badge: (rank) =>
      rank === 1 ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-900' :
      rank === 2 ? 'bg-gradient-to-r from-gray-300 to-gray-200 text-gray-700' :
      rank === 3 ? 'bg-gradient-to-r from-orange-400 to-amber-300 text-orange-900' :
                   'bg-gray-100 text-gray-500',
    label: (rank) => rank != null ? `RANK ${rank}` : 'RANK',
    border: 'border-gray-100 hover:border-orange-200',
  },
  hot: {
    badge: () => 'bg-gradient-to-r from-violet-500 to-purple-400 text-white',
    label: () => '✨ 박빙',
    border: 'border-gray-100 hover:border-violet-200',
  },
  new: {
    badge: () => 'bg-gradient-to-r from-emerald-400 to-teal-400 text-white',
    label: () => '🆕 NEW',
    border: 'border-gray-100 hover:border-emerald-200',
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

export function FeedCard({ matchup: initialMatchup, variant: variantProp, rank, listBadge, onVoteUpdate }) {
  const variant = listBadge ? getRandomBadgeVariant(initialMatchup.id) : (variantProp ?? 'new')
  const { user } = useAuthStore()
  const { showToast, openLoginModal, openChallengeDrawer } = useUIStore()

  const [matchup, setMatchup] = useState(initialMatchup)
  const [userVote, setUserVote] = useState(null)
  const [liked, setLiked] = useState(false)
  const [voteLocked, setVoteLocked] = useState(false)
  const [isVoting, setIsVoting] = useState(false)
  const [barAnimated, setBarAnimated] = useState(false)

  const isComplete = !!matchup.right_type
  const { left, right } = calcPercent(matchup.left_votes, matchup.right_votes)
  const profile = matchup.profiles

  const vs = VARIANT_STYLE[variant] || VARIANT_STYLE.new

  useEffect(() => { setMatchup(initialMatchup) }, [initialMatchup])

  useEffect(() => {
    if (user && matchup.id) { fetchUserVote(); fetchUserLike() }
  }, [user, matchup.id])

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
    if (!user) { openLoginModal(); return }
    if (isVoting || !isComplete) return
    setIsVoting(true)
    try {
      if (!userVote) {
        const { error } = await supabase.from('votes').insert({ user_id: user.id, matchup_id: matchup.id, side })
        if (error) throw error
        setUserVote(side)
        setMatchup((p) => ({
          ...p,
          left_votes:  side === 'left'  ? (p.left_votes  || 0) + 1 : p.left_votes,
          right_votes: side === 'right' ? (p.right_votes || 0) + 1 : p.right_votes,
          total_votes: (p.total_votes || 0) + 1,
        }))
        showToast('투표 완료! +2pt 획득 🎉', 'success')
        setTimeout(() => setVoteLocked(true), 5000)
        onVoteUpdate?.()
      } else if (!voteLocked && userVote !== side) {
        await supabase.from('votes').update({ side }).eq('user_id', user.id).eq('matchup_id', matchup.id)
        setMatchup((p) => ({
          ...p,
          left_votes:  side === 'left'  ? (p.left_votes  || 0) + 1 : userVote === 'left'  ? (p.left_votes  || 0) - 1 : p.left_votes,
          right_votes: side === 'right' ? (p.right_votes || 0) + 1 : userVote === 'right' ? (p.right_votes || 0) - 1 : p.right_votes,
        }))
        setUserVote(side)
        showToast('투표가 변경됐어요', 'info')
      }
    } catch { showToast('투표 중 오류가 발생했어요', 'error') }
    finally { setIsVoting(false) }
  }

  const handleLike = async (e) => {
    e.preventDefault(); e.stopPropagation()
    if (!user) { openLoginModal(); return }
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

  return (
    <div className={`bg-white border rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${vs.border}`}>

      {/* ── 카드 헤더 ── */}
      <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
          {/* 변형 뱃지 */}
          <span className={`shrink-0 text-[11px] font-black px-2 py-0.5 rounded-full ${listBadge ? vs.badge(variant === 'best' ? 1 : null) : vs.badge(rank)}`}>
            {listBadge ? LIST_BADGE_LABELS[variant] : vs.label(rank)}
          </span>
          <Link
            to={`/matchup/${matchup.id}`}
            className="text-sm font-black text-[#22282E] line-clamp-1 hover:underline flex-1 min-w-0"
          >
            {matchup.title}
          </Link>
        </div>
        <span className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap">
          {!listBadge && variant === 'new' ? `🆕 ${formatDate(matchup.created_at)} 생성됨` : formatDate(matchup.created_at)}
        </span>
      </div>

      {/* ── 추천: 태그 노출 (listBadge가 아닐 때만) ── */}
      {!listBadge && variant === 'hot' && matchup.tags?.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {matchup.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="text-[10px] font-bold text-violet-500 bg-violet-50 px-2 py-0.5 rounded-full">
              #{tag.replace(/\s/g, '_')}
            </span>
          ))}
        </div>
      )}

      {/* ── 작성자 ── */}
      <div className="px-4 pb-2.5 flex items-center gap-1.5">
        <Avatar src={profile?.avatar_url} alt={profile?.nickname} size="xs" />
        <span className="text-xs text-gray-500 font-medium">{profile?.nickname || '사용자'}</span>
        <LevelBadge points={profile?.points || 0} variant="badge" className="text-[10px] px-1.5 py-0" />
      </div>

      {/* ── 썸네일 대결 영역 ── */}
      <div className="px-3 pb-2">
        <div className="relative grid grid-cols-2 gap-2 items-stretch">
          {/* A 썸네일 */}
          <ThumbnailCell
            type={matchup.left_type}
            url={matchup.left_url}
            thumbnail={matchup.left_thumbnail_url}
            text={matchup.left_text}
            label={matchup.left_label || 'A'}
            voted={userVote === 'left'}
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
            />
          ) : (
            <div className="aspect-square bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1">
              <Swords size={18} className="text-gray-300" />
              <span className="text-[10px] text-gray-400 font-bold text-center leading-tight">도전자<br/>모집 중</span>
            </div>
          )}

          {/* VS 중앙 배지 */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-9 h-9 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center shadow-sm z-10">
              <span className="text-[11px] font-black text-gray-400">VS</span>
            </div>
          </div>
        </div>

        {/* 투표율 바 (애니메이션) */}
        {showVoteBar && (
          <div className="mt-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-[#22282E] w-9 text-right shrink-0">{left}%</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden flex">
                <div
                  className="bg-gradient-to-r from-[#22282E] to-gray-600 h-full transition-all duration-700 ease-out"
                  style={{ width: barAnimated ? `${left}%` : '0%' }}
                />
                <div
                  className="bg-gray-300 h-full transition-all duration-700 ease-out"
                  style={{ width: barAnimated ? `${right}%` : '0%', transitionDelay: '50ms' }}
                />
              </div>
              <span className="text-xs font-black text-gray-400 w-9 shrink-0">{right}%</span>
            </div>
          </div>
        )}
      </div>

      {/* ── 하단 액션 ── */}
      <div className="px-4 pb-3.5 pt-2 flex items-center justify-between border-t border-gray-50">
        <div className="flex items-center gap-3">
          {/* 참여자 */}
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Users size={11} />
            <span>{formatNumber(matchup.total_votes || 0)}</span>
          </div>
          {/* 좋아요 */}
          <button
            onClick={handleLike}
            className={`flex items-center gap-1 text-xs font-medium transition-all active:scale-90 ${
              liked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'
            }`}
          >
            <Heart size={12} fill={liked ? 'currentColor' : 'none'} />
            <span>{formatNumber(matchup.likes_count || 0)}</span>
          </button>
          {/* 댓글 */}
          <Link
            to={`/matchup/${matchup.id}#comments`}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#22282E] transition-colors"
          >
            <MessageCircle size={12} />
            <span>{formatNumber(matchup.comments_count || 0)}</span>
          </Link>
        </div>

        {/* CTA 버튼 */}
        {!isComplete && user && matchup.user_id !== user.id ? (
          <button
            onClick={() => openChallengeDrawer(matchup)}
            className="flex items-center gap-1 text-xs font-black text-white
              bg-gradient-to-r from-[#22282E] to-gray-700
              px-3 py-1.5 rounded-xl
              hover:scale-[1.04] active:scale-[0.96] transition-all shadow-sm"
          >
            <Swords size={11} />
            도전하기
          </button>
        ) : (
          <Link
            to={`/matchup/${matchup.id}`}
            className="flex items-center gap-1 text-xs font-bold text-[#22282E] bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-xl transition-colors"
          >
            {userVote ? '결과 보기' : '상세/투표'}
            <ArrowRight size={11} />
          </Link>
        )}
      </div>
    </div>
  )
}

// ── 썸네일 셀 (목록 페이지: 클릭 투표 비활성화) ─────────────────────
function ThumbnailCell({ type, url, thumbnail, text, label, voted }) {
  return (
    <div
      className={`relative aspect-square rounded-xl overflow-hidden bg-gray-50 w-full transition-all duration-200 ${
        voted ? 'ring-[2.5px] ring-[#22282E] shadow-md' : ''
      }`}
    >
      {/* 콘텐츠 */}
      {type === 'image' && (url || thumbnail) && (
        <img
          src={thumbnail || url}
          alt={label}
          className="w-full h-full object-cover"
        />
      )}
      {type === 'video' && (
        <>
          {(thumbnail || url) && (
            <img src={thumbnail || url} alt={label} className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <Play size={14} className="text-white fill-white ml-0.5" />
            </div>
          </div>
        </>
      )}
      {type === 'text' && (
        <div className="w-full h-full flex items-center justify-center p-3 bg-gradient-to-br from-gray-50 to-gray-100">
          <p className="text-xs font-semibold text-center text-[#22282E] line-clamp-4 leading-relaxed">{text}</p>
        </div>
      )}

      {/* 그라데이션 오버레이 */}
      {type !== 'text' && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
      )}

      {/* 라벨 (하단) */}
      <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between pointer-events-none">
        <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-md ${
          type === 'text' ? 'bg-[#22282E]/80 text-white' : 'text-white drop-shadow-md'
        }`}>
          {label}
        </span>
        {/* 투표됨 체크 */}
        {voted && (
          <span className="text-[11px] font-black bg-lime-400 text-lime-900 px-1.5 py-0.5 rounded-md">✓</span>
        )}
      </div>

    </div>
  )
}
