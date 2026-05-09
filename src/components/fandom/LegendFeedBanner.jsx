import { useCallback, useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { fetchActiveLegendAnnouncements, LEGEND_FEED_UPDATED } from '../../lib/legendFeedAnnouncement'

/**
 * 메인 피드 상단 — 최근 10분 이내 다이아몬드 달성 띠(최신순 최대 5명, 그 외는 노출 제외)
 * @param {{ staticPreviewRows?: Array<{ id: string, nickname: string }> }} [props]
 * - `staticPreviewRows`: 개발 미리보기 전용. 넘기면 Supabase 조회·이벤트 구독 없이 해당 행만 렌더합니다.
 */
export function LegendFeedBanner({ staticPreviewRows } = {}) {
  const [rows, setRows] = useState([])
  const previewMode = Array.isArray(staticPreviewRows)

  const load = useCallback(async () => {
    const data = await fetchActiveLegendAnnouncements()
    setRows(data)
  }, [])

  useEffect(() => {
    if (previewMode) {
      setRows(staticPreviewRows)
      return
    }
    void load()
  }, [previewMode, staticPreviewRows, load])

  useEffect(() => {
    if (previewMode) return
    const on = () => void load()
    window.addEventListener(LEGEND_FEED_UPDATED, on)
    return () => window.removeEventListener(LEGEND_FEED_UPDATED, on)
  }, [previewMode, load])

  if (!rows.length) return null

  return (
    <div
      className="mb-3 overflow-hidden rounded-xl border border-cyan-400/45 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.18)] animate-fade-in-soft divide-y divide-white/[0.08]"
      role="region"
      aria-label="레전드 강림 알림"
    >
      {rows.map((row) => (
        <p
          key={row.id}
          className="px-3 py-1.5 text-center text-[10px] font-black leading-tight text-cyan-100 sm:text-[11px] sm:leading-snug"
        >
          <Sparkles className="mr-0.5 inline-block size-3 shrink-0 align-text-bottom text-amber-300 sm:size-3.5" aria-hidden />
          레전드 강림: <span className="text-white">{row.nickname}</span>님이 다이아몬드 등급에 도달했습니다!
          <Sparkles className="ml-0.5 inline-block size-3 shrink-0 align-text-bottom text-amber-300 sm:size-3.5" aria-hidden />
        </p>
      ))}
    </div>
  )
}
