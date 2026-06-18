import { createElement, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  ChevronLeft,
  Flame,
  Gem,
  MoonStar,
  Palette,
  Share2,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { cn } from '../lib/utils'
import { isLegendDiamondShellActive } from '../lib/legendDiamondUiTheme'
import { LAYOUT_CONTENT_MAX_WIDTH_CLASS } from '../lib/layoutShellClasses'
import { BANNER_HIGHLIGHT_COST } from '../lib/bannerHighlightBoost'
import { isRankingBadgeActive, getRankingBadgeDays, getRankingBadgeRemainingDays } from '../lib/rankingBadge'

const PAGE_BG = 'bg-gradient-to-br from-amber-50/90 via-fuchsia-50/35 to-violet-50/50'
const HEADER_GLASS =
  'bg-gradient-to-b from-white/90 via-rose-50/40 to-fuchsia-50/20 backdrop-blur-md border-b border-pink-100/55'

function formatPoints(n) {
  return Number(n || 0).toLocaleString('ko-KR')
}

function RewardCard({ title, subtitle, priceLabel, icon, barColor = 'from-fuchsia-400 via-pink-400 to-rose-400', footnote, footnoteHighlight }) {
  return (
    <div className="flex flex-col rounded-2xl overflow-hidden border border-pink-100/70 bg-white/95 shadow-[0_4px_22px_-10px_rgba(244,114,182,0.2)] backdrop-blur-[1px] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_32px_-10px_rgba(192,38,211,0.25)] hover:border-fuchsia-200/70 h-full">
      <div className={`h-0.5 bg-gradient-to-r ${barColor}`} />
      <div className="flex flex-col flex-1 p-5">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-100 to-pink-100 shadow-inner ring-1 ring-pink-100/80">
          {createElement(icon, { className: 'h-5 w-5 text-fuchsia-700', strokeWidth: 2.2 })}
        </div>
        <h3 className="text-sm font-black text-fuchsia-950 sm:text-base">{title}</h3>
        <p className="mt-1.5 flex-1 text-xs leading-relaxed text-fuchsia-900/65">{subtitle}</p>
        {footnote && (
          <p className={cn(
            'mt-2 max-w-full leading-snug',
            footnoteHighlight
              ? 'inline-flex w-fit items-center rounded-lg border border-orange-300/80 bg-gradient-to-r from-amber-100 via-orange-50 to-amber-50 px-2.5 py-1.5 text-xs font-black text-orange-900 shadow-sm'
              : 'text-[11px] font-medium text-violet-700/75',
          )}>
            {footnote}
          </p>
        )}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-pink-100/50 pt-3">
          <span className="text-xs font-bold text-fuchsia-500/70">포인트</span>
          <span className="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 bg-clip-text text-base font-black text-transparent tabular-nums">
            {priceLabel}
          </span>
        </div>
      </div>
    </div>
  )
}

export function PointRewardsPage() {
  const navigate = useNavigate()
  const { user, profile, updateProfile, fetchProfile } = useAuthStore()
  const { openLoginModal, showToast } = useUIStore()
  const points = profile?.points ?? 0
  const [legendThemeBusy, setLegendThemeBusy] = useState(false)
  const isDiamondTier = profile?.fandom_tier === 'diamond'
  const legendShellOn = Boolean(user && isLegendDiamondShellActive(profile))

  const toggleLegendDiamondShell = async () => {
    if (!user || !isDiamondTier || legendThemeBusy) return
    setLegendThemeBusy(true)
    try {
      const nextDisabled = legendShellOn
      const { error } = await updateProfile({ legend_diamond_theme_disabled: nextDisabled })
      if (error) {
        showToast(error.message || '저장에 실패했어요', 'error')
        return
      }
      await fetchProfile(user.id, { force: true })
      showToast(
        nextDisabled ? '기본(라이트) 화면으로 바꿨어요.' : '레전더리 다크 다이아몬드 테마를 켰어요 💎',
        'success',
      )
      window.dispatchEvent(new CustomEvent('vics:profile:updated'))
    } finally {
      setLegendThemeBusy(false)
    }
  }

  return (
    <div className={cn('min-h-screen relative overflow-hidden pb-12', PAGE_BG)}>
      {/* 앰비언트 배경 */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[radial-gradient(circle,_rgba(251,191,36,0.13)_0%,_transparent_70%)] blur-3xl" />
        <div className="absolute top-1/3 -right-24 w-72 h-72 rounded-full bg-[radial-gradient(circle,_rgba(192,38,211,0.13)_0%,_transparent_70%)] blur-3xl" />
        <div className="absolute bottom-24 left-1/4 w-64 h-64 rounded-full bg-[radial-gradient(circle,_rgba(139,92,246,0.10)_0%,_transparent_70%)] blur-3xl" />
      </div>

      <div className={cn(LAYOUT_CONTENT_MAX_WIDTH_CLASS, 'mx-auto relative z-10')}>
        {/* 스티키 헤더 */}
        <div className={cn('sticky top-0 z-10 px-4 py-3 flex items-center gap-2.5', HEADER_GLASS)}>
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
            className="flex items-center gap-1 pl-2 pr-3 py-2 -ml-1 rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200/60 hover:from-amber-100 hover:to-yellow-100 transition-all shrink-0 shadow-sm"
          >
            <ChevronLeft size={16} className="text-amber-700" />
            <span className="text-xs font-bold text-amber-700">뒤로</span>
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 shadow-md shadow-amber-300/40">
              <Gem size={13} className="text-white" />
            </span>
            <h1 className="text-base font-black bg-gradient-to-r from-amber-600 via-fuchsia-600 to-violet-700 bg-clip-text text-transparent tracking-tight truncate">
              Victory Rewards
            </h1>
          </div>
        </div>

        <div className="px-4 py-5 space-y-7">

          {/* 히어로 카드 */}
          <div className="rounded-2xl overflow-hidden border border-amber-200/60 bg-white/90 shadow-[0_4px_28px_-10px_rgba(217,119,6,0.18)] backdrop-blur-sm">
            <div className="h-1.5 bg-gradient-to-r from-amber-500 via-fuchsia-500 to-violet-600" />
            <div className="px-6 py-6 text-center">
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-1 text-xs font-black text-amber-800 shadow-sm">
                <Gem size={13} className="text-amber-500" />
                Point Reward Center
              </p>
              <h2 className="bg-gradient-to-r from-amber-600 via-fuchsia-600 to-violet-700 bg-clip-text text-2xl font-black tracking-tight text-transparent sm:text-3xl mt-1">
                Victory Rewards
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-relaxed text-fuchsia-900/60">
                승리의 가치를 높이는 특별한 아이템을 만나보세요.
              </p>
              <div className="mx-auto mt-4 flex flex-wrap items-center justify-center gap-3">
                <div className="rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50 to-yellow-50/90 px-5 py-2.5 shadow-sm text-sm font-black tabular-nums">
                  <span className="text-amber-800/80">보유 포인트</span>{' '}
                  <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                    {user ? `${formatPoints(points)} P` : '로그인 후 확인'}
                  </span>
                </div>
                {!user && (
                  <button
                    type="button"
                    onClick={() => openLoginModal()}
                    className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 py-2 text-xs font-black text-white shadow-md hover:scale-[1.02] transition-all"
                  >
                    로그인
                  </button>
                )}
              </div>
              {user && isRankingBadgeActive(profile) && (
                <div className="mx-auto mt-4 flex max-w-sm items-center gap-3 rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50 to-yellow-50/90 px-4 py-3 shadow-sm">
                  <div className="relative shrink-0 flex items-center justify-center w-9 h-9">
                    <span className="text-2xl leading-none">🏅</span>
                    <span
                      className="absolute inset-0 flex items-center justify-center font-black"
                      style={{ fontSize: '9px', color: '#111', WebkitTextStroke: '2px #fff', paintOrder: 'stroke fill', textShadow: '0 0 4px rgba(255,255,255,0.9)' }}
                    >
                      {profile.ranking_badge_rank}위
                    </span>
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-black text-amber-800">
                      TOP 10 기념 배지 ({getRankingBadgeDays(profile.ranking_badge_rank)}일) 이용 중
                    </p>
                    <p className="text-[11px] text-amber-600/75 mt-0.5">
                      {profile.ranking_badge_rank}위 달성 · 만료까지 {getRankingBadgeRemainingDays(profile)}일 남음
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Boost ──────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-start gap-3 mb-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 shadow-md mt-0.5">
                <Flame size={17} className="text-white" />
              </span>
              <div>
                <h2 className="text-base font-black bg-gradient-to-r from-orange-600 to-rose-600 bg-clip-text text-transparent sm:text-lg">
                  내 매치업 홍보 (Boost)
                </h2>
                <p className="text-xs font-medium text-fuchsia-800/55 mt-0.5">
                  메인에서 내 경쟁을 더 눈에 띄게 — 스포트라이트 · 주목 · 배너 강조
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Link to="/rewards/main-spotlight" className="block rounded-2xl focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2">
                <RewardCard
                  title="메인 스포트라이트 6h"
                  subtitle="메인 최상단 강제 노출로 누가 봐도 내 경쟁이 핫함을 과시"
                  priceLabel="5,000 P"
                  icon={Zap}
                  barColor="from-orange-400 via-rose-400 to-fuchsia-400"
                />
              </Link>
              <RewardCard
                title="주목할 매치업 등록"
                subtitle="'주목' 섹션 리스트업으로 꾸준한 노출"
                priceLabel="2,500 P"
                icon={TrendingUp}
                barColor="from-fuchsia-400 via-pink-400 to-rose-400"
                footnote="준비 예정"
                footnoteHighlight
              />
              <Link to="/rewards/banner-highlight" className="block rounded-2xl focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2">
                <RewardCard
                  title="배너 강조 효과"
                  subtitle="카드 테두리 네온 효과로 피드 속 시선 집중"
                  priceLabel={`${formatPoints(BANNER_HIGHLIGHT_COST)} P`}
                  icon={Sparkles}
                  barColor="from-violet-400 via-fuchsia-400 to-pink-400"
                />
              </Link>
            </div>
          </section>

          {/* ── Data ───────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-start gap-3 mb-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-md mt-0.5">
                <BarChart3 size={17} className="text-white" />
              </span>
              <div>
                <h2 className="text-base font-black bg-gradient-to-r from-sky-600 to-blue-700 bg-clip-text text-transparent sm:text-lg">
                  데이터 & 인사이트 (Data)
                </h2>
                <p className="text-xs font-medium text-fuchsia-800/55 mt-0.5">
                  통계·리포트로 다음 한 수를 준비하세요
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link to="/rewards/v-card" className="block rounded-2xl focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2">
                <RewardCard
                  title="승리 요약 리포트"
                  subtitle="공유용 고퀄 그래픽 카드 — 인스타 스토리 비율(1080×1920) 템플릿 · 테마 선택 후 PNG 저장"
                  priceLabel="1,500 P"
                  icon={Share2}
                  barColor="from-sky-400 via-blue-400 to-indigo-400"
                  footnote="VictorySpace 전용 디자인에 기록이 합성된 이미지로 SNS 공유"
                />
              </Link>
              <Link to="/rewards/vote-stats" className="block rounded-2xl focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2">
                <RewardCard
                  title="투표 통계 열람권"
                  subtitle='성별·연령대 등 투표 분석 — "이 경쟁은 누가 더 좋아했지?" 확인'
                  priceLabel="800 P"
                  icon={Users}
                  barColor="from-teal-400 via-cyan-400 to-emerald-400"
                />
              </Link>
            </div>
          </section>

          {/* ── Style ──────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-start gap-3 mb-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-md mt-0.5">
                <Palette size={17} className="text-white" />
              </span>
              <div>
                <h2 className="text-base font-black bg-gradient-to-r from-violet-600 to-fuchsia-700 bg-clip-text text-transparent sm:text-lg">
                  프로필 & 스타일 (Style)
                </h2>
                <p className="text-xs font-medium text-fuchsia-800/55 mt-0.5">
                  티어·프로필·테마로 나만의 색을 입히기
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <RewardCard
                title="티어 전용 이모지"
                subtitle="랭킹에 표시될 특수 아이콘 — 희귀 이모지로 랭커 입증"
                priceLabel="300 P"
                icon={Sparkles}
                barColor="from-amber-400 via-yellow-400 to-orange-400"
                footnote="준비 예정"
                footnoteHighlight
              />
              <Link to="/rewards/profile-public" className="block rounded-2xl focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2">
                <RewardCard
                  title="프로필 공개 권한"
                  subtitle="닫혀 있던 내 프로필을 포인트로 공개 — 신비주의 후 팬덤 형성"
                  priceLabel="2,000 P"
                  icon={Users}
                  barColor="from-pink-400 via-rose-400 to-fuchsia-400"
                  footnote="구매 후 V-Card View Full Profile 활성화"
                />
              </Link>
              <Link to="/rewards/neon-profile-theme" className="block rounded-2xl focus-visible:ring-2 focus-visible:ring-fuchsia-400 focus-visible:ring-offset-2">
                <RewardCard
                  title="네온 프로필 테마"
                  subtitle="프로필 배경·포인트 컬러 커스텀 — 상징색을 팬에게 각인"
                  priceLabel="3,500 P"
                  icon={Palette}
                  barColor="from-fuchsia-400 via-violet-400 to-indigo-400"
                  footnote="결제일부터 4개월간 테마 전환 무료 · 만료 후 재구매"
                />
              </Link>
              {user && isDiamondTier && (
                <div className="flex flex-col rounded-2xl overflow-hidden border border-cyan-300/50 bg-white/95 shadow-[0_8px_32px_-10px_rgba(34,211,238,0.25)] backdrop-blur-[1px] transition-all hover:-translate-y-0.5">
                  <div className="h-0.5 bg-gradient-to-r from-slate-700 via-cyan-400 to-indigo-600" />
                  <div className="flex flex-col flex-1 p-5">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-indigo-950 shadow-inner ring-1 ring-cyan-400/30">
                      <MoonStar className="h-5 w-5 text-cyan-200" strokeWidth={2.2} />
                    </div>
                    <h3 className="text-sm font-black text-slate-900 sm:text-base">레전더리 다크 다이아몬드 UI</h3>
                    <p className="mt-1.5 flex-1 text-xs leading-relaxed text-slate-600">
                      다이아 팬덤 등급 전용 — 앱 셸 배경·상단 헤더·모바일 하단 메뉴를 다크 다이아 톤으로 맞춥니다. 본문 페이지는 기존 그대로 두어 가독성을 유지해요.
                    </p>
                    <div className="mt-4 flex flex-col gap-3 border-t border-cyan-100/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-black text-cyan-900">
                          상태: {legendShellOn ? '켜짐 · 레전드 셸 적용 중' : '꺼짐 · 기본 화면'}
                        </p>
                        <p className="mt-1 text-[10px] font-medium text-slate-500">
                          포인트 차감 없음 · 언제든 다시 켤 수 있어요
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={legendThemeBusy}
                        onClick={() => void toggleLegendDiamondShell()}
                        className={cn(
                          'shrink-0 rounded-xl px-4 py-2.5 text-xs font-black transition disabled:opacity-50',
                          legendShellOn
                            ? 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                            : 'border border-cyan-400/60 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-cyan-100 shadow-md hover:brightness-110',
                        )}
                      >
                        {legendThemeBusy ? '저장 중…' : legendShellOn ? '기본 화면으로' : '레전드 테마 켜기'}
                      </button>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-cyan-100/60 pt-3">
                      <span className="text-xs font-bold text-cyan-700/70">포인트</span>
                      <span className="text-sm font-black tabular-nums text-cyan-800">전용 특전 (0 P)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 하단 네비 */}
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link
              to="/ranking"
              className="inline-flex items-center gap-1.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-600 to-rose-500 text-white font-black shadow-[0_4px_18px_-4px_rgba(192,38,211,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              랭킹으로
            </Link>
            <Link
              to="/matchups"
              className="inline-flex items-center gap-1.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white font-black shadow-[0_4px_18px_-4px_rgba(16,185,129,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              매치업 피드
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
