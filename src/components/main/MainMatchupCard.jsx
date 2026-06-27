import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Play } from 'lucide-react'
import { MatchupMediaOpenButton, MatchupMediaViewer } from '../matchup/MatchupMediaViewer'
import { matchupSideToMedia } from '../../lib/matchupMediaView'
import { isFeedDemoMatchupId } from '../../lib/matchupIds'
import { useUIStore } from '../../store/uiStore'
import { formatNumber, formatDate, calcPercent, cn } from '../../lib/utils'
import { VsBadge } from '../ui/VsBadge'
import { MatchupThumbFrame } from '../ui/MatchupThumbFrame'
import { safeMediaUrl } from '../../lib/sanitize'
import { isFeedBannerHighlightActive } from '../../lib/bannerHighlightBoost'
import { isMatchupCreatorVipTierGlow, VIP_MATCHUP_SURFACE_CLASS } from '../../lib/matchupCreatorVipGlow'
import { MatchupFeedParticipants } from '../matchup/MatchupFeedParticipants'
import { matchupSideBadge } from '../../lib/matchupContentSide'

/** 이미지·영상·텍스트 썸네일 (영상은 썸네일 없을 때 video 태그로 표시 — img에 mp4 넣으면 깨짐) */
function MatchupSidePreview({ side, matchup: m, eagerMedia = false }) {
  const isLeft = side === 'left'
  const type = isLeft ? m.left_type : m.right_type
  const url = isLeft ? m.left_url : m.right_url
  const thumb = isLeft ? m.left_thumbnail_url : m.right_thumbnail_url
  const sideBadge = matchupSideBadge(side)
  const text = isLeft ? m.left_text : m.right_text

  const safeThumb = safeMediaUrl(thumb || '')
  const safeUrl = safeMediaUrl(url || '')

  if (type === 'text') {
    const textGrad = isLeft
      ? 'from-amber-950/90 via-orange-900/80 to-rose-950/85'
      : 'from-violet-950/90 via-fuchsia-900/80 to-indigo-950/85'
    return (
      <div className={`flex h-full min-h-[4rem] w-full items-center justify-center bg-gradient-to-br ${textGrad} p-3`}>
        <p className="line-clamp-4 text-center text-[10px] font-bold leading-relaxed text-white/90 drop-shadow-sm">
          {text || '—'}
        </p>
      </div>
    )
  }

  if (type === 'video') {
    if (safeThumb) {
      return (
        <img
          src={safeThumb}
          alt={sideBadge}
          className="h-full w-full min-h-0 object-cover"
          loading={eagerMedia ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={eagerMedia ? 'high' : 'low'}
        />
      )
    }
    if (safeUrl) {
      return (
        <div className="relative h-full w-full min-h-0">
          <video
            src={safeUrl}
            muted
            playsInline
            preload={eagerMedia ? 'metadata' : 'none'}
            className="h-full w-full object-cover"
            aria-label={sideBadge}
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm">
              <Play size={14} className="ml-0.5 fill-white text-white" />
            </div>
          </div>
        </div>
      )
    }
    return (
      <div className="flex h-full w-full items-center justify-center text-gray-400">
        <span className="text-xs">{sideBadge}</span>
      </div>
    )
  }

  if (type === 'image') {
    const src = safeMediaUrl(thumb || url || '')
    if (src) {
      return (
        <img
          src={src}
          alt={sideBadge}
          className="h-full w-full min-h-0 object-cover"
          loading={eagerMedia ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={eagerMedia ? 'high' : 'low'}
        />
      )
    }
    return (
      <div className="flex h-full w-full items-center justify-center text-gray-400">
        <span className="text-xs">{sideBadge}</span>
      </div>
    )
  }

  const legacySrc = safeMediaUrl(thumb || url || '')
  if (legacySrc) {
    return (
      <img
        src={legacySrc}
        alt={sideBadge}
        className="h-full w-full min-h-0 object-cover"
        loading={eagerMedia ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={eagerMedia ? 'high' : 'low'}
      />
    )
  }

  return (
    <div className="flex h-full w-full items-center justify-center text-gray-400">
      <span className="text-xs">{sideBadge}</span>
    </div>
  )
}

const VARIANT_CARD = {
  best:
    'border-amber-300/70 ring-1 ring-amber-200/50 shadow-[0_6px_28px_-6px_rgba(251,146,60,0.28)] bg-gradient-to-br from-white via-amber-50/60 to-orange-100/50 hover:border-amber-400/70 hover:shadow-[0_8px_32px_-6px_rgba(251,146,60,0.4)] hover:via-amber-50/75 hover:-translate-y-0.5',
  hot:
    'border-fuchsia-300/65 ring-1 ring-violet-200/45 shadow-[0_6px_28px_-6px_rgba(168,85,247,0.24)] bg-gradient-to-br from-white via-violet-50/55 to-fuchsia-100/45 hover:border-fuchsia-400/65 hover:shadow-[0_8px_32px_-6px_rgba(168,85,247,0.38)] hover:via-violet-50/72 hover:-translate-y-0.5',
  new:
    'border-emerald-300/65 ring-1 ring-teal-200/45 shadow-[0_6px_28px_-6px_rgba(20,184,166,0.22)] bg-gradient-to-br from-white via-emerald-50/55 to-cyan-100/42 hover:border-emerald-400/65 hover:shadow-[0_8px_32px_-6px_rgba(20,184,166,0.36)] hover:via-emerald-50/70 hover:-translate-y-0.5',
}

export function MainMatchupCard({ matchup: m, variant, rank, eagerMedia = false }) {
  const { showToast } = useUIStore()
  const [viewerMedia, setViewerMedia] = useState(null)
  const isDemo = isFeedDemoMatchupId(m.id)
  const { left, right } = calcPercent(m.left_votes, m.right_votes)
  const showNewRightPlaceholder = variant === 'new' && (m.right_type == null || m.right_type === undefined)
  const creator = m.profiles
  const bannerGlow = isFeedBannerHighlightActive(m)
  const vipFrame =
    !bannerGlow && isMatchupCreatorVipTierGlow(creator, m._creatorRankInfo)

  const detailTo = `/matchup/${m.id}`

  const handleDetailNav = (e) => {
    if (!isDemo) return
    e.preventDefault()
    showToast('데모 카드는 상세·투표 페이지가 없어요. 썸네일을 눌러 크게 볼 수 있어요.', 'info')
  }

  return (
    <div
      className={cn(
        'relative block shrink-0 overflow-hidden rounded-2xl border transition-all duration-300',
        bannerGlow
          ? 'vics-feed-banner-highlight shadow-none'
          : VARIANT_CARD[variant] ??
              'border-gray-200/80 bg-gradient-to-br from-slate-50 via-slate-100/85 to-slate-100/75 shadow-sm shadow-slate-200/40 hover:border-emerald-200/60 hover:shadow-md hover:via-cyan-50/25',
        vipFrame && VIP_MATCHUP_SURFACE_CLASS,
      )}
    >
      {/* 카드 상단 컬러 라인 */}
      {variant === 'best' && !bannerGlow && (
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-amber-400 via-orange-500 to-rose-400" />
      )}
      {variant === 'hot' && !bannerGlow && (
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-400" />
      )}
      {variant === 'new' && !bannerGlow && (
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-400" />
      )}

      {variant === 'best' && (
        <span className="absolute right-2.5 top-3.5 z-10 rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-white shadow-[0_2px_10px_rgba(251,146,60,0.55)] ring-1 ring-white/60">
          🔥 TOP
        </span>
      )}
      {variant === 'hot' && (
        <span className="absolute right-2.5 top-3.5 z-10 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-white shadow-[0_2px_10px_rgba(168,85,247,0.55)] ring-1 ring-white/60">
          ✨ HOT
        </span>
      )}
      {creator?.fandom_tier === 'diamond' && (
        <div
          className="pointer-events-none absolute inset-0 z-[4] rounded-2xl vics-diamond-matchup-card-bg opacity-[0.18]"
          aria-hidden
        />
      )}
      <div className="relative z-[6] p-4">
        <Link
          to={detailTo}
          onClick={handleDetailNav}
          className="group -m-1 block rounded-xl p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-1"
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className={`flex min-w-0 flex-1 flex-wrap items-center gap-2 ${variant === 'best' || variant === 'hot' ? 'pr-14' : ''}`}>
              {variant === 'best' && <span className="shrink-0 text-base">🔥</span>}
              {variant === 'hot' && <span className="shrink-0 text-base">✨</span>}
              {variant === 'new' && <span className="shrink-0 text-base">⚡</span>}
              {bannerGlow && (
                <span className="shrink-0 rounded-full border border-white/50 bg-gradient-to-r from-fuchsia-600 via-violet-600 to-cyan-600 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-white shadow-[0_0_12px_rgba(217,70,239,0.5)]">
                  부스트
                </span>
              )}
              <h3 className="min-w-0 flex-1 text-sm font-bold line-clamp-1 text-[#22282E] group-hover:underline">{m.title}</h3>
            </div>
          </div>
        </Link>

        <MatchupFeedParticipants
          className="mb-3"
          leftProfile={creator}
          rightProfile={m.right_profiles}
          leftRankInfo={m._creatorRankInfo}
          rightRankInfo={m._rightCreatorRankInfo}
          showRight={m.right_type != null}
          size="main"
        />

        {variant === 'hot' && m.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {m.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="text-[10px] font-bold text-violet-600">
                #{tag.replace(/\s/g, '_')}
              </span>
            ))}
          </div>
        )}

        <div className="relative grid grid-cols-2 gap-2">
          <MatchupThumbFrame side="left" className="aspect-square w-full min-h-0">
            <MatchupMediaOpenButton
              media={matchupSideToMedia(m, 'left')}
              onOpen={setViewerMedia}
              className="h-full min-h-0"
            >
              <MatchupSidePreview side="left" matchup={m} eagerMedia={eagerMedia} />
            </MatchupMediaOpenButton>
          </MatchupThumbFrame>
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
            <VsBadge size="sm" />
          </div>
          <MatchupThumbFrame side="right" className="aspect-square w-full min-h-0">
            {showNewRightPlaceholder ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-emerald-950/80 via-teal-950/70 to-cyan-950/75">
                <span className="text-xl">⚔️</span>
                <span className="text-[10px] font-black text-emerald-300 tracking-wide">도전자 모집 중</span>
                <span className="text-[9px] font-semibold text-teal-400/80">먼저 도전해보세요!</span>
              </div>
            ) : (
              <MatchupMediaOpenButton
                media={matchupSideToMedia(m, 'right')}
                onOpen={setViewerMedia}
                className="h-full min-h-0"
              >
                <MatchupSidePreview side="right" matchup={m} eagerMedia={eagerMedia} />
              </MatchupMediaOpenButton>
            )}
          </MatchupThumbFrame>
        </div>

        <Link
          to={detailTo}
          onClick={handleDetailNav}
          className="-m-1 mt-3 block rounded-xl p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-1"
        >
        <div className={`flex items-center ${variant === 'new' ? 'justify-end' : 'justify-between'}`}>
          {variant !== 'new' && (
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <BarChart3
                size={12}
                className={
                  variant === 'best'
                    ? 'shrink-0 text-amber-500'
                    : variant === 'hot'
                      ? 'shrink-0 text-violet-500'
                      : 'text-gray-400'
                }
              />
              {variant === 'hot' && (m.total_votes || 0) > 0 ? (
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  <span className="bg-gradient-to-r from-fuchsia-500 to-pink-500 bg-clip-text text-2xl font-black tabular-nums leading-none text-transparent drop-shadow-sm">
                    {left}%
                  </span>
                  <span className="rounded bg-gradient-to-r from-violet-500 to-fuchsia-500 px-1 py-0.5 text-[8px] font-black text-white">VS</span>
                  <span className="bg-gradient-to-r from-sky-500 to-indigo-500 bg-clip-text text-2xl font-black tabular-nums leading-none text-transparent drop-shadow-sm">
                    {right}%
                  </span>
                </div>
              ) : variant === 'best' ? (
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-0.5">
                  <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-2xl font-black tabular-nums leading-none text-transparent drop-shadow-sm">
                    {formatNumber(m.total_votes || 0)}
                  </span>
                  <span className="text-[10px] font-bold text-amber-700/80">명 참여</span>
                </div>
              ) : (
                <span className="text-xs text-gray-500">{formatNumber(m.total_votes || 0)}명 참여 중</span>
              )}
            </div>
          )}
          <span className={cn(
            'rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-wide',
            variant === 'best'
              ? 'bg-amber-50 text-amber-600 border border-amber-200/80'
              : variant === 'hot'
                ? 'bg-violet-50 text-violet-600 border border-violet-200/80'
                : 'bg-emerald-50 text-emerald-600 border border-emerald-200/80',
          )}>
            {variant === 'new' ? '상세 →' : '투표 →'}
          </span>
        </div>

        {variant === 'hot' && (m.total_votes || 0) > 0 && (
          <div className="mt-2 flex items-center gap-1">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-gradient-to-r from-fuchsia-100 to-violet-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-violet-500 transition-all duration-700"
                style={{ width: `${left}%` }}
              />
            </div>
            <span className="text-[9px] font-bold text-fuchsia-500">{left}%</span>
          </div>
        )}

        {variant === 'new' && (
          <p className="mt-2 text-[10px] font-semibold text-emerald-600/90">
            🆕 {formatDate(m.created_at)} 등록
          </p>
        )}
        </Link>

        <MatchupMediaViewer
          open={Boolean(viewerMedia)}
          media={viewerMedia}
          onClose={() => setViewerMedia(null)}
        />
      </div>
    </div>
  )
}
