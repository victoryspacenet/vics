import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Trophy, Download, Share2, Trash2, X, SortDesc, Crown, Sparkles, Loader2 } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { fetchGallery, deleteFromGallery, markAllSeen, getBestCard, getGalleryDrawOpts, RANKING_GALLERY_UPDATED } from '../lib/galleryUtils'
import { drawCard, getPercentile, getMatchupTierDisplay, formatSavedDate, CARD_W, CARD_H } from '../lib/cardDraw'
import { resolveGalleryCardImageUrl } from '../lib/sanitize'
import { shareRankingGallery } from '../lib/socialShare'
import { cn } from '../lib/utils'

const PAGE_BG =
  'bg-gradient-to-br from-rose-50/98 via-fuchsia-50/35 to-cyan-50/50 min-h-screen'
const HEADER_GLASS =
  'sticky top-0 z-30 bg-gradient-to-b from-white/90 via-rose-50/40 to-fuchsia-50/20 backdrop-blur-md border-b border-pink-100/55'

// ── 기간 한글 레이블 ────────────────────────────────────────────────
function periodLabel(p) {
  if (p === 'weekly')  return '주간'
  if (p === 'monthly') return '월간'
  return '전체'
}

// ── 갤러리 카드 미리보기 (data URL 썸네일 · 캔버스 폴백) ─────────────────
function GalleryCardPreview({ card, className, style, imgClassName }) {
  const canvasRef = useRef(null)
  const imageUrl = resolveGalleryCardImageUrl(card?.thumbnail)
  const canDraw = Boolean(getGalleryDrawOpts(card))

  useEffect(() => {
    if (imageUrl || !canvasRef.current || !canDraw) return
    const opts = getGalleryDrawOpts(card)
    if (!opts) return
    drawCard(canvasRef.current, opts)
  }, [imageUrl, card, canDraw])

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={card?.rank ? `${card.rank}위 랭킹 카드` : '랭킹 카드'}
        className={imgClassName}
        style={style}
      />
    )
  }

  if (!canDraw) {
    return (
      <div className={className} style={style}>
        <span className="text-3xl">🏆</span>
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      width={180}
      height={320}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block', ...style }}
    />
  )
}

// ── 미니 카드 캔버스 썸네일 ──────────────────────────────────────────
function CardThumbnail({ card, onClick }) {
  const tier = getMatchupTierDisplay(card.matchupTierId)
  const imageUrl = resolveGalleryCardImageUrl(card.thumbnail)

  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative', border: 'none', padding: 0, cursor: 'pointer',
        borderRadius: 14, overflow: 'hidden',
        background: '#1a1a2e',
        boxShadow: card.isNew
          ? `0 0 0 2px ${tier.color}, 0 4px 20px ${tier.color}55`
          : '0 2px 12px rgba(0,0,0,0.4)',
        transition: 'transform 0.15s, box-shadow 0.15s',
        width: '100%',
        aspectRatio: '9/16',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      {imageUrl || getGalleryDrawOpts(card) ? (
        <GalleryCardPreview
          card={card}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          imgClassName="h-full w-full object-cover"
        />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          background: 'linear-gradient(135deg, #0f0f20, #1a1a35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 6,
        }}>
          <span style={{ fontSize: 32 }}>{tier.emoji}</span>
          <p style={{ color: tier.color, fontWeight: 900, fontSize: 13, margin: 0 }}>{tier.name}</p>
        </div>
      )}

      {/* NEW 배지 */}
      {card.isNew && (
        <div style={{
          position: 'absolute', top: 7, left: 7,
          padding: '2px 7px', borderRadius: 8,
          background: tier.color, color: '#0f0f0f',
          fontSize: 9, fontWeight: 900,
        }}>NEW</div>
      )}

      {/* 하단 오버레이 */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
        padding: '20px 8px 8px',
      }}>
        <p style={{ color: tier.color, fontSize: 10, fontWeight: 900, margin: '0 0 1px' }}>
          {tier.emoji} {tier.name}
        </p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, margin: 0 }}>
          {formatSavedDate(card.savedAt)} · {periodLabel(card.period)}
        </p>
      </div>
    </button>
  )
}

// ── 카드 상세 모달 ───────────────────────────────────────────────────
function CardDetailModal({ card, onClose, onDelete }) {
  const { showToast } = useUIStore()
  const avatarRef  = useRef(null)
  const [showDeletePopup, setShowDeletePopup] = useState(false)
  const [saving,   setSaving]     = useState(false)
  const [sharing,  setSharing]    = useState(false)
  const tier = getMatchupTierDisplay(card.matchupTierId)

  useEffect(() => {
    const fn = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  // ── 다시 저장 (고화질) ────────────────────────────────────────────
  const handleReDownload = async () => {
    setSaving(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = CARD_W; canvas.height = CARD_H
      drawCard(canvas, {
        rank: card.rank, nickname: card.nickname,
        points: card.points, period: card.period, themeId: card.themeId,
        showNickname: card.showNickname, showPoints: card.showPoints, showRank: card.showRank,
        avatarImg: avatarRef.current,
      })
      const link = document.createElement('a')
      link.download = `VICS_TOP${card.rank}_${card.nickname || 'ranker'}_1080x1920.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } finally {
      setSaving(false)
    }
  }

  // ── 공유 (링크 카드 — URL 복사/공유, 카카오 SDK 미사용) ─────────────
  const handleShare = async () => {
    if (sharing) return
    setSharing(true)
    try {
      await shareRankingGallery({
        nickname: card.nickname,
        rank: card.rank,
        tierName: tier.name,
        cardId: card.id,
        showToast,
      })
    } finally {
      setSharing(false)
    }
  }

  return (
    <>
      <style>{`
        @keyframes detail-in {
          from { opacity:0; transform:scale(0.96) translateY(8px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
      `}</style>
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-gradient-to-br from-fuchsia-950/55 via-purple-950/45 to-rose-950/50 backdrop-blur-md"
      >
        <div
          className={cn(
            'w-full max-w-[420px] max-h-[92dvh] flex flex-col overflow-hidden rounded-[1.35rem]',
            'border-2 border-pink-200/90 bg-gradient-to-br from-rose-50/98 via-fuchsia-50/95 to-cyan-50/90',
            'shadow-[0_0_0_1px_rgba(244,114,182,0.12),0_28px_56px_-16px_rgba(236,72,153,0.35),0_12px_32px_-8px_rgba(34,211,238,0.15)]',
            'animate-[detail-in_0.28s_ease_both]',
          )}
        >
          {/* 헤더: 티어 컬러 그라데이션 스트립 */}
          <div
            className="relative flex shrink-0 items-center justify-between gap-3 px-4 py-3.5"
            style={{
              background: `linear-gradient(135deg, ${tier.color}35 0%, rgba(255,255,255,0.92) 45%, rgba(236,254,255,0.95) 100%)`,
              borderBottom: `1px solid ${tier.color}40`,
            }}
          >
            <div className="min-w-0 text-left">
              <p className="mb-0.5 flex items-center gap-1.5 text-[15px] font-black tracking-tight text-fuchsia-950">
                <span className="text-lg leading-none">{tier.emoji}</span>
                <span
                  className="bg-gradient-to-r from-fuchsia-700 via-violet-700 to-cyan-700 bg-clip-text text-transparent"
                >
                  {tier.name}
                </span>
              </p>
              <p className="text-[11px] font-semibold text-fuchsia-800/55">
                {formatSavedDate(card.savedAt)} · {periodLabel(card.period)} 랭킹
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-pink-200/80 bg-white/90 text-fuchsia-900/50 shadow-sm transition hover:scale-105 hover:bg-white hover:text-fuchsia-900"
            >
              <X size={16} strokeWidth={2.25} />
            </button>
          </div>

          {/* 스크롤 본문 */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
            {/* 카드 미리보기 */}
            <div className="flex shrink-0 justify-center bg-gradient-to-b from-fuchsia-100/40 via-white/50 to-cyan-50/40 px-4 py-5">
              <div
                className="w-[140px] overflow-hidden rounded-2xl shadow-lg ring-2 ring-white"
                style={{
                  aspectRatio: '9/16',
                  boxShadow: `0 0 0 3px ${tier.color}55, 0 16px 40px -8px ${tier.color}44`,
                }}
              >
                <GalleryCardPreview
                  card={card}
                  className="h-full w-full"
                  imgClassName="h-full w-full object-cover"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 px-4 pb-5 pt-1">
              {/* 스탯 */}
              <div className="grid grid-cols-3 gap-2 rounded-2xl border border-pink-100/80 bg-white/85 p-3 shadow-sm shadow-pink-100/30 backdrop-blur-sm">
                {[
                  { label: '순위', value: `#${card.rank}`, valueStyle: { color: tier.color } },
                  { label: '백분위', value: getPercentile(card.rank), valueStyle: { color: '#5b21b6' } },
                  { label: '포인트', value: `${(card.points || 0).toLocaleString()}P`, valueStyle: { color: '#0d9488' } },
                ].map((row) => (
                  <div key={row.label} className="text-center">
                    <p className="mb-1 text-[9px] font-black uppercase tracking-[0.12em] text-fuchsia-900/40">
                      {row.label}
                    </p>
                    <p className="text-[13px] font-black leading-tight" style={row.valueStyle}>
                      {row.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReDownload}
                  disabled={saving}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 border-emerald-200/90 bg-white/95 py-3 text-[12px] font-black text-emerald-900 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/80',
                    saving && 'cursor-wait opacity-70',
                  )}
                >
                  <Download size={14} strokeWidth={2.25} />
                  {saving ? '생성 중…' : '다시 저장'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleShare()}
                  disabled={sharing}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 py-3 text-[12px] font-black text-white shadow-md shadow-fuchsia-400/35 ring-1 ring-white/40 transition hover:scale-[1.02] active:scale-[0.98]',
                    sharing && 'cursor-wait opacity-70',
                  )}
                >
                  <Share2 size={14} strokeWidth={2.25} />
                  {sharing ? '준비 중…' : '공유하기'}
                </button>
              </div>

              <div className="pb-1">
                <button
                  type="button"
                  onClick={() => setShowDeletePopup(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200/90 bg-rose-50/80 py-2.5 text-[12px] font-bold text-rose-600/90 transition hover:bg-rose-100/90"
                >
                  <Trash2 size={13} strokeWidth={2} />
                  이 카드 삭제
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 삭제 확인 팝업 */}
      {showDeletePopup && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-fuchsia-950/50 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setShowDeletePopup(false)}
        >
          <div
            className={cn(
              'w-full max-w-[320px] rounded-2xl border-2 border-pink-200/90 bg-gradient-to-br from-rose-50 to-fuchsia-50 p-6',
              'shadow-[0_24px_48px_-12px_rgba(236,72,153,0.35)]',
            )}
          >
            <p className="mb-2 text-center text-base font-black text-fuchsia-950">이 카드를 삭제할까요?</p>
            <p className="mb-5 text-center text-[13px] font-medium leading-relaxed text-fuchsia-900/55">
              삭제 후에는 복구할 수 없어요.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeletePopup(false)}
                className="flex-1 rounded-xl border border-pink-200 bg-white py-3 text-[13px] font-bold text-fuchsia-900/70"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(card.id)
                  showToast('랭킹 카드를 삭제했어요', 'success')
                  onClose()
                }}
                className="flex-1 rounded-xl bg-gradient-to-r from-rose-500 to-red-500 py-3 text-[13px] font-black text-white shadow-md shadow-rose-400/30"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  )
}

// ── 메인 페이지 ──────────────────────────────────────────────────────
export function RankingGalleryPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [cards,    setCards]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [sortBy,   setSortBy]   = useState('date')   // 'date' | 'tier'
  const [selected, setSelected] = useState(null)      // 상세 모달
  const [galleryPage, setGalleryPage] = useState(0)

  const GALLERY_PAGE_SIZE = 10

  const loadCards = useCallback(async () => {
    if (!user?.id) {
      setCards([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await fetchGallery(user.id)
      setCards(data)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void loadCards()
    if (!user?.id) return undefined
    const t = window.setTimeout(() => void markAllSeen(user.id), 1500)
    const onUpdated = () => void loadCards()
    window.addEventListener(RANKING_GALLERY_UPDATED, onUpdated)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener(RANKING_GALLERY_UPDATED, onUpdated)
    }
  }, [loadCards, user?.id])

  const handleDelete = async (cardId) => {
    if (!user?.id) return
    const res = await deleteFromGallery(user.id, cardId)
    if (res.ok) {
      setCards((prev) => prev.filter((c) => c.id !== cardId))
    }
  }

  const sorted = [...cards].sort((a, b) => {
    if (sortBy === 'tier') return a.rank - b.rank
    return new Date(b.savedAt) - new Date(a.savedAt)
  })

  const totalGalleryPages = Math.ceil(sorted.length / GALLERY_PAGE_SIZE)
  const pagedCards = sorted.slice(galleryPage * GALLERY_PAGE_SIZE, (galleryPage + 1) * GALLERY_PAGE_SIZE)

  const best = getBestCard(cards)
  const bestTier = best ? getMatchupTierDisplay(best.matchupTierId) : null

  if (!user) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-24 gap-4', PAGE_BG)}>
        <p className="text-4xl">🔒</p>
        <p className="text-base font-black text-slate-600">로그인이 필요해요</p>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="mt-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-pink-500 px-6 py-2.5 text-sm font-black text-white shadow-md hover:brightness-105 transition-all"
        >
          로그인
        </button>
      </div>
    )
  }

  return (
    <div className={cn(PAGE_BG)}>
      {/* 앰비언트 배경 */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-[radial-gradient(circle,_rgba(217,70,239,0.10)_0%,_transparent_70%)] blur-3xl" />
        <div className="absolute top-1/3 -right-16 w-64 h-64 rounded-full bg-[radial-gradient(circle,_rgba(139,92,246,0.09)_0%,_transparent_70%)] blur-3xl" />
        <div className="absolute bottom-24 left-1/4 w-56 h-56 rounded-full bg-[radial-gradient(circle,_rgba(6,182,212,0.07)_0%,_transparent_70%)] blur-3xl" />
      </div>

      <style>{`
        @keyframes card-in {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>

      <div className="mx-auto max-w-[520px] relative z-10 pb-20">

        {/* ── 스티키 헤더 ── */}
        <div className={cn(HEADER_GLASS, 'flex items-center gap-2.5 h-14 px-4')}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 pl-2 pr-3 py-2 -ml-1 rounded-xl bg-gradient-to-r from-pink-50 to-fuchsia-50 border border-pink-200/60 hover:from-pink-100 hover:to-fuchsia-100 transition-all shrink-0 shadow-sm"
          >
            <ArrowLeft size={15} className="text-fuchsia-700" />
            <span className="text-xs font-bold text-fuchsia-700">뒤로</span>
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 via-violet-500 to-cyan-500 shadow-md shadow-fuchsia-300/40">
              <Trophy size={13} className="text-white" />
            </span>
            <h1 className="text-base font-black bg-gradient-to-r from-fuchsia-700 via-violet-600 to-cyan-600 bg-clip-text text-transparent truncate">
              나의 랭킹 히스토리
            </h1>
          </div>
        </div>

        <div className="px-4 pt-5 space-y-4">

          {/* ── 나의 최고 기록 ── */}
          {best && bestTier && (
            <div className="rounded-2xl overflow-hidden shadow-lg" style={{ boxShadow: `0 4px 28px ${bestTier.color}30`, animation: 'card-in 0.4s ease both' }}>
              <div style={{ background: bestTier.bg }} className="p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-3 flex items-center gap-1.5">
                  <Crown size={11} className="text-white/60" />
                  나의 최고 기록
                </p>
                <div className="flex items-center gap-4">
                  {/* 썸네일 */}
                  <div className="w-14 shrink-0 rounded-xl overflow-hidden shadow-md" style={{ aspectRatio: '9/16', boxShadow: '0 0 0 2px rgba(255,255,255,0.25)' }}>
                    <GalleryCardPreview
                      card={best}
                      className="h-full w-full"
                      imgClassName="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{bestTier.emoji}</span>
                      <p className="text-white font-black text-lg leading-tight">{bestTier.name}</p>
                    </div>
                    <p className="text-white/55 text-xs mb-0.5">{formatSavedDate(best.savedAt)} · {periodLabel(best.period)} 랭킹</p>
                    <p className="text-white/40 text-[11px]">&quot;{getPercentile(best.rank)} 기록 보유 중!&quot;</p>
                  </div>
                  <div className="text-center shrink-0">
                    <p className="text-white/40 text-[9px] font-black mb-0.5 uppercase tracking-wider">BEST</p>
                    <p className="text-white font-black text-2xl leading-none">#{best.rank}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 저장된 카드 섹션 ── */}
          <div className="rounded-2xl overflow-hidden border border-pink-100/50 bg-white/90 shadow-[0_4px_24px_-10px_rgba(244,114,182,0.18)] backdrop-blur-sm">
            <div className="h-0.5 bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-400" />
            <div className="p-4">

              {/* 섹션 헤더 */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-sm">
                    <SortDesc size={13} className="text-white" />
                  </span>
                  <div>
                    <p className="text-sm font-black bg-gradient-to-r from-fuchsia-700 to-violet-700 bg-clip-text text-transparent leading-none">
                      저장된 랭킹 카드
                    </p>
                    <p className="text-[11px] text-slate-400 font-semibold mt-0.5">총 {cards.length}장</p>
                  </div>
                </div>

                {/* 정렬 버튼 */}
                {cards.length > 1 && (
                  <div className="flex gap-1.5">
                    {[{ id: 'date', label: '최신순' }, { id: 'tier', label: '티어순' }].map((s) => (
                      <button
                        key={s.id}
                        onClick={() => { setSortBy(s.id); setGalleryPage(0) }}
                        className={cn(
                          'px-3 py-1.5 rounded-xl text-[11px] font-black transition-all',
                          sortBy === s.id
                            ? 'bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-sm shadow-fuchsia-300/30'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 빈 상태 */}
              {loading && (
                <div className="flex flex-col items-center rounded-2xl border border-pink-100/50 bg-white/60 px-6 py-12 text-center">
                  <Loader2 className="mb-3 size-8 animate-spin text-fuchsia-500" />
                  <p className="text-sm font-semibold text-slate-500">저장된 카드 불러오는 중…</p>
                </div>
              )}

              {!loading && cards.length === 0 && (
                <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-fuchsia-200/50 bg-fuchsia-50/30 px-6 py-12 text-center">
                  <p className="mb-3 text-5xl leading-none">🏆</p>
                  <p className="text-base font-black text-slate-700">아직 저장된 카드가 없어요</p>
                  <p className="mt-1.5 text-sm font-medium text-slate-400 leading-relaxed">
                    랭킹 TOP 10에 들면 카드 에디터에서 저장할 수 있어요.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/ranking')}
                    className="mt-5 inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-2.5 text-sm font-black text-white shadow-md shadow-fuchsia-300/35 hover:brightness-105 hover:scale-[1.02] transition-all"
                  >
                    <Trophy size={14} />
                    랭킹 확인하러 가기
                  </button>
                </div>
              )}

              {/* 2컬럼 그리드 */}
              {!loading && pagedCards.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {pagedCards.map((card, i) => (
                    <div key={card.id} style={{ animation: `card-in 0.3s ${i * 0.05}s ease both` }}>
                      <CardThumbnail card={card} onClick={() => setSelected(card)} />
                    </div>
                  ))}
                </div>
              )}

              {/* 페이지네이션 */}
              {totalGalleryPages > 1 && (
                <div className="flex items-center justify-center gap-1.5 mt-5 flex-wrap">
                  <button
                    onClick={() => { setGalleryPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    disabled={galleryPage === 0}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-fuchsia-50 to-violet-50 border border-fuchsia-200/60 text-fuchsia-700 disabled:opacity-30 disabled:cursor-not-allowed hover:from-fuchsia-100 hover:to-violet-100 transition-all shadow-sm"
                  >
                    ← 이전
                  </button>
                  {Array.from({ length: totalGalleryPages }, (_, i) => i).map((p) => (
                    <button
                      key={p}
                      onClick={() => { setGalleryPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                      className={cn(
                        'w-8 h-8 rounded-xl text-xs font-black border transition-all',
                        p === galleryPage
                          ? 'bg-gradient-to-r from-fuchsia-600 to-violet-600 border-fuchsia-400 text-white shadow-md shadow-fuchsia-300/30'
                          : 'border-fuchsia-100 bg-white text-slate-500 hover:bg-fuchsia-50'
                      )}
                    >
                      {p + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => { setGalleryPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    disabled={galleryPage >= totalGalleryPages - 1}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-fuchsia-50 to-violet-50 border border-fuchsia-200/60 text-fuchsia-700 disabled:opacity-30 disabled:cursor-not-allowed hover:from-fuchsia-100 hover:to-violet-100 transition-all shadow-sm"
                  >
                    다음 →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 활용 팁 */}
          {cards.length > 0 && (
            <div className="rounded-2xl overflow-hidden border border-violet-100/60 bg-white/80 shadow-sm">
              <div className="h-0.5 bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400" />
              <div className="px-4 py-3.5 flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-sm mt-0.5">
                  <Sparkles size={13} className="text-white" />
                </span>
                <div>
                  <p className="text-sm font-black bg-gradient-to-r from-violet-700 to-fuchsia-700 bg-clip-text text-transparent mb-1">
                    랭킹 카드를 활용해보세요!
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    카드를 클릭해 다시 공유하거나 고화질로 저장할 수 있어요.<br />
                    인스타그램 스토리에 공유하면 친구들의 투표를 유도할 수 있어요!
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* 상세 모달 */}
      {selected && (
        <CardDetailModal
          card={selected}
          onClose={() => setSelected(null)}
          onDelete={(id) => { handleDelete(id); setSelected(null) }}
        />
      )}
    </div>
  )
}
