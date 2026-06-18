import { useState, useEffect } from 'react'
import { Megaphone } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  MATCHUP_CREATOR_PROFILE_FIELDS,
  EMPTY_TIER_RANK_INFO,
  enrichMatchupsWithCreatorRankInfo,
} from '../../lib/creatorRankSnapshot'
import { runWhenIdle } from '../../lib/runDeferred'
import { MainMatchupCard } from './MainMatchupCard'
import { MainCardSkeleton } from './MainCardSkeleton'
import { MatchupCarousel } from './MatchupCarousel'

/**
 * Vip 전광판 - 상위 10% 빅스인이 하루 1회 홍보한 매치업 표시
 */
export function VipBillboard() {
  const [matchups, setMatchups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPromotions()
  }, [])

  const fetchPromotions = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const embed = `id, title, left_label, right_label, left_type, right_type, left_url, right_url, left_thumbnail_url, right_thumbnail_url, left_votes, right_votes, total_votes, tags, created_at, user_id, profiles:user_id(${MATCHUP_CREATOR_PROFILE_FIELDS}), right_profiles:right_user_id(${MATCHUP_CREATOR_PROFILE_FIELDS})`
      const { data } = await supabase
        .from('vip_promotions')
        .select(`
          matchup_id,
          matchups (
            ${embed}
          )
        `)
        .eq('promoted_at', today)
        .order('created_at', { ascending: false })
        .limit(5)

      const list = (data || [])
        .map((r) => r.matchups)
        .filter(Boolean)
        .map((m) => ({ ...m, _creatorRankInfo: { ...EMPTY_TIER_RANK_INFO } }))
      setMatchups(list)
      runWhenIdle(() => {
        void enrichMatchupsWithCreatorRankInfo(list).then(setMatchups).catch((err) => {
          console.warn('[VipBillboard] rank enrich:', err)
        })
      }, { timeoutMs: 2000 })
    } catch (err) {
      console.error('[VipBillboard]', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Megaphone size={20} className="text-violet-400" />
          <h2 className="text-lg font-bold text-[#22282E] tracking-tight">💎 Vip 전광판</h2>
        </div>
        <MatchupCarousel dotTone="violet">
          {Array.from({ length: 3 }).map((_, i) => (
            <MainCardSkeleton key={`sk-${i}`} compact />
          ))}
        </MatchupCarousel>
      </section>
    )
  }

  if (matchups.length === 0) return null

  return (
    <section className="mb-10 animate-fade-in-soft">
      <div className="flex items-center gap-2 mb-4">
        <Megaphone size={20} className="text-violet-400" />
        <h2 className="text-lg font-bold text-[#22282E] tracking-tight">💎 Vip 전광판</h2>
      </div>
      <MatchupCarousel dotTone="violet">
        {matchups.map((m, i) => (
          <div
            key={m.id}
            className="animate-fade-in-feed-stagger"
            style={{ '--stagger-delay': `${Math.min(i, 11) * 52}ms` }}
          >
            <div className="relative">
              <span className="absolute -top-1 -right-1 z-10 px-2 py-0.5 rounded-lg bg-violet-500/90 text-white text-[10px] font-bold">
                Vip 홍보
              </span>
              <MainMatchupCard matchup={m} variant="hot" />
            </div>
          </div>
        ))}
      </MatchupCarousel>
    </section>
  )
}
