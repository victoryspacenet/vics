import { Link, useLocation } from 'react-router-dom'
import { Flame, Sparkles, Zap } from 'lucide-react'

const FEED_TABS = [
  { id: 'best', label: '베스트', icon: Flame, emoji: '🔥', path: '/feed/best' },
  { id: 'hot', label: '추천', icon: Sparkles, emoji: '✨', path: '/feed/hot' },
  { id: 'new', label: 'NEW', icon: Zap, emoji: '🆕', path: '/feed/new' },
]

export function MainTabBar({ currentVariant }) {
  const location = useLocation()

  return (
    <div className="sticky top-14 z-20 -mx-4 px-4 py-3 bg-[#0f1419]/95 backdrop-blur-sm border-b border-white/10 mb-4">
      <div className="flex items-center justify-center gap-1.5 sm:gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        {FEED_TABS.map((tab) => {
          const Icon = tab.icon
          const active = currentVariant === tab.id || location.pathname === tab.path
          return (
            <Link
              key={tab.id}
              to={tab.path}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-black transition-all shrink-0 ${
                active
                  ? tab.id === 'best'
                    ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-md shadow-orange-200/30'
                    : tab.id === 'hot'
                    ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-md shadow-violet-200/30'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-200/30'
                  : 'bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon size={14} className={active ? 'text-white' : ''} />
              {tab.label} {tab.emoji}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
