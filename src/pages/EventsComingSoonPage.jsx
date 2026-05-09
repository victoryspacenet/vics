import { Link, useLocation, useSearchParams } from 'react-router-dom'

import { Sparkles, Home } from 'lucide-react'

import { cn } from '../lib/utils'



const PAGE_BG =

  'bg-gradient-to-br from-rose-50/98 via-fuchsia-50/35 to-cyan-50/50'

const SECTION_CARD =

  'rounded-2xl border border-pink-100/60 bg-white/92 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px]'



export function EventsComingSoonPage() {
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const fromPartner = searchParams.get('from') === 'partner'
  const isHallOfFame = pathname === '/hall-of-fame'

  const featureLine =
    isHallOfFame ? '명예의 전당 기능은' : fromPartner ? '광고/제휴문의 기능은' : '이벤트·챌린지 기능은'

  return (

    <div className={cn('min-h-[70vh] flex flex-col items-center justify-center px-4 py-12', PAGE_BG)}>

      <div className={cn(SECTION_CARD, 'w-full max-w-md p-8 sm:p-10 text-center border-pink-100/70')}>

        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-fuchsia-500 via-pink-400 to-amber-400 flex items-center justify-center shadow-lg shadow-fuchsia-300/40 ring-2 ring-white/80">

          <Sparkles className="w-8 h-8 text-white" strokeWidth={2.25} />

        </div>

        <h1 className="text-xl sm:text-2xl font-black text-fuchsia-950 tracking-tight mb-2">

          아직 서비스 준비중

        </h1>

        <p className="text-sm text-fuchsia-800/70 leading-relaxed mb-8">

          {featureLine} 곧 만나보실 수 있어요.

          <br />

          조금만 기다려 주세요!

        </p>

        <Link

          to="/"

          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-lime-400 via-emerald-400 to-teal-500 text-[#0f1f0f] text-sm font-black shadow-md shadow-emerald-300/45 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all ring-1 ring-white/50"

        >

          <Home size={18} strokeWidth={2.25} />

          홈으로

        </Link>

      </div>

    </div>

  )

}


