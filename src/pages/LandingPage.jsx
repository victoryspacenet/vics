import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calcPercent, formatNumber } from '../lib/utils'
import { Logo } from '../components/ui/Logo'

// ── 스크롤 감지 훅 ──────────────────────────────────────────────────
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

// ── 투표 바 애니메이션 컴포넌트 ────────────────────────────────────
function LiveVoteBar({ pct, color, label, delay = 0 }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), delay + 300)
    return () => clearTimeout(t)
  }, [pct, delay])
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold text-white/70 uppercase tracking-wider">{label}</span>
        <span className="text-2xl font-black text-white tabular-nums">{pct}%</span>
      </div>
      <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out ${color}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

// ── 배경 카드 그리드 (Hero용) ────────────────────────────────────────
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

// ── 피처 슬라이드 데이터 ────────────────────────────────────────────
const FEATURES = [
  {
    step: '01',
    title: '30초 만에 매치업 생성',
    desc: '사진·영상·텍스트 무엇이든 올려\n나만의 대결을 즉석에서 만드세요.',
    emoji: '⚡',
    accent: 'from-lime-400 to-emerald-500',
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
    desc: '전 세계 유저가 클릭 한 번으로\n내 대결에 참전합니다.',
    emoji: '⚔️',
    accent: 'from-pink-500 to-rose-500',
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
    desc: '매 투표마다 포인트를 쌓고\n실시간 랭킹으로 안목을 인증하세요.',
    emoji: '🏆',
    accent: 'from-amber-400 to-orange-500',
    mockup: (
      <div className="bg-[#1a1a2e] rounded-2xl p-4 space-y-3 w-full">
        <div className="text-xs text-white/40 font-bold uppercase tracking-wider">안목 리포트</div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl flex-shrink-0">🏆</div>
          <div>
            <p className="text-sm font-black text-white">전설 등급 달성!</p>
            <p className="text-xs text-white/50">대한민국 상위 2%</p>
          </div>
        </div>
        <div className="space-y-1.5">
          {[
            { label: '안목 적중률', pct: 78, color: 'bg-amber-400' },
            { label: '총 투표수',   pct: 92, color: 'bg-orange-400' },
          ].map((item) => (
            <div key={item.label}>
              <div className="flex justify-between text-[10px] text-white/50 mb-0.5">
                <span>{item.label}</span><span className="font-bold text-white">{item.pct}%</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="text-center text-xs font-bold text-amber-400">+3,200P 획득 완료 ✓</div>
      </div>
    ),
  },
]

// ── 메인 컴포넌트 ────────────────────────────────────────────────────
export function LandingPage() {
  // 섹션 refs
  const [heroRef,     heroVisible]     = useScrollReveal(0.1)
  const [liveRef,     liveVisible]     = useScrollReveal(0.2)
  const [featRef,     featVisible]     = useScrollReveal(0.1)
  const [hallRef,     hallVisible]     = useScrollReveal(0.2)
  const [ctaRef,      ctaVisible]      = useScrollReveal(0.2)

  // 실시간 HOT 매치업 데이터
  const [hotMatchup, setHotMatchup] = useState(null)
  const [liveVotes,  setLiveVotes]  = useState({ left: 50, right: 50, total: 0 })

  // 피처 활성 인덱스 (스크롤 기반)
  const [activeFeature, setActiveFeature] = useState(0)
  const featureRefs = useRef([])

  // HOT 매치업 불러오기
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('matchups')
        .select('id, title, option_a_label, option_b_label, option_a_media, option_b_media, vote_count_a, vote_count_b, category')
        .eq('status', 'active')
        .order('vote_count_a', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) {
        setHotMatchup(data)
        const pct = calcPercent(data.vote_count_a, data.vote_count_b)
        setLiveVotes({ left: pct.left, right: pct.right, total: (data.vote_count_a || 0) + (data.vote_count_b || 0) })
      }
    }
    fetch()
  }, [])

  // 피처 스크롤 감지
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

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  // Layout의 px-4 + py-6 를 네거티브 마진으로 탈출 → 풀블리드 다크 배경
  return (
    <div className="-mx-4 -mt-6 bg-[#07070f] text-white overflow-x-hidden">

      {/* ══════════════════════════════════════════════════════
          § 1. HERO  (Header 높이만큼 min-h 확보)
      ══════════════════════════════════════════════════════ */}
      <section className="relative min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center overflow-hidden">

        {/* 배경 카드 그리드 */}
        <div className="absolute inset-0 grid grid-cols-3 sm:grid-cols-4 gap-2 p-2 opacity-20 blur-[1px] scale-105 pointer-events-none">
          {[...BG_CARDS, ...BG_CARDS].map((card, i) => (
            <div key={i}
              className={`rounded-xl bg-gradient-to-br ${card.bg} flex flex-col items-center justify-center gap-2 aspect-square`}
              style={{ animationDelay: `${i * 0.3}s` }}
            >
              <span className="text-3xl">{card.emoji}</span>
              <span className="text-[9px] font-black text-white/80 text-center px-1">{card.label}</span>
            </div>
          ))}
        </div>

        {/* 그라데이션 오버레이 */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#07070f]/70 via-[#07070f]/50 to-[#07070f] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#07070f]/80 via-transparent to-[#07070f]/80 pointer-events-none" />

        {/* 히어로 콘텐츠 */}
        <div ref={heroRef}
          className={`relative z-10 flex flex-col items-center text-center px-6 max-w-2xl transition-all duration-1000 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

          {/* 뱃지 */}
          <div className="flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full mb-6 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />
            <span className="text-xs font-bold text-white/60 tracking-wider">지금 실시간 대결 진행 중</span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-black leading-none mb-4 tracking-tighter">
            <span className="block text-white">누가 더</span>
            <span className="block bg-gradient-to-r from-lime-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
              힙해?
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-white/60 font-medium mb-10 leading-relaxed">
            세상의 안목으로 승부하라!<br />
            <span className="text-white/40 text-base">사진·영상·텍스트 무엇이든, 지금 대결을 시작하세요.</span>
          </p>

          {/* 통계 칩 */}
          <div className="flex items-center gap-2 sm:gap-6 mt-10 text-center">
            {[
              { label: '누적 매치업', value: '12K+' },
              { label: '총 투표수',   value: '480K+' },
              { label: '활성 유저',   value: '8K+'   },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-xl font-black text-white">{stat.value}</p>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 스크롤 유도 */}
        <button onClick={() => scrollToSection('live')}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/30 hover:text-white/60 transition-colors animate-bounce">
          <span className="text-[10px] font-bold tracking-widest uppercase">Scroll</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </button>
      </section>

      {/* ══════════════════════════════════════════════════════
          § 2. LIVE 매치업
      ══════════════════════════════════════════════════════ */}
      <section id="live" className="py-20 px-5 max-w-2xl mx-auto">
        <div ref={liveRef}
          className={`transition-all duration-700 ${liveVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>

          {/* 섹션 헤더 */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-xs font-bold text-red-400 tracking-wider uppercase">Live Now</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              지금 이 시각 <span className="text-red-400">HOT</span> 매치업
            </h2>
            <p className="text-white/40 text-sm mt-2">실제 진행 중인 실시간 대결입니다</p>
          </div>

          {/* 매치업 카드 */}
          <div className="bg-gradient-to-b from-white/5 to-white/[0.02] border border-white/10 rounded-3xl overflow-hidden">
            {hotMatchup ? (
              <div>
                {/* 제목 */}
                <div className="px-6 pt-6 pb-4 border-b border-white/5">
                  <p className="text-xs text-white/40 font-bold uppercase tracking-wider mb-1">
                    {hotMatchup.category || '매치업'}
                  </p>
                  <h3 className="text-lg font-black text-white line-clamp-2">
                    {hotMatchup.title}
                  </h3>
                </div>

                {/* 좌우 이미지 */}
                <div className="grid grid-cols-[1fr_auto_1fr]">
                  {/* A */}
                  <div className="relative aspect-square bg-gradient-to-br from-blue-600/30 to-blue-800/30 flex items-center justify-center overflow-hidden">
                    {hotMatchup.option_a_media
                      ? <img src={hotMatchup.option_a_media} alt="A" className="w-full h-full object-cover" />
                      : <div className="flex flex-col items-center gap-2">
                          <span className="text-4xl">⚡</span>
                          <span className="text-xs text-white/60 font-bold px-2 text-center">
                            {hotMatchup.option_a_label || 'A'}
                          </span>
                        </div>
                    }
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <span className="text-xs font-black text-white bg-blue-500/80 px-2 py-1 rounded-lg">
                        {hotMatchup.option_a_label || 'A'}
                      </span>
                    </div>
                  </div>

                  {/* VS 배지 */}
                  <div className="flex items-center justify-center px-3 bg-[#07070f]/80 z-10">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-lime-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-lime-500/30">
                      <span className="text-[10px] font-black text-[#07070f]">VS</span>
                    </div>
                  </div>

                  {/* B */}
                  <div className="relative aspect-square bg-gradient-to-br from-red-600/30 to-red-800/30 flex items-center justify-center overflow-hidden">
                    {hotMatchup.option_b_media
                      ? <img src={hotMatchup.option_b_media} alt="B" className="w-full h-full object-cover" />
                      : <div className="flex flex-col items-center gap-2">
                          <span className="text-4xl">🔥</span>
                          <span className="text-xs text-white/60 font-bold px-2 text-center">
                            {hotMatchup.option_b_label || 'B'}
                          </span>
                        </div>
                    }
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 text-right">
                      <span className="text-xs font-black text-white bg-red-500/80 px-2 py-1 rounded-lg">
                        {hotMatchup.option_b_label || 'B'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 투표 결과 */}
                <div className="px-6 py-5 space-y-3">
                  <LiveVoteBar pct={liveVotes.left}  color="bg-gradient-to-r from-blue-500 to-blue-400"    label={hotMatchup.option_a_label || 'A'} />
                  <LiveVoteBar pct={liveVotes.right} color="bg-gradient-to-r from-red-500 to-rose-400" label={hotMatchup.option_b_label || 'B'} delay={200} />
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-white/40">📊 {formatNumber(liveVotes.total)}명 참여 중</span>
                    <Link to={`/matchup/${hotMatchup.id}`}
                      className="text-xs font-black text-lime-400 hover:text-lime-300 transition-colors">
                      지금 투표하러 가기 →
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              // 빈 상태
              <div className="py-16 text-center text-white/30">
                <p className="text-4xl mb-3">⚔️</p>
                <p className="text-sm font-bold">진행 중인 매치업 없음</p>
                <p className="text-xs mt-1">첫 번째 대결을 시작해보세요!</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          § 3. 기능 소개 (스크롤 스티키)
      ══════════════════════════════════════════════════════ */}
      <section id="features" className="py-20 px-5 max-w-5xl mx-auto">
        <div ref={featRef}
          className={`text-center mb-16 transition-all duration-700 ${featVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="text-xs font-black text-lime-400 uppercase tracking-widest mb-3">How It Works</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white">
            단 3단계로<br />
            <span className="bg-gradient-to-r from-lime-400 to-emerald-400 bg-clip-text text-transparent">
              대결을 완성하세요
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-start">
          {/* 좌: 텍스트 리스트 */}
          <div className="space-y-2 lg:sticky lg:top-24">
            {FEATURES.map((feat, i) => (
              <div
                key={i}
                ref={(el) => { featureRefs.current[i] = el }}
                onClick={() => setActiveFeature(i)}
                className={`flex items-start gap-4 p-5 rounded-2xl cursor-pointer transition-all duration-300 ${
                  activeFeature === i
                    ? 'bg-white/5 border border-white/10'
                    : 'border border-transparent hover:bg-white/3'
                }`}
              >
                {/* 스텝 번호 */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-black transition-all ${
                  activeFeature === i
                    ? `bg-gradient-to-br ${feat.accent} text-[#07070f]`
                    : 'bg-white/5 text-white/30'
                }`}>
                  {feat.step}
                </div>
                <div>
                  <p className={`text-base font-black mb-1 transition-colors ${activeFeature === i ? 'text-white' : 'text-white/40'}`}>
                    {feat.emoji} {feat.title}
                  </p>
                  <p className={`text-sm leading-relaxed transition-colors ${activeFeature === i ? 'text-white/60' : 'text-white/20'}`}
                    style={{ whiteSpace: 'pre-line' }}>
                    {feat.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* 우: 목업 프리뷰 */}
          <div className="lg:sticky lg:top-24">
            {FEATURES.map((feat, i) => (
              <div key={i}
                className={`transition-all duration-500 ${
                  activeFeature === i
                    ? 'opacity-100 translate-y-0 scale-100'
                    : 'opacity-0 absolute pointer-events-none -translate-y-4 scale-95'
                } ${activeFeature !== i ? 'hidden lg:block' : ''}`}
              >
                {/* 폰 프레임 */}
                <div className="relative max-w-xs mx-auto">
                  <div className="bg-[#0d0d1a] rounded-3xl border border-white/10 p-4 shadow-2xl shadow-black/50">
                    {/* 상단 상태바 */}
                    <div className="flex items-center justify-between mb-3 px-1">
                      <span className="text-[10px] text-white/30 font-bold">9:41</span>
                      <img src="/logo.png" alt="VICS" width={18} height={18} className="object-contain invert opacity-80" />
                      <span className="text-[10px] text-white/30">●●●</span>
                    </div>
                    {feat.mockup}
                  </div>
                  {/* 글로우 */}
                  <div className={`absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br ${feat.accent} opacity-10 blur-xl`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          § 4. 명예의 전당 (인정 욕구 자극)
      ══════════════════════════════════════════════════════ */}
      <section id="hall" className="py-20 px-5 relative overflow-hidden">
        {/* 배경 글로우 */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-900/10 to-transparent pointer-events-none" />

        <div ref={hallRef}
          className={`max-w-3xl mx-auto transition-all duration-700 ${hallVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>

          <div className="text-center mb-12">
            <p className="text-xs font-black text-amber-400 uppercase tracking-widest mb-3">Hall of Fame</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              승리하고 <span className="text-amber-400">명예의 전당</span>에<br />오르세요
            </h2>
            <p className="text-white/40 text-sm">안목을 증명하고 SNS에 자랑하세요</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* 배지 쇼케이스 */}
            <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-3xl p-6">
              <p className="text-xs font-black text-white/40 uppercase tracking-wider mb-4">등급 배지</p>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { emoji: '🌱', name: '뉴비',   color: 'from-gray-500/20 to-gray-700/20',     glow: '' },
                  { emoji: '⚡', name: '도전자', color: 'from-blue-500/20 to-blue-700/20',     glow: 'shadow-blue-500/20' },
                  { emoji: '🔥', name: '투사',   color: 'from-green-500/20 to-green-700/20',   glow: 'shadow-green-500/20' },
                  { emoji: '⚔️', name: '전사',   color: 'from-orange-500/20 to-orange-700/20', glow: 'shadow-orange-500/20' },
                  { emoji: '🏆', name: '영웅',   color: 'from-purple-500/20 to-purple-700/20', glow: 'shadow-purple-500/20' },
                  { emoji: '💎', name: '전설',   color: 'from-red-500/20 to-red-700/20',       glow: 'shadow-red-500/20' },
                  { emoji: '👑', name: '챔피언', color: 'from-yellow-400/20 to-amber-600/20',  glow: 'shadow-yellow-500/30' },
                  { emoji: '?',  name: '???',    color: 'from-white/5 to-white/[0.02]',         glow: '' },
                ].map((badge, i) => (
                  <div key={i}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl bg-gradient-to-br ${badge.color} shadow-md ${badge.glow}`}>
                    <span className="text-xl">{badge.emoji}</span>
                    <span className="text-[9px] font-black text-white/60">{badge.name}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-white/30 mt-4 text-center">투표하고 포인트를 모아 등급을 올리세요</p>
            </div>

            {/* 인스타 공유 카드 예시 */}
            <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-3xl p-6 flex flex-col">
              <p className="text-xs font-black text-white/40 uppercase tracking-wider mb-4">공유 카드 예시</p>
              {/* 미니 스토리 카드 */}
              <div className="flex-1 bg-gradient-to-br from-[#0a1a0a] to-[#0a0a1a] rounded-2xl border border-lime-500/20 p-4 flex flex-col items-center text-center gap-3">
                <img src="/logo.png" alt="VICS" width={24} height={24} className="object-contain invert opacity-60" />
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl">🏆</div>
                <div>
                  <p className="text-[10px] text-white/50 font-bold mb-0.5">힙합 패션 vs 클래식 패션</p>
                  <p className="text-2xl font-black text-white">78%</p>
                  <p className="text-[10px] text-lime-400 font-black">WIN 🎯</p>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full w-[78%] bg-gradient-to-r from-lime-400 to-emerald-400 rounded-full" />
                </div>
                <p className="text-[9px] text-white/30 italic">
                  "내 안목은 대한민국 상위 1% 입니다"
                </p>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-pink-500/20 to-rose-500/20 border border-pink-500/20 rounded-full">
                  <span className="text-[10px]">📸</span>
                  <span className="text-[9px] font-black text-pink-300">인스타 스토리에 공유</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          § 5. FINAL CTA
      ══════════════════════════════════════════════════════ */}
      <section className="py-24 px-5 relative overflow-hidden">
        {/* 배경 */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#07070f] pointer-events-none" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 bg-lime-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 left-1/4 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
        </div>

        <div ref={ctaRef}
          className={`relative z-10 max-w-lg mx-auto text-center transition-all duration-700 ${ctaVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>

          <p className="text-sm font-black text-lime-400 uppercase tracking-widest mb-6">지금 시작하세요</p>

          <blockquote className="text-3xl sm:text-4xl font-black text-white leading-tight mb-4">
            "쫄리면 투표만 하든가,<br />
            <span className="bg-gradient-to-r from-lime-400 to-emerald-400 bg-clip-text text-transparent">
              자신 있으면 도전하든가.
            </span>"
          </blockquote>

          <p className="text-white/40 text-sm mb-10">
            수천 명의 유저가 지금 이 순간도 대결 중입니다.
          </p>

          {/* 소셜 로그인 버튼들 */}
          <div className="space-y-3 max-w-xs mx-auto">
            <Link to="/signup"
              className="flex items-center justify-center gap-3 w-full py-4 bg-gradient-to-r from-lime-400 to-emerald-400 text-[#07070f] font-black text-base rounded-2xl hover:shadow-xl hover:shadow-lime-500/30 hover:-translate-y-0.5 active:scale-95 transition-all">
              ⚫ 회원가입하고 시작하기
            </Link>
            <Link to="/login"
              className="flex items-center justify-center gap-2 w-full py-3.5 bg-white/5 border border-white/10 text-white/70 font-bold text-sm rounded-2xl hover:bg-white/8 hover:text-white transition-all">
              이미 계정이 있어요 → 로그인
            </Link>
          </div>
        </div>
      </section>

      {/* ── 푸터 ── */}
      <footer className="border-t border-white/5 py-8 px-5">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-white/20 text-xs font-medium">
          <Logo size={28} dark link={false} className="opacity-60" />
          <span>© 2026 VICTORYSPACE. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-white/50 transition-colors">개인정보처리방침</a>
            <a href="#" className="hover:text-white/50 transition-colors">이용약관</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
