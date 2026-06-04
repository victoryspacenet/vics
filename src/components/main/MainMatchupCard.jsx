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
import { Avatar } from '../ui/Avatar'
import { UserProfileLink } from '../ui/UserProfileLink'
import { FeaturedBadgeSpan } from '../ui/FeaturedBadge'
import { safeMediaUrl } from '../../lib/sanitize'
import { isFeedBannerHighlightActive } from '../../lib/bannerHighlightBoost'
import { isMatchupCreatorVipTierGlow, VIP_MATCHUP_SURFACE_CLASS } from '../../lib/matchupCreatorVipGlow'
import { fandomTierHasDiamondListNicknameAura } from '../../lib/fandomTiers'
import { FandomBronzeStarBadge } from '../fandom/FandomBronzeStarBadge'

/** 이미지·영상·텍스트 썸네일 (영상은 썸네일 없을 때 video 태그로 표시 — img에 mp4 넣으면 깨짐) */
function MatchupSidePreview({ side, matchup: m, eagerMedia = false }) {
  const isLeft = side === 'left'
  const type = isLeft ? m.left_type : m.right_type
  const url = isLeft ? m.left_url : m.right_url
  const thumb = isLeft ? m.left_thumbnail_url : m.right_thumbnail_url
  const label = isLeft ? m.left_label : m.right_label
  const text = isLeft ? m.left_text : m.right_text

  const safeThumb = safeMediaUrl(thumb || '')
  const safeUrl = safeMediaUrl(url || '')

  if (type === 'text') {
    return (
      <div className="flex h-full min-h-[4rem] w-full items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-2">
        <p className="line-clamp-4 text-center text-[10px] font-semibold leading-relaxed text-[#22282E]">
          {text || label || '—'}
        </p>
      </div>
    )
  }

  if (type === 'video') {
    if (safeThumb) {
      return (
        <img
          src={safeThumb}
          alt={label || ''}
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
            aria-label={label || ''}
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
        <span className="text-xs">{label || (isLeft ? 'A' : 'B')}</span>
      </div>
    )
  }

  if (type === 'image') {
    const src = safeMediaUrl(thumb || url || '')
    if (src) {
      return (
        <img
          src={src}
          alt={label || ''}
          className="h-full w-full min-h-0 object-cover"
          loading={eagerMedia ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={eagerMedia ? 'high' : 'low'}
        />
      )
    }
    return (
      <div className="flex h-full w-full items-center justify-center text-gray-400">
        <span className="text-xs">{label || (isLeft ? 'A' : 'B')}</span>
      </div>
    )
  }

  const legacySrc = safeMediaUrl(thumb || url || '')
  if (legacySrc) {
    return (
      <img
        src={legacySrc}
        alt={label || ''}
        className="h-full w-full min-h-0 object-cover"
        loading={eagerMedia ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={eagerMedia ? 'high' : 'low'}
      />
    )
  }

  return (
    <div className="flex h-full w-full items-center justify-center text-gray-400">
      <span className="text-xs">{label || (isLeft ? 'A' : 'B')}</span>
    </div>
  )
}

const VARIANT_CARD = {
  best:
    'border-amber-200/85 ring-1 ring-amber-100/55 shadow-md shadow-amber-200/30 bg-gradient-to-br from-slate-50 via-amber-50/30 to-orange-50/40 hover:border-amber-300/80 hover:shadow-lg hover:shadow-amber-300/35 hover:via-amber-50/35',
  hot:
    'border-fuchsia-200/80 ring-1 ring-violet-100/50 shadow-md shadow-fuchsia-200/25 bg-gradient-to-br from-slate-50 via-violet-50/30 to-fuchsia-50/35 hover:border-fuchsia-300/75 hover:shadow-lg hover:shadow-fuchsia-200/35 hover:via-violet-50/38',
  new:
    'border-emerald-200/80 ring-1 ring-teal-100/50 shadow-md shadow-emerald-200/28 bg-gradient-to-br from-slate-50 via-emerald-50/28 to-cyan-50/32 hover:border-emerald-300/75 hover:shadow-lg hover:shadow-teal-200/35 hover:via-emerald-50/34',
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
        'relative block shrink-0 overflow-hidden rounded-2xl border transition-all',
        bannerGlow
          ? 'vics-feed-banner-highlight shadow-none'
          : VARIANT_CARD[variant] ??
              'border-gray-200/80 bg-gradient-to-br from-slate-50 via-slate-100/85 to-slate-100/75 shadow-sm shadow-slate-200/40 hover:border-emerald-200/60 hover:shadow-md hover:via-cyan-50/25',
        vipFrame && VIP_MATCHUP_SURFACE_CLASS,
      )}
    >
      {variant === 'best' && (
        <span className="absolute right-2.5 top-2.5 z-10 rounded-md bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-white shadow-md shadow-amber-500/35 ring-1 ring-white/60">
          TOP
        </span>
      )}
      {variant === 'hot' && (
        <span className="absolute right-2.5 top-2.5 z-10 rounded-md bg-gradient-to-r from-violet-500 via-fuchsia-500 to-purple-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-white shadow-md shadow-fuchsia-500/40 ring-1 ring-white/60">
          HOT
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

        {creator?.nickname && (
          <div className="mb-3 flex min-w-0 items-center gap-1.5">
            <UserProfileLink userId={creator?.id} className="inline-flex shrink-0">
              <Avatar src={creator?.avatar_url} alt={creator?.nickname} size="xs" />
            </UserProfileLink>
            <UserProfileLink
              userId={creator?.id}
              className={cn(
                'min-w-0 truncate text-xs font-semibold text-gray-600 hover:underline',
                fandomTierHasDiamondListNicknameAura(creator?.fandom_tier) &&
                  'vics-fandom-diamond-nickname-aura text-slate-800',
              )}
            >
              {creator.nickname}
            </UserProfileLink>
            <FandomBronzeStarBadge tierId={creator?.fandom_tier} size={12} />
            <FeaturedBadgeSpan badgeId={creator?.featured_badge} className="translate-y-px shrink-0" />
          </div>
        )}

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
              <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-gray-400">
                <span className="text-[10px] font-bold">도전자 대기</span>
                <span className="text-[9px]">나중에 채워요</span>
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
                  <span className="bg-gradient-to-r from-fuchsia-600 to-pink-600 bg-clip-text text-xl font-black tabular-nums leading-none text-transparent sm:text-2xl">
                    {left}%
                  </span>
                  <span className="text-xs font-black text-gray-400">VS</span>
                  <span className="bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-xl font-black tabular-nums leading-none text-transparent sm:text-2xl">
                    {right}%
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-violet-500">박빙</span>
                </div>
              ) : variant === 'best' ? (
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  <span className="text-[11px] font-semibold text-gray-500">총 투표</span>
                  <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-xl font-black tabular-nums leading-none text-transparent sm:text-2xl">
                    {formatNumber(m.total_votes || 0)}
                  </span>
                  <span className="text-xs font-bold text-gray-600">명 참여</span>
                </div>
              ) : (
                <span className="text-xs text-gray-500">{formatNumber(m.total_votes || 0)}명 참여 중</span>
              )}
            </div>
          )}
          <span className="text-xs font-bold text-emerald-600">
            {variant === 'new' ? '상세 →' : '상세/투표 →'}
          </span>
        </div>

        {variant === 'hot' && (m.total_votes || 0) > 0 && (
          <p className="mt-2 text-[10px] text-violet-600/90">
            ✨ 님과 안목이 비슷한 80%가 참여
          </p>
        )}

        {variant === 'new' && (
          <p className="mt-2 text-[10px] text-emerald-600/90">
            🆕 {formatDate(m.created_at)} 생성됨
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
