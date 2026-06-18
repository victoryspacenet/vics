import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calcPercent, formatNumber } from '../lib/utils'
import { fetchLandingPublicStats } from '../lib/landingPublicStats'
import { safeMediaUrl } from '../lib/sanitize'
import { Logo } from '../components/ui/Logo'
import { VsBadge } from '../components/ui/VsBadge'
import { TIERS, TIER_MIN_HOLD_POINTS } from '../lib/tiers'

const HALL_TIER_CARD_STYLE = {
  player: { color: 'from-gray-500/20 to-gray-700/20', glow: '' },
  star: { color: 'from-amber-500/20 to-amber-700/20', glow: 'shadow-amber-500/20' },
  master: { color: 'from-orange-500/20 to-orange-700/20', glow: 'shadow-orange-500/20' },
  vip: { color: 'from-violet-500/20 to-violet-700/20', glow: 'shadow-violet-500/20' },
  goat: { color: 'from-yellow-400/20 to-amber-600/20', glow: 'shadow-yellow-500/30' },
}

const TIER_CONDITION_KO = {
  player: '가입 직후 기본',
  star: `매치업 생성 10회 이상 및 투표 20회 이상, 보유 P ${TIER_MIN_HOLD_POINTS.star.toLocaleString('ko-KR')} 이상`,
  master: `Star 조건을 모두 충족한 뒤, 매치업 생성 승리 20회 이상 및 적중률 65% 이상, 보유 P ${TIER_MIN_HOLD_POINTS.master.toLocaleString('ko-KR')} 이상`,
  vip: `Star·Master 조건을 모두 충족한 뒤, The Champion / The Oracle 중 하나 이상 참여·전체 랭킹 상위 10%, 보유 P ${TIER_MIN_HOLD_POINTS.vip.toLocaleString('ko-KR')} 이상`,
  goat: `Star·Master·Vip 조건을 모두 충족한 뒤, The Champion / The Oracle 각각 전체 1~10위, 주간 1~3위, 월간 1~7위 중 하나 이상 달성, 보유 P ${TIER_MIN_HOLD_POINTS.goat.toLocaleString('ko-KR')} 이상`,
}

const FANDOM_TIER_ROWS = [
  { grade: 'BRONZE', badge: '라이징 스타', claps: '100회', perks: '이름 옆 기본 스타 배지', accent: 'text-orange-300/95' },
  { grade: 'SILVER', badge: '크라우드 페이버릿', claps: '500회', perks: '프로필 테두리 실버 글로우', accent: 'text-slate-200/95' },
  { grade: 'GOLD', badge: '빅토리 아이콘', claps: '1,000회', perks: '전용 이모지 · 프로필 테두리 골드 글로우', accent: 'text-yellow-200/95' },
  { grade: 'DIAMOND', badge: '언터처블 레전드', claps: '5,000회', perks: '닉네임에 다이아몬드 오라 · 레전더리 다크 UI', accent: 'text-fuchsia-200/95' },
]

const BG_CARDS = [
  { bg: 'from-violet-600 to-purple-800',   emoji: '👗', label: '와이드 vs 스키니' },
  { bg: 'from-pink-500 to-rose-700',       emoji: '💄', label: '매트 vs 글로시' },
  { bg: 'from-lime-400 to-emerald-600',    emoji: '👟', label: '나이키 vs 아디다스' },
  { bg: 'from-amber-400 to-orange-600',    emoji: '🍜', label: '짜장 vs 짬뽕' },
  { bg: 'from-sky-400 to-blue-700',        emoji: '✈️', label: '국내 vs 해외' },
  { bg: 'from-fuchsia-500 to-pink-700',    emoji: '🎵', label: '힙합 vs 인디' },
  { bg: 'from-teal-400 to-cyan-600',       emoji: '📸', label: '폰 vs 카메라' },
  { bg: 'from-red-500 to-rose-700',        emoji: '🏋️', label: '헬스 vs 필라테스' },
]

const FEATURES = [
  {
    step: '01',
    title: '1분 만에 매치업 생성',
    desc: '사진·영상·텍스트 무엇이든 올려\n나만의 경쟁을 즉석에서 만드세요.',
    emoji: '⚡',
    accent: 'from-lime-400 to-emerald-500',
    glowColor: 'rgba(163,230,53,0.15)',
    mockup: (
      <div className="bg-[#1a1a2e] rounded-2xl p-4 space-y-3 w-full">
        <div className="text-xs text-white/40 font-bold uppercase tracking-wider">매치업 생성</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="aspect-square bg-gradient-to-br from-violet-500/40 to-purple-700/40 rounded-xl flex flex-col items-center justify-center gap-1 border border-violet-500/30">
            <span className="text-2xl">👗</span>
            <span className="text-[10px] text-white/60 font-bold">MY SHOT</span>
          </div>
          <div className="aspect-square bg-white/5 rounded-xl flex flex-col items-center justify-center gap-1 border border-white/10 border-dashed">
            <span className="text-white/30 text-xl">+</span>
            <span className="text-[10px] text-white/30 font-bold">도전자 대기중</span>
          </div>
        </div>
        <div className="h-9 bg-gradient-to-r from-lime-400 to-emerald-500 rounded-xl flex items-center justify-center">
          <span className="text-[11px] font-black text-[#0a1a0a]">🔥 NEW 매치업 만들기</span>
        </div>
      </div>
    ),
  },
  {
    step: '02',
    title: '실시간 1:1 투표 매칭',
    desc: '전 세계 유저가 클릭 한 번으로\n내 경쟁에 참전합니다.',
    emoji: '⚔️',
    accent: 'from-pink-500 to-rose-500',
    glowColor: 'rgba(236,72,153,0.15)',
    mockup: (
      <div className="bg-[#1a1a2e] rounded-2xl p-4 space-y-3 w-full">
        <div className="text-xs text-white/40 font-bold uppercase tracking-wider flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block" />
          LIVE 투표 중
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="aspect-square bg-gradient-to-br from-blue-500/30 to-blue-700/30 rounded-xl flex items-center justify-center border-2 border-blue-400/50 relative overflow-hidden">
            <span className="text-3xl">👗</span>
            <div className="absolute top-1.5 left-1.5 bg-blue-400 text-[9px] font-black text-white px-1.5 py-0.5 rounded-full">62%</div>
          </div>
          <div className="aspect-square bg-gradient-to-br from-red-500/30 to-red-700/30 rounded-xl flex items-center justify-center border border-red-400/20 relative overflow-hidden">
            <span className="text-3xl">👔</span>
            <div className="absolute top-1.5 right-1.5 bg-red-400/60 text-[9px] font-black text-white px-1.5 py-0.5 rounded-full">38%</div>
          </div>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full w-[62%] bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all duration-1000" />
        </div>
        <div className="text-center text-xs text-white/50 font-bold">📊 1,248명 참여 중</div>
      </div>
    ),
  },
  {
    step: '03',
    title: '데이터로 증명하는 안목',
    desc: '투표·매치업 결과에 따라 포인트를 쌓고\n일 1회 업데이트 랭킹으로 안목을 인증하세요.',
    emoji: '🏆',
    accent: 'from-amber-400 to-orange-500',
    glowColor: 'rgba(251,191,36,0.15)',
    mockup: (
      <div className="bg-[#1a1a2e] rounded-2xl p-4 space-y-3 w-full">
        <div className="text-xs text-white/40 font-bold uppercase tracking-wider">안목 리포트</div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl flex-shrink-0">
            {TIERS[4].emoji}
          </div>
          <div>
            <p className="text-sm font-black text-white">{TIERS[4].name} 등급 달성!</p>
            <p className="text-xs text-white/50">{TIERS[4].benefit}</p>
          </div>
        </div>
        <div className="space-y-1.5">
          {[
            { label: '안목 적중률', valueText: '78%', barPct: 78, color: 'bg-amber-400' },
            { label: '매치업 생성 승리수', valueText: '90', barPct: 90, color: 'bg-orange-400' },
          ].map((item) => (
            <div key={item.label}>
              <div className="flex justify-between text-[10px] text-white/50 mb-0.5">
                <span>{item.label}</span><span className="font-bold text-white">{item.valueText}</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.barPct}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="text-center text-xs font-bold text-amber-400">+3,200P 획득 완료 ✓</div>
      </div>
    ),
  },
]

function useScrollReveal(threshold = 0.15) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, visible]
}

function LiveVoteBar({ pct, color, label, delay = 0 }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), delay + 300)
    return () => clearTimeout(t)
  }, [pct, delay])
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold text-white/60 uppercase tracking-wider">{label}</span>
        <span className="text-2xl font-black text-white tabular-nums">{pct}%</span>
      </div>
      <div className="h-3 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out ${color}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

export function LandingPage() {
  const location = useLocation()
  const [heroRef,       heroVisible]       = useScrollReveal(0.1)
  const [liveRef,       liveVisible]       = useScrollReveal(0.2)
  const [featRef,       featVisible]       = useScrollReveal(0.1)
  const [hallRef,       hallVisible]       = useScrollReveal(0.2)
  const [fandomTierRef, fandomTierVisible] = useScrollReveal(0.15)
  const [ctaRef,        ctaVisible]        = useScrollReveal(0.2)

  const [hallBadgeTab, setHallBadgeTab] = useState('tier')
  const [hotMatchup, setHotMatchup]     = useState(null)
  const [liveVotes,  setLiveVotes]      = useState({ left: 50, right: 50, total: 0 })
  const [landingStats, setLandingStats] = useState({ loading: true, matchupCount: 0, voteCount: 0, activeUserCount: 0 })
  const [activeFeature, setActiveFeature] = useState(0)
  const featureRefs = useRef([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [stats, hotRes] = await Promise.all([
        fetchLandingPublicStats(),
        supabase
          .from('matchups')
          .select('id, title, category, tags, left_thumbnail_url, left_label, right_thumbnail_url, right_label, left_votes, right_votes, total_votes')
          .eq('status', 'active')
          .not('right_type', 'is', null)
          .order('total_votes', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      if (cancelled) return
      setLandingStats({ loading: false, matchupCount: stats.matchupCount, voteCount: stats.voteCount, activeUserCount: stats.activeUserCount })
      const data = hotRes.data
      if (data) {
        setHotMatchup({
          id: data.id,
          title: data.title,
          category: data.category || (Array.isArray(data.tags) && data.tags[0]) || null,
          option_a_media: data.left_thumbnail_url,
          option_b_media: data.right_thumbnail_url,
          option_a_label: data.left_label,
          option_b_label: data.right_label,
        })
        const pct = calcPercent(data.left_votes, data.right_votes)
        setLiveVotes({ left: pct.left, right: pct.right, total: (data.left_votes || 0) + (data.right_votes || 0) })
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const idx = featureRefs.current.indexOf(e.target)
            if (idx !== -1) setActiveFeature(idx)
          }
        })
      },
      { threshold: 0.5, rootMargin: '-20% 0px -20% 0px' }
    )
    featureRefs.current.forEach((el) => el && obs.observe(el))
    return () => obs.disconnect()
  }, [])

  const scrollToSection = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className="-mx-4 -mt-6 bg-[#07070f] text-white overflow-x-hidden">

      {/* ════════════════════════════════════════
          § 1. HERO
      ════════════════════════════════════════ */}
      <section className="relative min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center overflow-hidden">

        {/* 배경 카드 그리드 */}
        <div className="absolute inset-0 grid grid-cols-3 sm:grid-cols-4 gap-2 p-2 opacity-[0.18] blur-[1.5px] scale-105 pointer-events-none">
          {[...BG_CARDS, ...BG_CARDS].map((card, i) => (
            <div key={i} className={`rounded-xl bg-gradient-to-br ${card.bg} flex flex-col items-center justify-center gap-2 aspect-square`}>
              <span className="text-3xl">{card.emoji}</span>
              <span className="text-[9px] font-black text-white/80 text-center px-1">{card.label}</span>
            </div>
          ))}
        </div>

        {/* 그라데이션 오버레이 */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#07070f]/75 via-[#07070f]/55 to-[#07070f] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#07070f]/85 via-transparent to-[#07070f]/85 pointer-events-none" />

        {/* 히어로 중앙 글로우 */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,_rgba(163,230,53,0.07)_0%,_transparent_65%)] pointer-events-none" />

        {/* 히어로 콘텐츠 */}
        <div ref={heroRef}
          className={`relative z-10 flex flex-col items-center text-center px-6 max-w-2xl transition-all duration-1000 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>

          {/* 라이브 뱃지 */}
          <div className="flex items-center gap-2.5 px-4 py-2 bg-white/[0.06] border border-white/[0.12] rounded-full mb-7 backdrop-blur-sm shadow-lg">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-lime-400" />
            </span>
            <span className="text-xs font-bold text-white/65 tracking-wider">지금 실시간 경쟁 진행 중</span>
          </div>

          {/* 헤드라인 */}
          <h1 className="text-5xl sm:text-7xl font-black leading-[0.95] mb-5 tracking-tighter">
            <span className="block text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.08)]">누가 더</span>
            <span className="block bg-gradient-to-r from-lime-300 via-emerald-400 to-teal-300 bg-clip-text text-transparent drop-shadow-[0_0_60px_rgba(163,230,53,0.35)]">
              힙해?
            </span>
          </h1>

          <p className="text-base sm:text-lg text-white/55 font-medium mb-8 leading-relaxed max-w-md">
            세상의 안목으로 승부하라!<br />
            <span className="text-white/35 text-sm">사진·영상·텍스트 무엇이든, 지금 경쟁을 시작하세요.</span>
          </p>

          {/* 통계 */}
          <div className="flex items-center gap-0 mt-2">
            {[
              { label: '누적 매치업', value: formatNumber(landingStats.matchupCount) },
              { label: '총 투표수',   value: formatNumber(landingStats.voteCount) },
              { label: '활성 유저',   value: formatNumber(landingStats.activeUserCount) },
            ].map((stat, i) => (
              <div key={stat.label} className="flex items-stretch">
                {i > 0 && <div className="w-px mx-5 sm:mx-8 bg-white/10 self-stretch" />}
                <div className="text-center">
                  <p className="text-2xl font-black text-white tabular-nums">
                    {landingStats.loading ? <span className="text-white/30 text-lg">…</span> : stat.value}
                  </p>
                  <p className="text-[10px] text-white/35 font-bold uppercase tracking-wider mt-0.5">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 스크롤 유도 */}
        <button onClick={() => scrollToSection('live')}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/25 hover:text-white/55 transition-colors animate-bounce">
          <span className="text-[10px] font-bold tracking-widest uppercase">Scroll</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </button>
      </section>

      {/* ════════════════════════════════════════
          § 2. LIVE 매치업
      ════════════════════════════════════════ */}
      <section id="live" className="py-20 px-5 max-w-2xl mx-auto">
        <div ref={liveRef}
          className={`transition-all duration-700 ${liveVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>

          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-red-500/[0.12] border border-red-500/25 rounded-full mb-5 shadow-[0_0_20px_rgba(239,68,68,0.1)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400" />
              </span>
              <span className="text-xs font-black text-red-400 tracking-wider uppercase">Live Now</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-2">
              지금 이 시각 <span className="text-red-400 drop-shadow-[0_0_20px_rgba(248,113,113,0.4)]">HOT</span> 매치업
            </h2>
            <p className="text-white/35 text-sm">실제 진행 중인 실시간 경쟁입니다</p>
          </div>

          {/* 매치업 카드 */}
          <div className="rounded-3xl overflow-hidden border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.02] shadow-2xl shadow-black/40">
            {hotMatchup ? (
              <div>
                <div className="px-6 pt-6 pb-4 border-b border-white/[0.06] bg-white/[0.02]">
                  <p className="text-[11px] text-white/35 font-black uppercase tracking-widest mb-1.5">
                    {hotMatchup.category || '매치업'}
                  </p>
                  <h3 className="text-lg font-black text-white line-clamp-2 leading-tight">{hotMatchup.title}</h3>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr]">
                  <div className="relative aspect-square bg-gradient-to-br from-blue-600/30 to-blue-800/30 flex items-center justify-center overflow-hidden">
                    {hotMatchup.option_a_media
                      ? <img src={safeMediaUrl(hotMatchup.option_a_media)} alt="A" className="w-full h-full object-cover" />
                      : <div className="flex flex-col items-center gap-2"><span className="text-4xl">⚡</span><span className="text-xs text-white/60 font-bold px-2 text-center">{hotMatchup.option_a_label || 'A'}</span></div>
                    }
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/20" />
                    <div className="absolute bottom-3 left-3">
                      <span className="text-xs font-black text-white bg-blue-500/90 backdrop-blur-sm px-2.5 py-1 rounded-lg shadow-lg">
                        {hotMatchup.option_a_label || 'A'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center px-3 bg-[#07070f]/80 z-10">
                    <VsBadge size="lg" variant="story" />
                  </div>
                  <div className="relative aspect-square bg-gradient-to-br from-red-600/30 to-red-800/30 flex items-center justify-center overflow-hidden">
                    {hotMatchup.option_b_media
                      ? <img src={safeMediaUrl(hotMatchup.option_b_media)} alt="B" className="w-full h-full object-cover" />
                      : <div className="flex flex-col items-center gap-2"><span className="text-4xl">🔥</span><span className="text-xs text-white/60 font-bold px-2 text-center">{hotMatchup.option_b_label || 'B'}</span></div>
                    }
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-l from-transparent to-black/20" />
                    <div className="absolute bottom-3 right-3 text-right">
                      <span className="text-xs font-black text-white bg-red-500/90 backdrop-blur-sm px-2.5 py-1 rounded-lg shadow-lg">
                        {hotMatchup.option_b_label || 'B'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-5 space-y-3.5 bg-white/[0.02]">
                  <LiveVoteBar pct={liveVotes.left}  color="bg-gradient-to-r from-blue-500 to-blue-400"  label={hotMatchup.option_a_label || 'A'} />
                  <LiveVoteBar pct={liveVotes.right} color="bg-gradient-to-r from-red-500 to-rose-400"   label={hotMatchup.option_b_label || 'B'} delay={200} />
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-white/35 font-semibold">📊 {formatNumber(liveVotes.total)}명 참여 중</span>
                    <Link to={`/matchup/${hotMatchup.id}`}
                      className="inline-flex items-center gap-1 text-xs font-black text-lime-400 hover:text-lime-300 transition-colors hover:gap-1.5">
                      지금 투표하러 가기
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-white/25">
                <p className="text-5xl mb-4">⚔️</p>
                <p className="text-sm font-bold">진행 중인 매치업 없음</p>
                <p className="text-xs mt-1 text-white/20">첫 번째 경쟁을 시작해보세요!</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          § 3. 기능 소개
      ════════════════════════════════════════ */}
      <section id="features" className="py-20 px-5 max-w-5xl mx-auto">
        <div ref={featRef}
          className={`text-center mb-16 transition-all duration-700 ${featVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="text-xs font-black text-lime-400 uppercase tracking-widest mb-3">How It Works</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white">
            단 3단계로<br />
            <span className="bg-gradient-to-r from-lime-400 to-emerald-400 bg-clip-text text-transparent">
              경쟁 완성
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-start">
          <div className="space-y-2 lg:sticky lg:top-24">
            {FEATURES.map((feat, i) => (
              <div
                key={i}
                ref={(el) => { featureRefs.current[i] = el }}
                onClick={() => setActiveFeature(i)}
                className={`flex items-start gap-4 p-5 rounded-2xl cursor-pointer transition-all duration-300 ${
                  activeFeature === i
                    ? 'bg-white/[0.05] border border-white/[0.10] shadow-lg'
                    : 'border border-transparent hover:bg-white/[0.03]'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-black transition-all ${
                  activeFeature === i
                    ? `bg-gradient-to-br ${feat.accent} text-[#07070f] shadow-lg`
                    : 'bg-white/[0.06] text-white/25'
                }`}>
                  {feat.step}
                </div>
                <div>
                  <p className={`text-base font-black mb-1.5 transition-colors ${activeFeature === i ? 'text-white' : 'text-white/35'}`}>
                    {feat.emoji} {feat.title}
                  </p>
                  <p className={`text-sm leading-relaxed transition-colors ${activeFeature === i ? 'text-white/55' : 'text-white/18'}`}
                    style={{ whiteSpace: 'pre-line' }}>
                    {feat.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:sticky lg:top-24 relative">
            {FEATURES.map((feat, i) => (
              <div key={i}
                className={`transition-all duration-500 ${
                  activeFeature === i
                    ? 'opacity-100 translate-y-0 scale-100'
                    : 'opacity-0 absolute pointer-events-none -translate-y-4 scale-95'
                } ${activeFeature !== i ? 'hidden lg:block' : ''}`}
              >
                <div className="relative max-w-xs mx-auto">
                  {/* 글로우 */}
                  <div
                    className={`absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br ${feat.accent} opacity-[0.12] blur-2xl`}
                    style={{ background: `radial-gradient(circle, ${feat.glowColor} 0%, transparent 70%)` }}
                  />
                  {/* 폰 프레임 */}
                  <div className="bg-[#0d0d1a] rounded-3xl border border-white/[0.10] p-4 shadow-2xl shadow-black/60">
                    <div className="flex items-center justify-between mb-3 px-1">
                      <span className="text-[10px] text-white/25 font-bold">9:41</span>
                      <img src="/logo.png" alt="VICS" width={18} height={18} className="object-contain invert opacity-70" />
                      <span className="text-[10px] text-white/25">●●●</span>
                    </div>
                    {feat.mockup}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          § 4. 명예의 전당
      ════════════════════════════════════════ */}
      <section id="hall" className="py-20 px-5 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-900/[0.08] to-transparent" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-[radial-gradient(ellipse,_rgba(245,158,11,0.06)_0%,_transparent_70%)]" />
        </div>

        <div ref={hallRef}
          className={`max-w-3xl mx-auto transition-all duration-700 ${hallVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>

          <div className="text-center mb-12">
            <p className="text-xs font-black text-amber-400 uppercase tracking-widest mb-3">Hall of Fame</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">
              승리하고{' '}
              <span className="text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.3)]">명예의 전당</span> 등극
            </h2>
            <p className="text-white/35 text-sm">안목을 증명하고 SNS에 자랑하세요</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* 배지 쇼케이스 */}
            <div className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] rounded-3xl p-6">
              <p className="text-[11px] font-black text-white/35 uppercase tracking-wider mb-4">매치업 등급 배지</p>
              <div className="grid grid-cols-5 gap-2.5">
                {TIERS.map((tier) => {
                  const s = HALL_TIER_CARD_STYLE[tier.id]
                  return (
                    <div key={tier.id}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl bg-gradient-to-br ${s.color} shadow-md ${s.glow} border border-white/[0.06] hover:border-white/[0.12] transition-all`}>
                      <span className="text-xl">{tier.emoji}</span>
                      <span className="text-[9px] font-black text-white/55">{tier.name}</span>
                    </div>
                  )
                })}
              </div>

              <div className="flex gap-1 mt-5 p-1 rounded-xl bg-black/40 border border-white/[0.08]" role="tablist">
                {[
                  { id: 'tier', label: '등급·혜택' },
                  { id: 'season', label: '시즌제' },
                  { id: 'points', label: '포인트' },
                ].map((t) => (
                  <button key={t.id} type="button" role="tab" aria-selected={hallBadgeTab === t.id}
                    onClick={() => setHallBadgeTab(t.id)}
                    className={`flex-1 py-2 px-2 rounded-lg text-[11px] font-black transition-all ${
                      hallBadgeTab === t.id
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                        : 'text-white/40 hover:text-white/65 border border-transparent'
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-white/[0.08] bg-black/20 overflow-hidden">
                {hallBadgeTab === 'tier' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[10px] sm:text-[11px]">
                      <thead>
                        <tr className="border-b border-white/[0.08] bg-white/[0.03]">
                          <th className="py-2.5 px-2 font-black text-amber-400/80 whitespace-nowrap">티어</th>
                          <th className="py-2.5 px-2 font-black text-white/40 whitespace-nowrap">조건</th>
                          <th className="py-2.5 px-2 font-black text-white/40">혜택</th>
                        </tr>
                      </thead>
                      <tbody className="text-white/70">
                        {TIERS.map((tier, idx) => (
                          <tr key={tier.id} className={idx < TIERS.length - 1 ? 'border-b border-white/[0.05]' : ''}>
                            <td className="py-2 px-2 font-black text-white whitespace-nowrap">
                              <span className="mr-1">{tier.emoji}</span>{tier.name}
                            </td>
                            <td className="py-2 px-2">{TIER_CONDITION_KO[tier.id]}</td>
                            <td className="py-2 px-2">{tier.benefit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {hallBadgeTab === 'season' && (
                  <div className="p-4 space-y-3 text-[11px] sm:text-sm text-white/65 leading-relaxed">
                    <p className="font-black text-amber-300/80 text-xs uppercase tracking-wider">시즌제 운영</p>
                    <p>
                      <span className="text-white font-bold">4개월 단위</span>로 시즌을 운영하며, 시즌이 바뀌면 순위가 초기화됩니다.
                      매 시즌마다 새로운 순위 경쟁에 참여할 수 있습니다.
                    </p>
                  </div>
                )}
                {hallBadgeTab === 'points' && (
                  <div className="p-3 sm:p-4 space-y-4">
                    <p className="text-[10px] sm:text-[11px] text-white/50 leading-relaxed">
                      한 명의 유저가 하루 평균 10분 접속하여 활동할 때 얻는 <span className="text-white/75 font-bold">기대 포인트</span>를 참고용으로 안내합니다.
                    </p>
                    <div className="overflow-x-auto -mx-1 px-1">
                      <table className="w-full min-w-[320px] text-left text-[9px] sm:text-[10px]">
                        <thead>
                          <tr className="border-b border-white/[0.08] bg-white/[0.03]">
                            <th className="py-2 px-1.5 font-black text-amber-400/80">활동 항목</th>
                            <th className="py-2 px-1.5 font-black text-white/40 whitespace-nowrap">획득량</th>
                            <th className="py-2 px-1.5 font-black text-white/40 whitespace-nowrap">일일 제한</th>
                            <th className="py-2 px-1.5 font-black text-white/40 whitespace-nowrap">최대(일)</th>
                            <th className="py-2 px-1.5 font-black text-white/40">비고</th>
                          </tr>
                        </thead>
                        <tbody className="text-white/70">
                          <tr className="border-b border-white/[0.05]"><td className="py-2 px-1.5">출석 체크</td><td className="py-2 px-1.5 whitespace-nowrap">10 P</td><td className="py-2 px-1.5">1회</td><td className="py-2 px-1.5">10 P</td><td className="py-2 px-1.5">7일 연속 출석 시(매 7일마다) 보너스 70P</td></tr>
                          <tr className="border-b border-white/[0.05]"><td className="py-2 px-1.5">투표 참여</td><td className="py-2 px-1.5">150 P</td><td className="py-2 px-1.5">—</td><td className="py-2 px-1.5">—</td><td className="py-2 px-1.5"> </td></tr>
                          <tr className="border-b border-white/[0.05]"><td className="py-2 px-1.5">매치업 생성</td><td className="py-2 px-1.5">150 P</td><td className="py-2 px-1.5">—</td><td className="py-2 px-1.5">—</td><td className="py-2 px-1.5"> </td></tr>
                          <tr>
                            <td className="py-2 px-1.5 align-top">
                              <span className="block">생성·투표 승/패</span>
                              <span className="mt-1 block text-[8px] sm:text-[9px] text-white/35 leading-snug">(서비스 내 실제 1회 지급 포인트)</span>
                            </td>
                            <td className="py-2 px-1.5 whitespace-nowrap align-top">승 50P·25P / 패 10P·5P</td>
                            <td className="py-2 px-1.5 align-top">—</td>
                            <td className="py-2 px-1.5 align-top">—</td>
                            <td className="py-2 px-1.5 align-top">무승부: 생성자 30P / 투표자 15P</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-white/40 leading-relaxed border-t border-white/[0.08] pt-3">
                      <span className="text-white/55 font-bold">유효기간:</span>{' '}
                      출석·이벤트 보상 등 서비스 활동으로 받은 포인트 중, 투표·매치업 결과로 받은 포인트를 제외한 항목은 획득일로부터 4개월 후 소멸됩니다.{' '}
                      90일간 투표를 1회 이상 하지 않으면 휴면으로 전환되며, 이때 출석·투표·매치업 결과·이벤트 보상 등 서비스 활동으로 받은 포인트가 만료됩니다.
                    </p>
                  </div>
                )}
              </div>

              <p className="text-[10px] text-white/25 mt-4 text-center leading-relaxed">매치업을 만들고 투표에 참여해, 결과가 나온 뒤 포인트를 모아 등급을 올리세요</p>
            </div>

            {/* 공유 카드 예시 */}
            <div className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] rounded-3xl p-6 flex flex-col">
              <p className="text-[11px] font-black text-white/35 uppercase tracking-wider mb-4">공유 카드 예시</p>
              <div className="flex-1 bg-gradient-to-br from-[#0a1a0a] to-[#0a0a1a] rounded-2xl border border-lime-500/20 p-4 flex flex-col items-center text-center gap-3 shadow-inner shadow-lime-900/10">
                <img src="/logo.png" alt="VICS" width={24} height={24} className="object-contain invert opacity-55" />
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl shadow-lg shadow-amber-900/30">
                  {TIERS[4].emoji}
                </div>
                <div>
                  <p className="text-[10px] text-white/45 font-bold mb-1">힙합 패션 vs 클래식 패션</p>
                  <p className="text-3xl font-black text-white tabular-nums">78%</p>
                  <p className="text-[11px] text-lime-400 font-black mt-0.5">WIN 🎯</p>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full w-[78%] bg-gradient-to-r from-lime-400 to-emerald-400 rounded-full shadow-sm shadow-lime-500/20" />
                </div>
                <p className="text-[9px] text-white/25 italic">"내 안목은 대한민국 상위 1% 입니다"</p>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-pink-500/20 to-rose-500/20 border border-pink-500/20 rounded-full">
                  <span className="text-[10px]">📸</span>
                  <span className="text-[9px] font-black text-pink-300">인스타 스토리에 공유</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          § 5. 팬덤 등급
      ════════════════════════════════════════ */}
      <section id="fandom-tier" className="py-20 px-5 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-fuchsia-950/10 to-transparent" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-[radial-gradient(ellipse,_rgba(192,38,211,0.06)_0%,_transparent_70%)]" />
        </div>

        <div ref={fandomTierRef}
          className={`relative z-10 max-w-3xl mx-auto transition-all duration-700 ${fandomTierVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
          <div className="text-center mb-10">
            <p className="text-xs font-black text-fuchsia-400/80 uppercase tracking-widest mb-3">Fandom</p>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
              팬덤 등급 및 배지 체계{' '}
              <span className="text-fuchsia-300/80 drop-shadow-[0_0_15px_rgba(216,180,254,0.2)]">(Fandom Tier)</span>
            </h2>
            <p className="text-white/40 text-sm max-w-xl mx-auto leading-relaxed">
              팬덤 포인트(F-Point)와 누적 Claps에 따라 부여되는 배지 등급표입니다.
            </p>
          </div>

          <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.02] overflow-hidden shadow-xl shadow-fuchsia-950/15">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[10px] sm:text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.04]">
                    <th className="py-3.5 px-4 font-black text-fuchsia-300/80 whitespace-nowrap">등급</th>
                    <th className="py-3.5 px-4 font-black text-white/45 whitespace-nowrap">배지 명칭</th>
                    <th className="py-3.5 px-4 font-black text-white/45 whitespace-nowrap">달성 조건 (Claps)</th>
                    <th className="py-3.5 px-4 font-black text-white/45">주요 혜택 (Perks)</th>
                  </tr>
                </thead>
                <tbody className="text-white/75">
                  {FANDOM_TIER_ROWS.map((row, idx) => (
                    <tr key={row.grade} className={idx < FANDOM_TIER_ROWS.length - 1 ? 'border-b border-white/[0.05]' : ''}>
                      <td className={`py-3.5 px-4 font-black whitespace-nowrap ${row.accent}`}>{row.grade}</td>
                      <td className="py-3.5 px-4 font-bold text-white/90 whitespace-nowrap">{row.badge}</td>
                      <td className="py-3.5 px-4 font-semibold tabular-nums">{row.claps}</td>
                      <td className="py-3.5 px-4 leading-snug">{row.perks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] sm:text-[11px] text-white/30 px-4 py-3 border-t border-white/[0.06] text-center">
              Clap은 V-Card 리포트에서 팬이 크리에이터에게 보내는 축하 1회이며, F-Point는 누적 Clap 수에 5배 연동됩니다.
            </p>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          § 6. FINAL CTA
      ════════════════════════════════════════ */}
      <section className="py-28 px-5 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#07070f]/30 to-[#07070f]" />
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,_rgba(163,230,53,0.08)_0%,_transparent_65%)]" />
          <div className="absolute -bottom-10 left-1/3 w-64 h-64 rounded-full bg-[radial-gradient(circle,_rgba(52,211,153,0.06)_0%,_transparent_70%)]" />
          <div className="absolute top-1/2 right-1/4 w-48 h-48 rounded-full bg-[radial-gradient(circle,_rgba(139,92,246,0.05)_0%,_transparent_70%)]" />
        </div>

        <div ref={ctaRef}
          className={`relative z-10 max-w-lg mx-auto text-center transition-all duration-700 ${ctaVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>

          <div className="inline-flex items-center gap-2 px-4 py-2 bg-lime-500/[0.08] border border-lime-500/20 rounded-full mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-lime-400" />
            </span>
            <span className="text-xs font-black text-lime-400 uppercase tracking-widest">지금 시작하세요</span>
          </div>

          <blockquote className="text-3xl sm:text-4xl font-black text-white leading-tight mb-4">
            &quot;쫄리면 투표만 하든가,<br />
            <span className="bg-gradient-to-r from-lime-300 to-emerald-400 bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(163,230,53,0.25)]">
              자신 있으면 도전하든가!
            </span>&quot;
          </blockquote>

          <p className="text-white/35 text-sm mb-10 leading-relaxed">
            수천 명의 유저가 지금 이 순간도 경쟁 중입니다.
          </p>

          <div className="space-y-3 max-w-xs mx-auto">
            <Link to="/signup"
              className="flex items-center justify-center gap-3 w-full py-4 bg-gradient-to-r from-lime-400 to-emerald-400 text-[#07070f] font-black text-base rounded-2xl hover:shadow-[0_12px_40px_rgba(163,230,53,0.35)] hover:-translate-y-0.5 active:scale-95 transition-all">
              ⚫ 회원가입하고 시작하기
            </Link>
            <Link to="/login" state={{ from: location }}
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-white/[0.05] border border-white/[0.10] text-white/60 font-bold text-sm rounded-2xl hover:bg-white/[0.09] hover:text-white/85 hover:border-white/[0.18] transition-all">
              이미 계정이 있어요 → 로그인
            </Link>
          </div>
        </div>
      </section>

      {/* ── 푸터 ── */}
      <footer className="border-t border-white/[0.05] py-10 px-5">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5 text-white/20 text-xs font-medium">
          <Logo size={28} dark link={false} className="opacity-55" />
          <span className="text-white/18">© 2026 VICTORYSPACE. All rights reserved.</span>
          <div className="flex items-center gap-5">
            <Link to="/privacy" className="hover:text-white/50 transition-colors">개인정보처리방침</Link>
            <Link to="/terms" className="hover:text-white/50 transition-colors">이용약관</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
