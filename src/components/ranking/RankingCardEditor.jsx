import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { X, Download, Share2, ChevronLeft, Check, ImageIcon, Lock } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { THEMES, drawCard, generateThumbnail, getPercentile, CARD_W, CARD_H, resolveRankingCardThemeId } from '../../lib/cardDraw'
import { getTier, getTierById, tierAtLeast } from '../../lib/tiers'
import { saveToGallery } from '../../lib/galleryUtils'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { RankingCardSaveCompleteModal } from './RankingCardSaveCompleteModal'
import { safeMediaUrl } from '../../lib/sanitize'

function calcWinRate(wins, losses) {
  const total = (wins || 0) + (losses || 0)
  if (!total) return null
  return Math.round(((wins || 0) / total) * 100)
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────
export function RankingCardEditor({ rank, nickname, avatar_url, points, period = 'weekly', profile, rankInfo, onClose }) {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { showToast } = useUIStore()
  const previewRef = useRef(null)
  const avatarRef  = useRef(null)

  const mergedRankInfo = useMemo(() => {
    const m = { ...(rankInfo || {}) }
    if (m.overallRank == null && rank != null) m.overallRank = rank
    return m
  }, [rank, rankInfo])

  const userTier = getTier(profile || {}, mergedRankInfo)

  const [themeId,     setThemeId]     = useState(() =>
    resolveRankingCardThemeId(profile, mergedRankInfo),
  )
  const [showNick,    setShowNick]    = useState(true)
  const [showPts,     setShowPts]     = useState(true)
  const [showRank,    setShowRank]    = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [savedToGallery, setSavedToGallery] = useState(false)
  const [showSaveComplete, setShowSaveComplete] = useState(false)
  const [lastThumbnail, setLastThumbnail] = useState(null)

  // 아바타 이미지 로드
  useEffect(() => {
    if (!avatar_url) return
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload  = () => { avatarRef.current = img; scheduleRedraw() }
    img.onerror = () => { avatarRef.current = null }
    img.src = safeMediaUrl(avatar_url)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatar_url])

  useEffect(() => {
    setThemeId(resolveRankingCardThemeId(profile, mergedRankInfo))
  }, [profile, mergedRankInfo])

  const getOpts = useCallback(() => ({
    rank, nickname, points, period, themeId,
    showNickname: showNick, showPoints: showPts, showRank,
    avatarImg: avatarRef.current,
  }), [rank, nickname, points, period, themeId, showNick, showPts, showRank])

  const scheduleRedraw = useCallback(() => {
    requestAnimationFrame(() => {
      if (!previewRef.current) return
      drawCard(previewRef.current, getOpts())
    })
  }, [getOpts])

  useEffect(() => { scheduleRedraw() }, [scheduleRedraw])

  // ── 고화질 다운로드 + 갤러리 저장 ───────────────────────────────
  const handleDownload = async () => {
    setSaving(true)
    try {
      const opts = getOpts()

      // 1. 고화질 다운로드
      const hiRes = document.createElement('canvas')
      hiRes.width = CARD_W; hiRes.height = CARD_H
      drawCard(hiRes, opts)
      const link = document.createElement('a')
      link.download = `VICS_TOP${rank}_${nickname || 'ranker'}_1080x1920.png`
      link.href = hiRes.toDataURL('image/png')
      link.click()

      // 2. 썸네일 생성 (모달 프리뷰용)
      const thumbnail = await generateThumbnail(opts)

      // 3. 갤러리에 저장
      if (user?.id) {
        saveToGallery(user.id, {
          rank, nickname, points, period, themeId,
          showNickname: showNick, showPoints: showPts, showRank,
          thumbnail,
        })
        setSavedToGallery(true)
      }

      // 4. 토스트 먼저 표시
      showToast('사진첩에 저장이 완료되었습니다', 'success')

      // 5. 저장 완료 모달 표시
      setLastThumbnail(thumbnail)
      setShowSaveComplete(true)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  // ── 인스타 공유 ──────────────────────────────────────────────────
  const handleInstagram = async () => {
    const canvas = document.createElement('canvas')
    canvas.width = CARD_W; canvas.height = CARD_H
    drawCard(canvas, getOpts())
    if (navigator.share && navigator.canShare) {
      canvas.toBlob(async (blob) => {
        const file = new File([blob], 'vics_ranking.png', { type: 'image/png' })
        if (navigator.canShare({ files: [file] })) {
          try { await navigator.share({ title: 'VICS 랭킹 카드', files: [file] }) } catch (_) {}
          return
        }
        fallbackDownload(canvas)
      })
    } else {
      fallbackDownload(canvas)
    }
  }

  const fallbackDownload = (canvas) => {
    const link = document.createElement('a')
    link.download = `VICS_ranking_card.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    alert('이미지가 저장되었습니다!\n인스타그램 스토리에서 이미지를 선택해 공유해보세요 📸')
  }

  const activeTheme = THEMES.find(t => t.id === themeId) || THEMES[0]

  return (
    <>
      <style>{`
        @keyframes editor-in {
          from { transform: translateY(50px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes save-bounce {
          0%,100% { transform: scale(1); }
          40%     { transform: scale(1.06); }
        }
        .ec-theme-btn { transition: transform 0.15s, border-color 0.15s, background 0.15s; }
        .ec-theme-btn:hover:not(:disabled) { transform: translateY(-2px); }
        .ec-theme-btn:disabled { cursor: not-allowed; opacity: 0.42; }
        .ec-action { transition: filter 0.15s, transform 0.1s; }
        .ec-action:hover { filter: brightness(1.1); }
        .ec-action:active { transform: scale(0.97); }
        .ec-toggle { transition: background 0.15s, border-color 0.15s, transform 0.1s; }
        .ec-toggle:active { transform: scale(0.96); }
      `}</style>

      {/* 오버레이: z-[60] → 축하 모달(z-50) 위 */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 60,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)',
        }}
      >
        {/* 패널 */}
        <div style={{
          position: 'relative', width: '100%', maxWidth: 680,
          maxHeight: '96dvh', background: '#0f1117',
          borderRadius: '24px 24px 0 0',
          display: 'flex', flexDirection: 'column',
          animation: 'editor-in 0.35s cubic-bezier(0.16,1,0.3,1) both',
          overflow: 'hidden',
        }}>

          {/* 헤더 */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
          }}>
            <button className="ec-action" onClick={onClose} style={{
              display:'flex',alignItems:'center',gap:4,color:'rgba(255,255,255,0.45)',
              fontSize:12,fontWeight:700,background:'none',border:'none',cursor:'pointer',padding:'4px 8px',borderRadius:8,
            }}>
              <ChevronLeft size={14} /> 뒤로
            </button>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#fff', fontWeight: 900, fontSize: 14, margin: 0 }}>랭킹 카드 편집</p>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, margin: 0 }}>고화질 1080×1920 저장</p>
            </div>
            <button className="ec-action" onClick={onClose} style={{
              background:'rgba(255,255,255,0.1)',border:'none',borderRadius:'50%',
              width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',
              cursor:'pointer',color:'rgba(255,255,255,0.5)',
            }}>
              <X size={14} />
            </button>
          </div>

          {/* 본문 */}
          <div style={{ display: 'flex', overflow: 'auto', flex: 1 }}>

            {/* 미리보기 */}
            <div style={{
              background: 'rgba(0,0,0,0.4)', padding: '20px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, width: 190,
            }}>
              <div style={{ position: 'relative', width: 148, height: 263 }}>
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 14,
                  background: activeTheme.swatch[2], filter: 'blur(20px)', opacity: 0.3,
                }} />
                <canvas ref={previewRef} width={370} height={658}
                  style={{ position:'relative',width:'100%',height:'100%',borderRadius:14,
                    boxShadow:'0 8px 32px rgba(0,0,0,0.6)',outline:'1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
            </div>

            {/* 컨트롤 */}
            <div style={{ flex:1, overflowY:'auto', padding:'16px 18px 24px', display:'flex', flexDirection:'column', gap:18 }}>

              {/* 환영 */}
              <div>
                <p style={{ color:'rgba(255,255,255,0.85)', fontWeight:900, fontSize:13, margin:'0 0 2px' }}>
                  ✨ 축하합니다, <span style={{ color:'#fbbf24' }}>{nickname}</span>님!
                </p>
                <p style={{ color:'rgba(255,255,255,0.3)', fontSize:11, margin:0 }}>
                  이 멋진 순간을 이미지로 간직하세요
                </p>
              </div>

              {/* 테마 */}
              <div>
                <p style={{ color:'rgba(255,255,255,0.4)',fontSize:10,fontWeight:900,
                  letterSpacing:'0.12em',textTransform:'uppercase',margin:'0 0 10px' }}>카드 테마</p>
                <p style={{ color:'rgba(255,255,255,0.22)', fontSize:10, margin:'0 0 10px', lineHeight:1.45 }}>
                  현재 등급(<strong style={{ color:'rgba(251,191,36,0.85)' }}>{userTier.name}</strong>) 이하 티어의 테마를 골라 쓸 수 있어요.
                </p>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(5, minmax(0, 1fr))', gap:6 }}>
                  {THEMES.map(th => {
                    const active = themeId === th.id
                    const locked = !tierAtLeast(userTier, th.tierId)
                    const tierName = getTierById(th.tierId).name
                    return (
                      <button key={th.id} className="ec-theme-btn" type="button"
                        disabled={locked}
                        title={locked ? `${tierName} 등급 전용 테마입니다` : `${tierName} 테마`}
                        onClick={() => { if (!locked) setThemeId(th.id) }}
                        style={{
                          position:'relative',
                          display:'flex', flexDirection:'column', alignItems:'center', gap:5,
                          padding:'8px 4px 6px',
                          background: active ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                          border: active ? '2px solid rgba(255,255,255,0.6)' : '2px solid rgba(255,255,255,0.1)',
                          borderRadius:14,
                        }}>
                        <div style={{
                          width:34, height:46, borderRadius:9,
                          background:`linear-gradient(135deg,${th.swatch[0]},${th.swatch[1]})`,
                          boxShadow:`0 3px 10px ${th.swatch[2]}55`, position:'relative', overflow:'hidden',
                        }}>
                          <div style={{ position:'absolute',bottom:3,right:3,width:10,height:10,
                            borderRadius:'50%',background:th.swatch[2],opacity:0.8 }} />
                          {locked && (
                            <div style={{
                              position:'absolute', inset:0, background:'rgba(0,0,0,0.45)',
                              display:'flex', alignItems:'center', justifyContent:'center',
                            }}>
                              <Lock size={14} color="rgba(255,255,255,0.85)" strokeWidth={2.5} />
                            </div>
                          )}
                        </div>
                        <p style={{
                          color:active?'#fff':'rgba(255,255,255,0.55)',fontSize:9,fontWeight:900,margin:0,
                          textAlign:'center', lineHeight:1.2,
                        }}>
                          {th.emoji} {th.label}
                        </p>
                        {active && !locked && (
                          <div style={{ position:'absolute',top:4,right:4,width:14,height:14,
                            borderRadius:'50%',background:'#fff',display:'flex',alignItems:'center',justifyContent:'center' }}>
                            <Check size={8} color="#0f1117" />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 정보 토글 */}
              <div>
                <p style={{ color:'rgba(255,255,255,0.4)',fontSize:10,fontWeight:900,
                  letterSpacing:'0.12em',textTransform:'uppercase',margin:'0 0 10px' }}>포함할 정보</p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {[
                    { label:'닉네임',      val:showNick, set:setShowNick },
                    { label:'획득 포인트', val:showPts,  set:setShowPts  },
                    { label:showRank?'등수 표시':'상위 % 표시', val:showRank, set:setShowRank },
                  ].map(({ label, val, set }) => (
                    <button key={label} className="ec-toggle"
                      onClick={() => set(!val)}
                      style={{
                        cursor:'pointer', display:'flex', alignItems:'center', gap:7,
                        padding:'8px 14px',
                        background: val ? '#22282E' : 'rgba(255,255,255,0.06)',
                        border: val ? '1.5px solid #4b5563' : '1.5px solid rgba(255,255,255,0.12)',
                        borderRadius:12, color:val?'#fff':'rgba(255,255,255,0.5)',
                        fontSize:12, fontWeight:700,
                      }}>
                      <span style={{
                        width:14, height:14, borderRadius:4, flexShrink:0,
                        background:val?'#fff':'transparent',
                        border:val?'1.5px solid #fff':'1.5px solid rgba(255,255,255,0.3)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                      }}>
                        {val && <Check size={9} color="#22282E" />}
                      </span>
                      {label}
                    </button>
                  ))}
                </div>
                {!showRank && (
                  <p style={{ color:'rgba(255,255,255,0.25)', fontSize:10, marginTop:8 }}>
                    💡 등수 대신 &quot;{getPercentile(rank)} 안목가&quot;로 표시돼요
                  </p>
                )}
              </div>

              <div style={{ borderTop:'1px solid rgba(255,255,255,0.08)' }} />

              {/* 버튼 */}
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <button className="ec-action" onClick={handleDownload} disabled={saving}
                  style={{
                    cursor:saving?'not-allowed':'pointer', width:'100%', padding:'14px',
                    borderRadius:16, border:'none',
                    background: saved ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#e5e7eb,#f3f4f6)',
                    color:'#0f1117', fontWeight:900, fontSize:14,
                    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                    boxShadow:'0 4px 16px rgba(255,255,255,0.1)',
                    opacity:saving?0.6:1,
                    animation:saved?'save-bounce 0.4s ease':'none',
                  }}>
                  {saved
                    ? <><Check size={16} /> 저장 완료!</>
                    : saving
                      ? <><div style={{ width:16,height:16,borderRadius:'50%',border:'2px solid #9ca3af',
                          borderTopColor:'#111',animation:'spin 0.7s linear infinite' }} /> 생성 중…</>
                      : <><Download size={16} /> 📥 갤러리에 저장하기 (1080×1920)</>
                  }
                </button>

                <button className="ec-action" onClick={handleInstagram}
                  style={{
                    cursor:'pointer', width:'100%', padding:'14px',
                    borderRadius:16, border:'none',
                    background:'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)',
                    color:'#fff', fontWeight:900, fontSize:14,
                    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                    boxShadow:'0 4px 16px rgba(253,29,29,0.3)',
                  }}>
                  <Share2 size={16} /> 인스타그램에 공유하기
                </button>

                {/* 갤러리 이동 링크 (저장 후 표시) */}
                {savedToGallery && (
                  <Link to="/mypage/ranking-gallery" onClick={onClose}
                    style={{
                      display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                      padding:'12px', borderRadius:14, textDecoration:'none',
                      background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.3)',
                      color:'#a78bfa', fontWeight:700, fontSize:13,
                      animation:'editor-in 0.3s ease both',
                    }}>
                    <ImageIcon size={15} /> 📂 내 랭킹 갤러리에서 보기
                  </Link>
                )}
              </div>

              <p style={{ color:'rgba(255,255,255,0.18)', fontSize:10, textAlign:'center', margin:0 }}>
                저장 시 갤러리에 자동으로 기록돼요
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 저장 완료 모달 */}
      {showSaveComplete && (
        <RankingCardSaveCompleteModal
          thumbnail={lastThumbnail}
          rank={rank}
          nickname={nickname}
          winRate={calcWinRate(profile?.wins, profile?.losses)}
          onClose={() => {
            navigate('/ranking')
            onClose()
          }}
          onConfirm={onClose}
        />
      )}
    </>
  )
}
