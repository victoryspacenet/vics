import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Trophy, Download, Share2, Trash2, X, SortDesc, Crown, Sparkles } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { loadGallery, deleteFromGallery, markAllSeen, getBestCard } from '../lib/galleryUtils'
import { drawCard, getPercentile, getTierInfo, formatSavedDate, CARD_W, CARD_H } from '../lib/cardDraw'

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
        ? <img ref={imgRef} src={card.thumbnail} alt={`${card.rank}위 카드`}
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
  const avatarRef  = useRef(null)
  const [confirm,  setConfirm]    = useState(false)
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
    if (card.thumbnail) {
      const res  = await fetch(card.thumbnail)
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
    link.href = card.thumbnail || ''
    link.click()
    alert('이미지를 저장 후 인스타그램 스토리에서 공유해보세요 📸')
  }

  return (
    <>
      <style>{`
        @keyframes detail-in {
          from { opacity:0; transform:scale(0.95); }
          to   { opacity:1; transform:scale(1); }
        }
      `}</style>
      <div
        style={{
          position:'fixed', inset:0, zIndex:70,
          display:'flex', alignItems:'center', justifyContent:'center',
          background:'rgba(0,0,0,0.92)', backdropFilter:'blur(12px)',
          padding:16,
        }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div style={{
          width:'100%', maxWidth:420,
          background:'#12121f', borderRadius:24,
          overflow:'hidden', animation:'detail-in 0.25s ease both',
          maxHeight:'92dvh', display:'flex', flexDirection:'column',
        }}>
          {/* 헤더 (고정) */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.07)',
            flexShrink:0,
          }}>
            <div>
              <p style={{ color:'#fff', fontWeight:900, fontSize:14, margin:0 }}>
                {tier.emoji} {tier.name}
              </p>
              <p style={{ color:'rgba(255,255,255,0.35)', fontSize:11, margin:0 }}>
                {formatSavedDate(card.savedAt)} · {periodLabel(card.period)} 랭킹
              </p>
            </div>
            <button onClick={onClose} style={{
              background:'rgba(255,255,255,0.08)', border:'none', borderRadius:'50%',
              width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center',
              cursor:'pointer', color:'rgba(255,255,255,0.5)',
            }}><X size={14} /></button>
          </div>

          {/* 스크롤 가능한 본문 */}
          <div style={{
            flex:1, minHeight:0, overflowY:'auto', overscrollBehavior:'contain',
            WebkitOverflowScrolling:'touch',
          }}>
            {/* 카드 미리보기 (축소) */}
            <div style={{
              display:'flex', justifyContent:'center',
              background:'rgba(0,0,0,0.4)', padding:'14px 0',
              flexShrink:0,
            }}>
              <div style={{
                width:140, aspectRatio:'9/16', borderRadius:12, overflow:'hidden',
                boxShadow:`0 0 0 2px ${tier.color}88, 0 6px 20px rgba(0,0,0,0.5)`,
              }}>
                {card.thumbnail
                  ? <img src={card.thumbnail} alt="카드" style={{ width:'100%',height:'100%',objectFit:'cover' }} />
                  : <div style={{ width:'100%',height:'100%',background:'#1a1a2e',
                      display:'flex',alignItems:'center',justifyContent:'center' }}>
                      <span style={{ fontSize:32 }}>{tier.emoji}</span>
                    </div>
                }
              </div>
            </div>

            {/* 정보 + 액션 */}
            <div style={{ padding:'12px 16px 20px', display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{
              display:'flex', justifyContent:'space-between',
              padding:'10px 14px', background:'rgba(255,255,255,0.04)',
              borderRadius:12, border:'1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ textAlign:'center' }}>
                <p style={{ color:'rgba(255,255,255,0.4)', fontSize:9, fontWeight:900, margin:'0 0 3px', textTransform:'uppercase', letterSpacing:'0.08em' }}>순위</p>
                <p style={{ color: tier.color, fontSize:18, fontWeight:900, margin:0 }}>#{card.rank}</p>
              </div>
              <div style={{ textAlign:'center' }}>
                <p style={{ color:'rgba(255,255,255,0.4)', fontSize:9, fontWeight:900, margin:'0 0 3px', textTransform:'uppercase', letterSpacing:'0.08em' }}>백분위</p>
                <p style={{ color:'#fff', fontSize:11, fontWeight:900, margin:0 }}>{getPercentile(card.rank)}</p>
              </div>
              <div style={{ textAlign:'center' }}>
                <p style={{ color:'rgba(255,255,255,0.4)', fontSize:9, fontWeight:900, margin:'0 0 3px', textTransform:'uppercase', letterSpacing:'0.08em' }}>포인트</p>
                <p style={{ color:'#fff', fontSize:11, fontWeight:900, margin:0 }}>{(card.points||0).toLocaleString()}P</p>
              </div>
            </div>

            {/* 액션 버튼 */}
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={handleReDownload} disabled={saving} style={{
                flex:1, padding:'11px 0', borderRadius:12, border:'1px solid rgba(255,255,255,0.12)',
                background:'rgba(255,255,255,0.06)', color:'#fff', fontWeight:700, fontSize:12,
                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              }}>
                <Download size={13} /> {saving ? '생성 중…' : '다시 저장'}
              </button>
              <button onClick={handleShare} style={{
                flex:1, padding:'11px 0', borderRadius:12, border:'none',
                background:'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)',
                color:'#fff', fontWeight:700, fontSize:12,
                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              }}>
                <Share2 size={13} /> 공유하기
              </button>
            </div>

            {/* 삭제 */}
            <div style={{ paddingBottom:18 }}>
              {!confirm
                ? <button onClick={() => setConfirm(true)} style={{
                    width:'100%', padding:'10px', borderRadius:12,
                    background:'transparent', border:'1px solid rgba(239,68,68,0.25)',
                    color:'rgba(239,68,68,0.6)', fontWeight:700, fontSize:12,
                    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                  }}>
                    <Trash2 size={12} /> 이 카드 삭제
                  </button>
                : <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => setConfirm(false)} style={{
                      flex:1, padding:'10px', borderRadius:12,
                      background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
                      color:'rgba(255,255,255,0.6)', fontWeight:700, fontSize:12, cursor:'pointer',
                    }}>취소</button>
                    <button onClick={() => setShowDeletePopup(true)} style={{
                      flex:1, padding:'10px', borderRadius:12, border:'none',
                      background:'#ef4444', color:'#fff', fontWeight:900, fontSize:12, cursor:'pointer',
                    }}>정말 삭제</button>
                  </div>
              }
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* 삭제 확인 팝업 */}
      {showDeletePopup && (
        <div
          style={{
            position:'fixed', inset:0, zIndex:80,
            display:'flex', alignItems:'center', justifyContent:'center',
            background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', padding:16,
          }}
          onClick={(e) => e.target === e.currentTarget && setShowDeletePopup(false)}
        >
          <div style={{
            width:'100%', maxWidth:320, background:'#1a1a2e', borderRadius:20, padding:24,
            boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
          }}>
            <p style={{ color:'#fff', fontWeight:900, fontSize:16, margin:'0 0 8px', textAlign:'center' }}>
              이 카드를 삭제할까요?
            </p>
            <p style={{ color:'rgba(255,255,255,0.5)', fontSize:13, margin:'0 0 20px', textAlign:'center' }}>
              삭제 후에는 복구할 수 없어요.
            </p>
            <div style={{ display:'flex', gap:10 }}>
              <button
                onClick={() => setShowDeletePopup(false)}
                style={{
                  flex:1, padding:'12px', borderRadius:12,
                  background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)',
                  color:'rgba(255,255,255,0.8)', fontWeight:700, fontSize:13, cursor:'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={() => { onDelete(card.id); onClose() }}
                style={{
                  flex:1, padding:'12px', borderRadius:12, border:'none',
                  background:'#ef4444', color:'#fff', fontWeight:900, fontSize:13, cursor:'pointer',
                }}
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
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 0 80px' }}>
      <style>{`
        @keyframes card-in {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>

      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 16px 12px',
      }}>
        <button onClick={() => navigate(-1)} style={{
          display:'flex', alignItems:'center', gap:6,
          background:'none', border:'none', cursor:'pointer',
          color:'#22282E', fontWeight:700, fontSize:14, padding:'6px 8px', borderRadius:10,
        }}>
          <ArrowLeft size={18} />
        </button>
        <h1 style={{ fontWeight:900, fontSize:17, color:'#22282E', margin:0 }}>나의 랭킹 히스토리</h1>
        <div style={{ width:40 }} />
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
                    ? <img src={best.thumbnail} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }} />
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
                <button key={s.id} onClick={() => setSortBy(s.id)} style={{
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
        {sorted.length > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12,
          }}>
            {sorted.map((card, i) => (
              <div key={card.id} style={{ animation: `card-in 0.3s ${i * 0.05}s ease both` }}>
                <CardThumbnail card={card} onClick={() => setSelected(card)} />
              </div>
            ))}
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
  )
}
