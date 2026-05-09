import { X, Instagram, MessageCircle, Link2, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getTierInfo } from '../../lib/cardDraw'
import { copyToClipboard } from '../../lib/utils'
import { safeMediaUrl } from '../../lib/sanitize'
import { useUIStore } from '../../store/uiStore'

const HASHTAGS = '#VictorySpace #내랭킹 #랭킹인증'

function calcWinRate(wins, losses) {
  const total = (wins || 0) + (losses || 0)
  if (!total) return null
  return Math.round(((wins || 0) / total) * 100)
}

export function RankingCardSaveCompleteModal({
  thumbnail,
  rank,
  nickname,
  winRate,
  onClose,
  onConfirm,
}) {
  const { showToast } = useUIStore()
  const tier = getTierInfo(rank)

  const handleInstagram = async () => {
    if (thumbnail && navigator.share && navigator.canShare) {
      try {
        const res = await fetch(thumbnail)
        const blob = await res.blob()
        const file = new File([blob], 'vics_ranking.png', { type: 'image/jpeg' })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'VICS 랭킹 인증',
            text: HASHTAGS,
            files: [file],
          })
          return
        }
      } catch (_) {}
    }
    const link = document.createElement('a')
    link.download = 'VICS_ranking.jpg'
    link.href = thumbnail || ''
    link.click()
    showToast('이미지가 저장됐어요! 인스타그램 스토리에서 공유해보세요 📸', 'success')
  }

  const handleKakao = async () => {
    const url = `${window.location.origin}/ranking`
    await copyToClipboard(`${HASHTAGS}\n${url}`)
    showToast('링크와 해시태그가 복사됐어요! 카카오톡에 붙여넣어 공유해보세요 💬', 'success')
  }

  const handleLinkCopy = async () => {
    const url = `${window.location.origin}/ranking`
    await copyToClipboard(`${HASHTAGS}\n${url}`)
    showToast('링크가 복사됐어요! 🔗', 'success')
  }

  return (
    <>
      <style>{`
        @keyframes save-complete-in {
          from { opacity:0; transform:scale(0.92) translateY(20px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
      `}</style>
        <div
        style={{
          position: 'fixed', inset: 0, zIndex: 65,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)',
          padding: 16,
        }}
      >
        <div
          style={{
            width: '100%', maxWidth: 380,
            background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)',
            borderRadius: 24,
            overflow: 'hidden',
            animation: 'save-complete-in 0.4s cubic-bezier(0.16,1,0.3,1) both',
            maxHeight: '92dvh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 24px 48px rgba(0,0,0,0.5)`,
          }}
        >
          {/* 닫기 */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end',
            padding: '12px 14px 0',
          }}>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.08)', border: 'none',
                borderRadius: '50%', width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'rgba(255,255,255,0.5)',
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* 본문 (스크롤 가능) */}
          <div style={{
            flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain',
            padding: '0 20px 24px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
          }}>
            {/* 저장 완료 헤더 */}
            <p style={{ color: '#fff', fontWeight: 900, fontSize: 22, margin: '0 0 4px' }}>
              저장 완료!
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
              <span style={{ fontSize: 18 }}>✨</span>
              <span style={{ fontSize: 18 }}>📸</span>
              <span style={{ fontSize: 18 }}>✨</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, margin: '0 0 20px', textAlign: 'center', lineHeight: 1.5 }}>
              {nickname}님의 랭킹 카드가<br />갤러리에 저장되었습니다.
            </p>

            {/* 카드 프리뷰 + 티어 */}
            <div style={{
              width: '100%',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.08)',
              padding: 16,
              marginBottom: 16,
            }}>
              <p style={{
                color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 900,
                letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 12px',
              }}>
                🏷️ SEASON 5 RANK
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* 썸네일 */}
                <div style={{
                  width: 72, aspectRatio: '9/16', borderRadius: 10, overflow: 'hidden',
                  flexShrink: 0,
                  boxShadow: `0 0 0 2px ${tier.color}66`,
                }}>
                  {thumbnail
                    ? <img src={safeMediaUrl(thumbnail)} alt="카드" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{
                        width: '100%', height: '100%',
                        background: `linear-gradient(135deg, ${tier.color}33, ${tier.color}11)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: 28 }}>{tier.emoji}</span>
                      </div>
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: tier.color, fontWeight: 900, fontSize: 18, margin: '0 0 4px' }}>
                    TIER: {tier.name}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 20 }}>{tier.emoji}</span>
                  </div>
                  {winRate !== null && (
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, margin: 0 }}>
                      WIN RATE: {winRate}%
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 해시태그 */}
            <p style={{
              color: 'rgba(255,255,255,0.45)', fontSize: 11, margin: '0 0 16px',
              textAlign: 'center', letterSpacing: '0.02em',
            }}>
              {HASHTAGS}
            </p>

            {/* CTA */}
            <p style={{
              color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 700,
              margin: '0 0 14px', textAlign: 'center', lineHeight: 1.5,
            }}>
              지금 바로 친구들에게<br />나의 티어를 인증해보세요!
            </p>

            {/* SNS 버튼 */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 18, width: '100%', justifyContent: 'center' }}>
              <button
                onClick={handleInstagram}
                style={{
                  flex: 1, maxWidth: 100,
                  padding: '10px 12px', borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)',
                  color: '#fff', fontWeight: 700, fontSize: 12,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Instagram size={14} /> 인스타
              </button>
              <button
                onClick={handleKakao}
                style={{
                  flex: 1, maxWidth: 100,
                  padding: '10px 12px', borderRadius: 12,
                  background: 'rgba(255,234,0,0.2)', border: '1px solid rgba(255,234,0,0.4)',
                  color: '#fee500', fontWeight: 700, fontSize: 12,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <MessageCircle size={14} /> 카톡
              </button>
              <button
                onClick={handleLinkCopy}
                style={{
                  flex: 1, maxWidth: 100,
                  padding: '10px 12px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.8)', fontWeight: 700, fontSize: 12,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Link2 size={14} /> 링크복사
              </button>
            </div>

            {/* 확인 버튼 */}
            <Link
              to="/mypage/ranking-gallery"
              onClick={() => onConfirm?.()}
              style={{
                width: '100%', padding: '14px',
                borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg,#22c55e,#16a34a)',
                color: '#fff', fontWeight: 900, fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                textDecoration: 'none',
                boxShadow: '0 4px 20px rgba(34,197,94,0.35)',
              }}
            >
              <Check size={16} /> 확인 (갤러리로)
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
