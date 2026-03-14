import { useEffect, useRef, useCallback, useState } from 'react'
import { X, Palette, Flame, ChevronRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatNumber, getLevel } from '../../lib/utils'
import { RankingCardEditor } from './RankingCardEditor'

// ── 순위별 테마 설정 ─────────────────────────────────────────────────
const RANK_CFG = {
  1:  {
    medal: '🥇', title: 'CHAMPION',
    bg:   'from-amber-950 via-yellow-900 to-[#0f0d00]',
    glow: 'rgba(251,191,36,0.35)',
    accent: '#FCD34D', accentDark: '#78350f',
    reward: 1000, emblem: '🏆 골드 엠블럼 (30일)',
    canvasBg: ['#451a03','#78350f','#0f0f0f'],
  },
  2:  {
    medal: '🥈', title: 'RUNNER-UP',
    bg:   'from-slate-800 via-slate-700 to-[#0a0a12]',
    glow: 'rgba(148,163,184,0.35)',
    accent: '#CBD5E1', accentDark: '#334155',
    reward: 800, emblem: '🥈 실버 엠블럼 (14일)',
    canvasBg: ['#1e293b','#334155','#0a0a0a'],
  },
  3:  {
    medal: '🥉', title: 'TOP CHALLENGER',
    bg:   'from-orange-950 via-amber-900 to-[#0f0800]',
    glow: 'rgba(249,115,22,0.35)',
    accent: '#FB923C', accentDark: '#7c2d12',
    reward: 600, emblem: '🥉 브론즈 엠블럼 (7일)',
    canvasBg: ['#431407','#7c2d12','#0f0f0f'],
  },
}
const TOP10_CFG = {
  medal: '🎖️', title: 'TOP 10 CHALLENGER',
  bg:   'from-violet-950 via-purple-900 to-[#050010]',
  glow: 'rgba(139,92,246,0.35)',
  accent: '#A78BFA', accentDark: '#4c1d95',
  reward: 500, emblem: '🏅 TOP 10 엠블럼 (7일)',
  canvasBg: ['#2e1065','#4c1d95','#0a0010'],
}

function getRankCfg(rank) {
  return RANK_CFG[rank] || TOP10_CFG
}

// ── 기간 레이블 ──────────────────────────────────────────────────────
function getPeriodLabel(period) {
  const now   = new Date()
  const month = now.getMonth() + 1
  const week  = Math.ceil(now.getDate() / 7)
  if (period === 'weekly')  return `${month}월 ${week}주차`
  if (period === 'monthly') return `${month}월`
  return '전체'
}

// ── 백분위 ───────────────────────────────────────────────────────────
function getPercentile(rank) {
  if (rank === 1)  return '상위 0.01%'
  if (rank <= 3)   return '상위 0.05%'
  if (rank <= 5)   return '상위 0.1%'
  return '상위 0.5%'
}

// ── 파티클 컴포넌트 ──────────────────────────────────────────────────
const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  left: `${(i * 13 + 7) % 100}%`,
  delay: `${(i * 0.18) % 2.5}s`,
  dur:   `${2.2 + (i % 4) * 0.4}s`,
  size:  `${5 + (i % 5) * 3}px`,
  color: ['#FCD34D','#A78BFA','#6EE7B7','#F9A8D4','#93C5FD','#FB923C'][i % 6],
}))

function Particles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {PARTICLES.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-sm opacity-0"
          style={{
            left: p.left,
            width: p.size, height: p.size,
            background: p.color,
            animation: `confetti-fall ${p.dur} ${p.delay} ease-in infinite`,
          }}
        />
      ))}
    </div>
  )
}

// ── 메인 모달 ────────────────────────────────────────────────────────
export function RankingCelebrationModal({
  rank, nickname, avatar_url, points,
  period = 'weekly', top1 = null, profile = null,
  onClose,
}) {
  const cfg        = getRankCfg(rank)
  const lvl        = getLevel(points || 0)
  const gap        = top1 ? Math.max(0, (top1.points || 0) - (points || 0)) : null
  const periodLabel = getPeriodLabel(period)
  const [saving,     setSaving]     = useState(false)
  const [showEditor, setShowEditor] = useState(false)

  // ESC 닫기
  useEffect(() => {
    const fn = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  // ── 캔버스 공유 카드 생성 (9:16) ────────────────────────────────
  const generateCard = useCallback(async () => {
    setSaving(true)
    try {
      const W = 400, H = 711
      const canvas = document.createElement('canvas')
      canvas.width  = W
      canvas.height = H
      const ctx = canvas.getContext('2d')

      // 배경 그라데이션
      const grad = ctx.createLinearGradient(0, 0, W, H)
      const [c0, c1, c2] = cfg.canvasBg
      grad.addColorStop(0,   c0)
      grad.addColorStop(0.5, c1)
      grad.addColorStop(1,   c2)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)

      // 장식 원들
      const drawCircle = (x, y, r, alpha) => {
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${alpha})`
        ctx.fill()
      }
      drawCircle(360, 80,  120, 0.04)
      drawCircle(40,  620, 150, 0.03)
      drawCircle(200, 380, 200, 0.02)

      // 반짝이 점들
      for (let i = 0; i < 18; i++) {
        const x   = (i * 53 + 30) % W
        const y   = (i * 79 + 50) % H
        const rad = 1 + (i % 3)
        ctx.beginPath()
        ctx.arc(x, y, rad, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${0.1 + (i % 4) * 0.05})`
        ctx.fill()
      }

      // 상단 구분선
      const lineGrad = ctx.createLinearGradient(60, 0, W - 60, 0)
      lineGrad.addColorStop(0, 'transparent')
      lineGrad.addColorStop(0.5, cfg.accent)
      lineGrad.addColorStop(1, 'transparent')
      ctx.strokeStyle = lineGrad
      ctx.lineWidth   = 1
      ctx.beginPath(); ctx.moveTo(60, 90); ctx.lineTo(W - 60, 90); ctx.stroke()

      // VICS 로고
      ctx.font      = 'bold 20px sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.textAlign = 'center'
      ctx.fillText('✦ VICS ✦', W / 2, 65)

      // 기간 레이블
      ctx.font      = '13px sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.fillText(periodLabel + ' 랭킹', W / 2, 115)

      // 메달 이모지
      ctx.font      = '72px sans-serif'
      ctx.fillText(cfg.medal, W / 2, 220)

      // 순위
      ctx.font      = 'bold 68px sans-serif'
      ctx.fillStyle = cfg.accent
      ctx.fillText(`#${rank}`, W / 2, 310)

      // 타이틀
      ctx.font      = 'bold 15px sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.fillText(cfg.title, W / 2, 345)

      // 구분선
      const lineGrad2 = ctx.createLinearGradient(80, 0, W - 80, 0)
      lineGrad2.addColorStop(0, 'transparent')
      lineGrad2.addColorStop(0.5, 'rgba(255,255,255,0.15)')
      lineGrad2.addColorStop(1, 'transparent')
      ctx.strokeStyle = lineGrad2
      ctx.lineWidth   = 1
      ctx.beginPath(); ctx.moveTo(80, 370); ctx.lineTo(W - 80, 370); ctx.stroke()

      // 아바타 원
      const AX = W / 2, AY = 440, AR = 48
      ctx.beginPath()
      ctx.arc(AX, AY, AR + 3, 0, Math.PI * 2)
      ctx.strokeStyle = cfg.accent
      ctx.lineWidth   = 2
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(AX, AY, AR, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.1)'
      ctx.fill()

      // 아바타 이니셜
      ctx.font      = `bold ${AR}px sans-serif`
      ctx.fillStyle = cfg.accent
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText((nickname?.[0] || '?').toUpperCase(), AX, AY)
      ctx.textBaseline = 'alphabetic'

      // 닉네임
      ctx.font      = 'bold 24px sans-serif'
      ctx.fillStyle = '#ffffff'
      ctx.fillText(nickname || '익명', W / 2, 515)

      // 백분위
      ctx.font      = 'bold 13px sans-serif'
      ctx.fillStyle = cfg.accent
      ctx.fillText(getPercentile(rank) + '의 안목', W / 2, 545)

      // 포인트
      ctx.font      = '14px sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.fillText(`${formatNumber(points || 0)} P`, W / 2, 580)

      // 하단 구분선
      ctx.strokeStyle = lineGrad2
      ctx.lineWidth   = 1
      ctx.beginPath(); ctx.moveTo(80, 600); ctx.lineTo(W - 80, 600); ctx.stroke()

      // 푸터
      ctx.font      = '11px sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.fillText('© 2026 VICTORYSPACE · vics.app', W / 2, 690)

      // 다운로드
      const link        = document.createElement('a')
      link.download     = `VICS_TOP${rank}_${nickname || 'ranker'}.png`
      link.href         = canvas.toDataURL('image/png')
      link.click()
    } finally {
      setSaving(false)
    }
  }, [rank, nickname, points, period, cfg, periodLabel])

  return (
    <>
      {/* confetti keyframe (인라인 주입) */}
      <style>{`
        @keyframes confetti-fall {
          0%   { opacity: 0; transform: translateY(-20px) rotate(0deg); }
          10%  { opacity: 1; }
          90%  { opacity: 0.7; }
          100% { opacity: 0; transform: translateY(110vh) rotate(720deg); }
        }
        @keyframes celebrate-pop {
          0%   { opacity: 0; transform: scale(0.7) translateY(30px); }
          70%  { transform: scale(1.04) translateY(-4px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 40px var(--glow-color, rgba(139,92,246,0.3)); }
          50%       { box-shadow: 0 0 80px var(--glow-color, rgba(139,92,246,0.5)); }
        }
        @keyframes shimmer-slide {
          0%   { transform: translateX(-100%) skewX(-15deg); }
          100% { transform: translateX(300%) skewX(-15deg); }
        }
      `}</style>

      {/* 오버레이 */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <Particles />

        {/* 카드 본체 — 최대 높이 + 내부 스크롤 */}
        <div
          className={`relative w-full max-w-sm rounded-3xl bg-gradient-to-b ${cfg.bg} flex flex-col`}
          style={{
            maxHeight: 'calc(100dvh - 24px)',
            animation: 'celebrate-pop 0.55s cubic-bezier(0.16,1,0.3,1) both',
            '--glow-color': cfg.glow,
            animationName: 'celebrate-pop, glow-pulse',
            animationDuration: '0.55s, 3s',
            animationDelay: '0s, 0.6s',
            animationTimingFunction: 'cubic-bezier(0.16,1,0.3,1), ease-in-out',
            animationFillMode: 'both, none',
            animationIterationCount: '1, infinite',
          }}
        >
          {/* 상단 shimmer 라인 */}
          <div className="absolute top-0 left-0 right-0 h-px overflow-hidden rounded-t-3xl pointer-events-none">
            <div className="h-full w-1/3"
              style={{
                background: `linear-gradient(90deg, transparent, ${cfg.accent}, transparent)`,
                animation: 'shimmer-slide 2.5s ease-in-out 0.5s infinite',
              }}
            />
          </div>

          {/* 닫기 버튼 */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X size={16} className="text-white/70" />
          </button>

          {/* 스크롤 가능한 콘텐츠 영역 */}
          <div className="overflow-y-auto overscroll-contain" style={{ borderRadius: 'inherit' }}>
          <div className="px-5 pt-7 pb-5 flex flex-col items-center gap-0">

            {/* 타이틀 */}
            <p className="text-[10px] font-black tracking-[0.2em] uppercase text-white/40 mb-1">
              ✦ {periodLabel} 랭킹 결과 ✦
            </p>
            <div className="flex items-center gap-1.5 mb-3">
              <Sparkles size={13} style={{ color: cfg.accent }} />
              <p className="font-black text-base text-white">GOOD JOB!</p>
              <Sparkles size={13} style={{ color: cfg.accent }} />
            </div>

            {/* 메달 + 순위 */}
            <div className="relative mb-2 flex flex-col items-center">
              <span className="text-5xl drop-shadow-lg">{cfg.medal}</span>
              <div className="mt-1.5 px-3 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase"
                style={{ background: `${cfg.accent}22`, color: cfg.accent, border: `1px solid ${cfg.accent}44` }}>
                {cfg.title}
              </div>
            </div>

            {/* 아바타 */}
            <div className="relative mb-2">
              <div className="w-16 h-16 rounded-full overflow-hidden ring-[3px]"
                style={{ ringColor: cfg.accent, boxShadow: `0 0 0 3px ${cfg.accent}` }}>
                {avatar_url
                  ? <img src={avatar_url} alt={nickname} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"
                      style={{ background: `${cfg.accentDark}` }}>
                      <span className="text-2xl font-black text-white">{nickname?.[0]?.toUpperCase()}</span>
                    </div>
                }
              </div>
              {/* 레벨 배지 */}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#0f0f0f] flex items-center justify-center text-xs">
                {lvl.emoji}
              </div>
            </div>

            {/* 닉네임 */}
            <p className="text-lg font-black text-white mb-0.5">{nickname}</p>
            <p className="text-xs text-white/40 mb-3">{lvl.emoji} {lvl.name}</p>

            {/* 순위 + 백분위 */}
            <div className="w-full rounded-2xl mb-2.5 px-4 py-3 text-center relative overflow-hidden"
              style={{ background: `${cfg.accentDark}60`, border: `1px solid ${cfg.accent}30` }}>
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute h-full w-8 opacity-20"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${cfg.accent}, transparent)`,
                    animation: 'shimmer-slide 3s ease-in-out 1s infinite',
                  }} />
              </div>
              <p className="text-2xl font-black mb-0.5" style={{ color: cfg.accent }}>
                {periodLabel} <span style={{ fontSize: '2rem' }}>{rank}</span>위
              </p>
              <p className="text-xs font-bold text-white/60">
                {getPercentile(rank)}의 놀라운 안목이에요! 👏
              </p>
            </div>

            {/* 획득 보상 */}
            <div className="w-full rounded-2xl px-4 py-3 mb-2.5"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">획득 보상</p>
              <div className="flex items-center gap-2">
                <span className="text-base">💎</span>
                <p className="text-sm font-black text-white">{formatNumber(cfg.reward)} P 지급 완료</p>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-base">{cfg.emblem.split(' ')[0]}</span>
                <p className="text-sm font-black" style={{ color: cfg.accent }}>
                  {cfg.emblem.split(' ').slice(1).join(' ')}
                </p>
              </div>
            </div>

            {/* 1위와의 격차 */}
            {gap !== null && gap > 0 && (
              <div className="w-full rounded-2xl px-4 py-2.5 mb-2.5 text-center"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] font-bold text-white/30">1위와의 격차</p>
                <p className="text-sm text-white/80">
                  1위{top1?.nickname ? ` '${top1.nickname}'님` : ''}과
                  단 <span className="font-black text-orange-400">{formatNumber(gap)}P</span> 차이! 🔥
                </p>
              </div>
            )}
            {gap === 0 && (
              <div className="w-full rounded-2xl px-4 py-2.5 mb-2.5 text-center"
                style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                <p className="text-sm font-black text-amber-400">🏆 당신이 이번 시즌 챔피언!</p>
              </div>
            )}

            {/* 카드 편집 & 저장 버튼 */}
            <button
              onClick={() => setShowEditor(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm mb-2 transition-all active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${cfg.accentDark}, ${cfg.accent})`,
                color: rank <= 3 ? '#0f0f0f' : '#ffffff',
                boxShadow: `0 4px 20px ${cfg.glow}`,
              }}
            >
              <Palette size={15} />
              📸 랭킹 카드 편집 &amp; 저장하기
            </button>

            {/* 다음 시즌 도전 버튼 */}
            <Link
              to="/matchups"
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm text-white/80 transition-all active:scale-95 hover:bg-white/10"
              style={{ border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <Flame size={15} className="text-orange-400" />
              다음 시즌 1위 도전하기
              <ChevronRight size={13} />
            </Link>

          </div>
          </div>{/* /overflow-y-auto */}
        </div>
      </div>

      {/* 카드 편집기 */}
      {showEditor && (
        <RankingCardEditor
          rank={rank}
          nickname={nickname}
          avatar_url={avatar_url}
          points={points}
          period={period}
          profile={profile}
          onClose={() => setShowEditor(false)}
        />
      )}
    </>
  )
}
