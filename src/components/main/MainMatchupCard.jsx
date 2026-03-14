import { Link } from 'react-router-dom'
import { BarChart3 } from 'lucide-react'
import { formatNumber, formatDate, calcPercent } from '../../lib/utils'

export function MainMatchupCard({ matchup: m, variant, rank }) {
  const { left, right } = calcPercent(m.left_votes, m.right_votes)
  const leftThumb = m.left_thumbnail_url || (m.left_type === 'image' ? m.left_url : null)
  const rightThumb = m.right_thumbnail_url || (m.right_type === 'image' ? m.right_url : null)

  return (
    <Link
      to={`/matchup/${m.id}`}
      className="block bg-[#1a2332] rounded-xl border border-white/10 overflow-hidden hover:border-white/20 transition-colors shrink-0"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {variant === 'best' && <span className="shrink-0 text-base">🔥</span>}
            {variant === 'hot' && <span className="shrink-0 text-base">✨</span>}
            {variant === 'new' && <span className="shrink-0 text-base">⚡</span>}
            <h3 className="text-sm font-bold line-clamp-1">{m.title}</h3>
          </div>
        </div>

        {variant === 'hot' && m.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {m.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="text-[10px] font-bold text-violet-400">
                #{tag.replace(/\s/g, '_')}
              </span>
            ))}
          </div>
        )}

        <div className="relative grid grid-cols-2 gap-2">
          <div className="aspect-square rounded-lg overflow-hidden bg-white/5">
            {leftThumb ? (
              <img src={leftThumb} alt={m.left_label || 'A'} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/30">
                <span className="text-xs">{m.left_label || 'A'}</span>
              </div>
            )}
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-black">
            VS
          </div>
          <div className="aspect-square rounded-lg overflow-hidden bg-white/5">
            {rightThumb ? (
              <img src={rightThumb} alt={m.right_label || 'B'} className="w-full h-full object-cover" />
            ) : variant === 'new' ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 text-white/30">
                <span className="text-[10px] font-bold">도전자 대기</span>
                <span className="text-[9px]">나중에 채워요</span>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/30">
                <span className="text-xs">{m.right_label || 'B'}</span>
              </div>
            )}
          </div>
        </div>

        <div className={`mt-3 flex items-center ${variant === 'new' ? 'justify-end' : 'justify-between'}`}>
          {variant !== 'new' && (
            <div className="flex items-center gap-1.5 text-xs text-white/60">
              <BarChart3 size={12} />
              {variant === 'hot' && (m.total_votes || 0) > 0 ? (
                <span>{left}% VS {right}%</span>
              ) : (
                <span>{formatNumber(m.total_votes || 0)}명 참여 중</span>
              )}
            </div>
          )}
          <span className="text-xs font-bold text-emerald-400">상세/투표 →</span>
        </div>

        {variant === 'hot' && (m.total_votes || 0) > 0 && (
          <p className="mt-2 text-[10px] text-violet-400/80">
            ✨ 님과 안목이 비슷한 80%가 참여
          </p>
        )}

        {variant === 'new' && (
          <p className="mt-2 text-[10px] text-emerald-400/80">
            🆕 {formatDate(m.created_at)} 생성됨
          </p>
        )}
      </div>
    </Link>
  )
}
