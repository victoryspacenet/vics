import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Trophy, Download, Share2, Trash2, X, SortDesc, Crown, Sparkles } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { loadGallery, deleteFromGallery, markAllSeen, getBestCard } from '../lib/galleryUtils'
import { drawCard, getPercentile, getTierInfo, formatSavedDate, CARD_W, CARD_H } from '../lib/cardDraw'
import { safeMediaUrl } from '../lib/sanitize'
import { cn } from '../lib/utils'

const PAGE_BG =
  'bg-gradient-to-br from-rose-50/98 via-fuchsia-50/35 to-cyan-50/50 min-h-[70vh]'

// ── 기간 한글 레이블 ────────────────────────────────────────────────
function periodLabel(p) {
  if (p === 'weekly')  return '주간'
  if (p === 'monthly') return '월간'
  return '전체'
}

// ── 미니 카드 캔버스 썸네일 ──────────────────────────────────────────
function CardThumbnail({ card, onClick }) {
  const imgRef = useRef(null)
  const tier = getTierInfo(card.rank)

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
      {/* 썸네일 이미지 */}
      {card.thumbnail
        ? <img ref={imgRef} src={safeMediaUrl(card.thumbnail)} alt={`${card.rank}위 카드`}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <div style={{
            width: '100%', height: '100%',
            background: `linear-gradient(135deg, #0f0f20, #1a1a35)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 6,
          }}>
            <span style={{ fontSize: 32 }}>{tier.emoji}</span>
            <p style={{ color: tier.color, fontWeight: 900, fontSize: 13, margin: 0 }}>{tier.name}</p>
          </div>
      }

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
  const tier = getTierInfo(card.rank)

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

  // ── 인스타 공유 ──────────────────────────────────────────────────
  const handleShare = async () => {
    const safeUrl = safeMediaUrl(card.thumbnail)
    if (safeUrl) {
      const res  = await fetch(safeUrl)
      const blob = await res.blob()
      const file = new File([blob], 'vics_ranking.png', { type: 'image/jpeg' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ title: 'VICS 랭킹 카드', files: [file] }) } catch (_) {}
        return
      }
    }
    // fallback
    const link = document.createElement('a')
    link.download = `VICS_ranking.jpg`
    link.href = safeUrl || ''
    link.click()
    alert('이미지를 저장 후 인스타그램 스토리에서 공유해보세요 📸')
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
                {card.thumbnail ? (
                  <img
                    src={safeMediaUrl(card.thumbnail)}
                    alt="카드"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 to-fuchsia-950"
                  >
                    <span className="text-4xl">{tier.emoji}</span>
                  </div>
                )}
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
                  onClick={handleShare}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 py-3 text-[12px] font-black text-white shadow-md shadow-fuchsia-400/35 ring-1 ring-white/40 transition hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Share2 size={14} strokeWidth={2.25} />
                  공유하기
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
  const { user, profile } = useAuthStore()

  const [cards,    setCards]    = useState([])
  const [sortBy,   setSortBy]   = useState('date')   // 'date' | 'tier'
  const [selected, setSelected] = useState(null)      // 상세 모달
  const [galleryPage, setGalleryPage] = useState(0)

  const GALLERY_PAGE_SIZE = 10

  const loadCards = useCallback(() => {
    if (!user?.id) return
    const data = loadGallery(user.id)
    setCards(data)
  }, [user?.id])

  useEffect(() => {
    loadCards()
    // 조회 시 NEW 플래그 초기화
    if (user?.id) setTimeout(() => markAllSeen(user.id), 1500)
  }, [loadCards, user?.id])

  const handleDelete = (cardId) => {
    if (!user?.id) return
    deleteFromGallery(user.id, cardId)
    setCards(prev => prev.filter(c => c.id !== cardId))
  }

  const sorted = [...cards].sort((a, b) => {
    if (sortBy === 'tier') return a.rank - b.rank
    return new Date(b.savedAt) - new Date(a.savedAt)
  })

  const totalGalleryPages = Math.ceil(sorted.length / GALLERY_PAGE_SIZE)
  const pagedCards = sorted.slice(galleryPage * GALLERY_PAGE_SIZE, (galleryPage + 1) * GALLERY_PAGE_SIZE)

  const best = getBestCard(cards)
  const bestTier = best ? getTierInfo(best.rank) : null

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-2xl">🔒</p>
        <p className="text-gray-500 font-bold">로그인이 필요합니다</p>
      </div>
    )
  }

  return (
    <div className={cn(PAGE_BG)}>
      <div className="mx-auto max-w-[520px] px-0 pb-20 pt-0">
      <style>{`
        @keyframes card-in {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>

      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 rounded-2xl border border-pink-100/80 bg-white/90 px-2.5 py-2 text-sm font-black text-fuchsia-950 shadow-sm shadow-pink-100/40 transition hover:bg-white hover:shadow-md"
        >
          <ArrowLeft size={18} strokeWidth={2.25} />
        </button>
        <h1 className="bg-gradient-to-r from-fuchsia-700 via-violet-600 to-cyan-600 bg-clip-text text-center text-[17px] font-black tracking-tight text-transparent">
          나의 랭킹 히스토리
        </h1>
        <div className="w-10" aria-hidden />
      </div>

      {/* ── 나의 최고 기록 ── */}
      {best && bestTier && (
        <div style={{ margin:'0 16px 20px', animation:'card-in 0.4s ease both' }}>
          <div style={{
            borderRadius: 20, overflow: 'hidden',
            background: bestTier.bg,
            boxShadow: `0 4px 24px ${bestTier.color}33`,
          }}>
            <div style={{ padding:'14px 18px' }}>
              <p style={{ color:'rgba(255,255,255,0.55)',fontSize:10,fontWeight:900,
                letterSpacing:'0.15em',textTransform:'uppercase',margin:'0 0 6px' }}>
                🏆 나의 최고 기록
              </p>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                {/* 썸네일 */}
                <div style={{
                  width:52, aspectRatio:'9/16', borderRadius:8, overflow:'hidden', flexShrink:0,
                  boxShadow:'0 0 0 2px rgba(255,255,255,0.3)',
                }}>
                  {best.thumbnail
                    ? <img src={safeMediaUrl(best.thumbnail)} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }} />
                    : <div style={{ width:'100%',height:'100%',background:'rgba(0,0,0,0.3)',
                        display:'flex',alignItems:'center',justifyContent:'center' }}>
                        <span style={{ fontSize:18 }}>{bestTier.emoji}</span>
                      </div>
                  }
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                    <span style={{ fontSize:20 }}>{bestTier.emoji}</span>
                    <p style={{ color:'#fff', fontWeight:900, fontSize:18, margin:0 }}>{bestTier.name}</p>
                  </div>
                  <p style={{ color:'rgba(255,255,255,0.6)', fontSize:12, margin:'0 0 2px' }}>
                    {formatSavedDate(best.savedAt)} · {periodLabel(best.period)} 랭킹
                  </p>
                  <p style={{ color:'rgba(255,255,255,0.5)', fontSize:11, margin:0 }}>
                    &quot;{getPercentile(best.rank)} 기록 보유 중!&quot;
                  </p>
                </div>
                <div style={{ textAlign:'center', flexShrink:0 }}>
                  <p style={{ color:'rgba(255,255,255,0.5)', fontSize:9, fontWeight:900, margin:'0 0 2px' }}>BEST</p>
                  <p style={{ color:'#fff', fontWeight:900, fontSize:22, margin:0 }}>#{best.rank}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 저장된 카드 섹션 ── */}
      <div style={{ padding:'0 16px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <p style={{ color:'#22282E', fontWeight:900, fontSize:15, margin:0 }}>
            📸 저장된 랭킹 카드 <span style={{ color:'#9ca3af', fontWeight:700, fontSize:12 }}>({cards.length})</span>
          </p>

          {/* 정렬 버튼 */}
          {cards.length > 1 && (
            <div style={{ display:'flex', gap:6 }}>
              {[{ id:'date', label:'최신순' }, { id:'tier', label:'티어순' }].map(s => (
                <button key={s.id} onClick={() => { setSortBy(s.id); setGalleryPage(0) }} style={{
                  padding:'5px 12px', borderRadius:20,
                  background: sortBy === s.id ? '#22282E' : '#f3f4f6',
                  color: sortBy === s.id ? '#fff' : '#6b7280',
                  border: 'none', cursor:'pointer', fontWeight:700, fontSize:11,
                  transition:'background 0.15s, color 0.15s',
                }}>
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 빈 상태 */}
        {cards.length === 0 && (
          <div style={{
            padding:'48px 24px', textAlign:'center',
            background:'#f9fafb', borderRadius:20,
            border:'2px dashed #e5e7eb',
          }}>
            <p style={{ fontSize:40, margin:'0 0 12px' }}>🏆</p>
            <p style={{ color:'#374151', fontWeight:900, fontSize:15, margin:'0 0 6px' }}>
              아직 저장된 카드가 없어요
            </p>
            <p style={{ color:'#9ca3af', fontSize:13, margin:'0 0 20px' }}>
              랭킹 TOP 10에 들면 카드를 저장해보세요!
            </p>
            <button onClick={() => navigate('/ranking')} style={{
              padding:'10px 24px', borderRadius:12, border:'none',
              background:'#22282E', color:'#fff', fontWeight:900, fontSize:13, cursor:'pointer',
            }}>
              랭킹 확인하러 가기 →
            </button>
          </div>
        )}

        {/* 2컬럼 그리드 */}
        {pagedCards.length > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12,
          }}>
            {pagedCards.map((card, i) => (
              <div key={card.id} style={{ animation: `card-in 0.3s ${i * 0.05}s ease both` }}>
                <CardThumbnail card={card} onClick={() => setSelected(card)} />
              </div>
            ))}
          </div>
        )}

        {/* 페이지네이션 (카드 10개 초과 시) */}
        {totalGalleryPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-5 flex-wrap">
            <button
              onClick={() => { setGalleryPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              disabled={galleryPage === 0}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-fuchsia-200 bg-white text-fuchsia-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-fuchsia-50 transition-colors"
            >
              ← 이전
            </button>
            {Array.from({ length: totalGalleryPages }, (_, i) => i).map((p) => (
              <button
                key={p}
                onClick={() => { setGalleryPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                className={cn(
                  'w-8 h-8 rounded-xl text-xs font-black border transition-colors',
                  p === galleryPage
                    ? 'bg-gradient-to-r from-fuchsia-200 via-violet-200 to-pink-200 border-fuchsia-300 text-fuchsia-900 shadow-sm'
                    : 'border-fuchsia-100 bg-white text-gray-600 hover:bg-fuchsia-50'
                )}
              >
                {p + 1}
              </button>
            ))}
            <button
              onClick={() => { setGalleryPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              disabled={galleryPage >= totalGalleryPages - 1}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-fuchsia-200 bg-white text-fuchsia-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-fuchsia-50 transition-colors"
            >
              다음 →
            </button>
          </div>
        )}

        {/* 활용 팁 */}
        {cards.length > 0 && (
          <div style={{
            marginTop:20, padding:'14px 16px',
            background:'linear-gradient(135deg,rgba(139,92,246,0.08),rgba(236,72,153,0.08))',
            borderRadius:16, border:'1px solid rgba(139,92,246,0.15)',
          }}>
            <p style={{ color:'#7c3aed', fontWeight:900, fontSize:12, margin:'0 0 6px' }}>
              <Sparkles size={12} style={{ display:'inline',verticalAlign:'middle',marginRight:4 }} />
              랭킹 카드를 활용해보세요!
            </p>
            <p style={{ color:'#6b7280', fontSize:11, margin:0, lineHeight:1.6 }}>
              카드를 클릭해 다시 공유하거나 고화질로 저장할 수 있어요.
              <br />
              인스타그램 스토리에 공유하면 친구들의 투표를 유도할 수 있어요!
            </p>
          </div>
        )}
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
    </div>
  )
}
