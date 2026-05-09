import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Lock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fetchMatchupVoteStatsRpc, VOTE_STATS_UNLOCK_COST } from '../../lib/voteStatsUnlock'
import { formatNumber } from '../../lib/utils'

function MiniBar({ left, right, leftLabel, rightLabel }) {
  const lt = Number(left) || 0
  const rt = Number(right) || 0
  const sum = lt + rt
  const lp = sum > 0 ? Math.round((lt / sum) * 100) : 50
  const rp = 100 - lp
  return (
    <div className="mt-1 flex h-2 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/80">
      <div
        className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-500 transition-all"
        style={{ width: `${lp}%` }}
        title={`${leftLabel} ${lt}`}
      />
      <div
        className="h-full bg-gradient-to-r from-sky-500 to-blue-600 transition-all"
        style={{ width: `${rp}%` }}
        title={`${rightLabel} ${rt}`}
      />
    </div>
  )
}

function StatTable({ title, rows, leftLabel, rightLabel }) {
  if (!rows?.length) return null
  return (
    <div className="rounded-xl border border-teal-100/90 bg-white/90 p-4 shadow-sm">
      <p className="mb-3 text-xs font-black uppercase tracking-wide text-teal-700/90">{title}</p>
      <ul className="space-y-3">
        {rows.map(([key, v]) => {
          const left = v?.left ?? 0
          const right = v?.right ?? 0
          return (
            <li key={key}>
              <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
                <span className="min-w-0 truncate">{key}</span>
                <span className="shrink-0 tabular-nums text-slate-500">
                  {formatNumber(left)} : {formatNumber(right)}
                </span>
              </div>
              <MiniBar left={left} right={right} leftLabel={leftLabel} rightLabel={rightLabel} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function formatVoteEndLabel(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

/**
 * 작성자 전용 — 투표 통계 열람권 구매 후 RPC 집계 표시
 * @param {string | null | undefined} expiresAt — matchups.expires_at (투표 마감)
 */
export function MatchupVoteStatsSection({ matchupId, matchupUserId, currentUserId, leftLabel, rightLabel, expiresAt }) {
  const isCreator = !!currentUserId && currentUserId === matchupUserId
  const voteEnded =
    typeof expiresAt === 'string' &&
    expiresAt.trim() !== '' &&
    !Number.isNaN(new Date(expiresAt).getTime()) &&
    new Date(expiresAt) <= new Date()
  const [unlockedAt, setUnlockedAt] = useState(null)
  const [stats, setStats] = useState(null)
  const [loadingUnlock, setLoadingUnlock] = useState(true)
  const [loadingStats, setLoadingStats] = useState(false)

  const fetchUnlock = useCallback(async () => {
    if (!isCreator || !matchupId) {
      setUnlockedAt(null)
      setLoadingUnlock(false)
      return
    }
    setLoadingUnlock(true)
    try {
      const { data, error } = await supabase
        .from('matchup_vote_stats_unlocks')
        .select('unlocked_at')
        .eq('matchup_id', matchupId)
        .maybeSingle()
      if (error) {
        if (import.meta.env.DEV) console.warn('[MatchupVoteStatsSection] unlock', error.message)
        setUnlockedAt(null)
      } else {
        setUnlockedAt(data?.unlocked_at ?? null)
      }
    } finally {
      setLoadingUnlock(false)
    }
  }, [isCreator, matchupId])

  const fetchStats = useCallback(async () => {
    if (!unlockedAt || !matchupId) {
      setStats(null)
      return
    }
    setLoadingStats(true)
    try {
      const res = await fetchMatchupVoteStatsRpc(matchupId)
      if (res.ok) setStats(res.stats)
      else setStats(null)
    } finally {
      setLoadingStats(false)
    }
  }, [matchupId, unlockedAt])

  useEffect(() => {
    void fetchUnlock()
  }, [fetchUnlock])

  useEffect(() => {
    const on = () => {
      void fetchUnlock()
    }
    window.addEventListener('vics:vote-stats-unlock:updated', on)
    return () => window.removeEventListener('vics:vote-stats-unlock:updated', on)
  }, [fetchUnlock])

  useEffect(() => {
    void fetchStats()
  }, [fetchStats])

  if (!isCreator) return null

  const ll = leftLabel || 'A'
  const rl = rightLabel || 'B'

  return (
    <section className="mb-5 rounded-2xl border border-teal-200/60 bg-gradient-to-br from-white via-teal-50/30 to-cyan-50/40 px-5 py-5 shadow-[0_12px_36px_-16px_rgba(20,184,166,0.25)]">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-teal-600" />
        <h2 className="text-base font-black text-[#22282E] sm:text-lg">투표 통계 (작성자 전용)</h2>
      </div>

      {loadingUnlock ? (
        <div className="h-24 animate-pulse rounded-xl bg-teal-100/40" />
      ) : !unlockedAt ? (
        <div className="rounded-xl border border-dashed border-teal-200/80 bg-white/80 p-5 text-center">
          <Lock className="mx-auto mb-2 h-8 w-8 text-teal-500/80" aria-hidden />
          <p className="text-sm font-bold text-slate-700">
            성별·연령대 등 투표 분석은 <span className="text-teal-700">열람권</span> 구매 후 확인할 수 있어요.
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500">
            {formatNumber(VOTE_STATS_UNLOCK_COST)} P · 매치업당 1회 · 투표 종료 후 구매 가능
          </p>
          {!voteEnded ? (
            <p className="mt-4 text-xs font-semibold leading-relaxed text-slate-500">
              {!expiresAt
                ? '투표 마감 시각이 없는 매치업은 열람권을 구매할 수 없어요.'
                : `마감 시각(${formatVoteEndLabel(expiresAt)})이 지나면 열람권을 구매할 수 있어요.`}
            </p>
          ) : (
            <Link
              to={`/rewards/vote-stats?matchup=${encodeURIComponent(matchupId)}`}
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-2.5 text-sm font-black text-white shadow-md hover:brightness-105"
            >
              열람권 구매하기
            </Link>
          )}
        </div>
      ) : loadingStats ? (
        <div className="h-40 animate-pulse rounded-xl bg-teal-100/40" />
      ) : stats ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-teal-100 bg-white/90 px-4 py-3 text-sm font-bold text-slate-700">
            <span>
              총 <span className="text-teal-700">{formatNumber(stats.total ?? 0)}</span>표
            </span>
            <span className="text-slate-300">|</span>
            <span>
              {ll} <span className="text-fuchsia-600">{formatNumber(stats.left_total ?? 0)}</span>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              {rl} <span className="text-sky-600">{formatNumber(stats.right_total ?? 0)}</span>
            </span>
          </div>
          <StatTable
            title="성별"
            rows={Object.entries(stats.by_gender || {})}
            leftLabel={ll}
            rightLabel={rl}
          />
          <StatTable
            title="연령대"
            rows={Object.entries(stats.by_age || {})}
            leftLabel={ll}
            rightLabel={rl}
          />
          <p className="text-[11px] font-medium text-slate-400">
            프로필에 생일·성별이 없는 참여자는 &quot;미입력&quot;으로 집계됩니다.
          </p>
        </div>
      ) : (
        <p className="text-center text-sm font-semibold text-slate-500">통계를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
      )}
    </section>
  )
}
