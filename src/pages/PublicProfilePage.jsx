import { useEffect, useState, useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ChevronLeft, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { sanitizeText } from '../lib/sanitize'
import { cn, formatNumber } from '../lib/utils'
import { isProfilePublicUnlockActive } from '../lib/profilePublicUnlock'
import {
  MATCHUP_CREATOR_PROFILE_FIELDS,
  fetchCreatorRankMapForIds,
  EMPTY_TIER_RANK_INFO,
} from '../lib/creatorRankSnapshot'
import { Avatar } from '../components/ui/Avatar'
import { TierBadge } from '../components/ui/TierBadge'
import { FeaturedBadgeSpan } from '../components/ui/FeaturedBadge'
import { FandomBronzeStarBadge } from '../components/fandom/FandomBronzeStarBadge'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const CARD =
  'rounded-2xl border border-pink-100/60 bg-white/95 shadow-[0_4px_28px_-12px_rgba(244,114,182,0.18)] backdrop-blur-[1px]'

export function PublicProfilePage() {
  const { userId: rawUserId } = useParams()
  const userId = typeof rawUserId === 'string' ? rawUserId.trim() : ''
  const myId = useAuthStore((s) => s.user?.id)

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [fetchError, setFetchError] = useState(null)
  const [rankInfo, setRankInfo] = useState(() => ({ ...EMPTY_TIER_RANK_INFO }))

  const validId = userId && UUID_RE.test(userId)

  const isOwn = myId && userId && myId === userId

  useEffect(() => {
    if (!validId) {
      setLoading(false)
      setProfile(null)
      setFetchError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setFetchError(null)

    const run = async () => {
      const fields = `${MATCHUP_CREATOR_PROFILE_FIELDS}, bio, avatar_ring_effect, profile_public_expires_at, total_votes_received`
      const [{ data, error }, rankMap] = await Promise.all([
        supabase.from('profiles').select(fields).eq('id', userId).maybeSingle(),
        fetchCreatorRankMapForIds([userId]),
      ])

      if (cancelled) return

      if (error) {
        setProfile(null)
        setFetchError(error.message || '불러오지 못했어요')
        setRankInfo({ ...EMPTY_TIER_RANK_INFO })
      } else if (!data) {
        setProfile(null)
        setFetchError(null)
        setRankInfo({ ...EMPTY_TIER_RANK_INFO })
      } else {
        setProfile(data)
        setFetchError(null)
        setRankInfo(rankMap[userId] ? { ...rankMap[userId] } : { ...EMPTY_TIER_RANK_INFO })
      }
      setLoading(false)
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [userId, validId])

  const unlocked = useMemo(() => isProfilePublicUnlockActive(profile), [profile])

  if (isOwn) {
    return <Navigate to="/mypage" replace />
  }

  if (!validId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <BackBar />
        <div className={cn(CARD, 'p-6 text-center text-gray-600')}>
          <p className="font-medium text-gray-800">주소가 올바르지 않아요</p>
          <p className="mt-2 text-sm">프로필 링크를 다시 확인해 주세요.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <BackBar />
        <div className={cn(CARD, 'p-10 text-center text-sm text-gray-500')}>불러오는 중…</div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <BackBar />
        <div className={cn(CARD, 'p-6 text-center text-sm text-red-600')}>{fetchError}</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <BackBar />
        <div className={cn(CARD, 'p-6 text-center text-gray-600')}>
          <p className="font-medium text-gray-800">회원을 찾을 수 없어요</p>
          <p className="mt-2 text-sm">삭제되었거나 존재하지 않는 프로필이에요.</p>
        </div>
      </div>
    )
  }

  const nickname = profile.nickname || '회원'
  const bioText = unlocked && profile.bio ? sanitizeText(profile.bio) : ''

  return (
    <div className="mx-auto max-w-lg px-4 py-6 pb-16">
      <BackBar />

      <div className={cn(CARD, 'overflow-hidden')}>
        <div className="border-b border-pink-100/70 bg-gradient-to-r from-fuchsia-50/80 to-amber-50/50 px-5 py-6">
          <div className="flex items-start gap-4">
            <Avatar src={profile.avatar_url} alt={nickname} size="xl" className="ring-2 ring-white shadow-md" />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <h1 className="truncate text-lg font-black text-gray-900">{nickname}</h1>
                <FeaturedBadgeSpan badgeId={profile.featured_badge} />
                <FandomBronzeStarBadge tierId={profile.fandom_tier} />
              </div>
              {unlocked ? (
                <div className="mt-2">
                  <TierBadge profile={profile} rankInfo={rankInfo} variant="compact" />
                </div>
              ) : (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  프로필 상세 비공개
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          {!unlocked ? (
            <p className="text-sm leading-relaxed text-gray-600">
              이 회원은 프로필 공개 권한이 없어 소개·활동 요약을 볼 수 없어요. 피드·매치업에서는 계속 만날 수
              있어요.
            </p>
          ) : (
            <>
              {bioText ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{bioText}</p>
              ) : (
                <p className="text-sm text-gray-400">등록된 소개가 없어요.</p>
              )}
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-gray-50/90 px-3 py-2.5">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400">매치업</dt>
                  <dd className="mt-0.5 font-bold text-gray-800">
                    {formatNumber(profile.total_matchups ?? 0)}회
                  </dd>
                </div>
                <div className="rounded-xl bg-gray-50/90 px-3 py-2.5">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400">득표</dt>
                  <dd className="mt-0.5 font-bold text-gray-800">
                    {formatNumber(profile.total_votes_received ?? 0)}
                  </dd>
                </div>
              </dl>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function BackBar() {
  return (
    <div className="mb-4">
      <Link
        to="/feed/best"
        className="inline-flex items-center gap-1 text-sm font-medium text-pink-600 hover:text-pink-700"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        돌아가기
      </Link>
    </div>
  )
}
