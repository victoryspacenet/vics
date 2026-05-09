import { useState, useEffect } from 'react'
import { Megaphone } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { getTier, tierAtLeast } from '../../lib/tiers'
import { mapTierSnapshotRow, EMPTY_TIER_RANK_INFO } from '../../lib/creatorRankSnapshot'

/**
 * Vip 전용 - 매치업 홍보하기 (하루 1회)
 */
export function VipPromoButton() {
  const { user, profile } = useAuthStore()
  const { showToast } = useUIStore()
  const [canPromote, setCanPromote] = useState(false)
  const [promotedToday, setPromotedToday] = useState(false)
  const [myMatchups, setMyMatchups] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!user || !profile) return
    checkVipAndPromo()
  }, [user, profile])

  const checkVipAndPromo = async () => {
    try {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
      let rankInfo = { ...EMPTY_TIER_RANK_INFO, totalUsers: count || 0 }
      try {
        const { data: trRows, error: trErr } = await supabase.rpc('profiles_tier_rank_snapshot_for_ids', {
          p_ids: [user.id],
        })
        if (!trErr && trRows?.[0]) {
          rankInfo = mapTierSnapshotRow(trRows[0])
          if (!rankInfo.totalUsers) rankInfo = { ...rankInfo, totalUsers: count || 0 }
        }
      } catch (_) { /* RPC 미배포 시 */ }
      const tier = getTier(profile, rankInfo)
      if (!tierAtLeast(tier, 'vip')) {
        setCanPromote(false)
        return
      }
      setCanPromote(true)

      const today = new Date().toISOString().slice(0, 10)
      const { data: promo } = await supabase
        .from('vip_promotions')
        .select('id')
        .eq('user_id', user.id)
        .eq('promoted_at', today)
        .maybeSingle()
      setPromotedToday(!!promo)

      if (!promo) {
        const { data: matchups } = await supabase
          .from('matchups')
          .select('id, title')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .not('right_type', 'is', null)
          .order('created_at', { ascending: false })
          .limit(20)
        setMyMatchups(matchups || [])
      }
    } catch (err) {
      console.error('[VipPromoButton]', err)
    }
  }

  const handlePromote = async () => {
    if (!selectedId || loading) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from('vip_promotions')
        .insert({ user_id: user.id, matchup_id: selectedId })
      if (error) throw error
      showToast('전광판에 홍보 등록됐어요! 💎', 'success')
      setPromotedToday(true)
      setOpen(false)
    } catch (err) {
      showToast(err.message || '홍보 등록에 실패했어요', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!canPromote) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={promotedToday}
        className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-full transition-colors ${
          promotedToday
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
        }`}
      >
        <Megaphone size={14} />
        {promotedToday ? '오늘 홍보 완료' : '매치업 홍보하기'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setOpen(false)}>
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-[#22282E] mb-2">💎 Vip 전광판 홍보</h3>
            <p className="text-sm text-gray-500 mb-4">하루 1회, 매치업을 메인 전광판에 노출할 수 있어요.</p>
            {promotedToday ? (
              <p className="text-sm text-violet-600 font-bold">오늘 홍보는 이미 완료했어요. 내일 다시 시도해주세요!</p>
            ) : myMatchups.length === 0 ? (
              <p className="text-sm text-gray-500">홍보할 완료된 매치업이 없어요.</p>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                  {myMatchups.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedId(selectedId === m.id ? null : m.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-colors ${
                        selectedId === m.id ? 'border-violet-500 bg-violet-50' : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <span className="font-medium text-sm">{m.title}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={handlePromote}
                  disabled={!selectedId || loading}
                  className="w-full py-3 rounded-xl bg-violet-600 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '등록 중...' : '전광판에 올리기'}
                </button>
              </>
            )}
            <button
              onClick={() => setOpen(false)}
              className="mt-3 text-sm text-gray-500 hover:text-gray-700"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  )
}
