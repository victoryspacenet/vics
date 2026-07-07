import { X, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getMatchupTierDisplay } from '../../lib/cardDraw'
import { resolveGalleryCardImageUrl } from '../../lib/sanitize'

export function RankingCardSaveCompleteModal({
  thumbnail,
  rank,
  nickname,
  tierId = 'player',
  winRate,
  onClose,
  onConfirm,
}) {
  const tier = getMatchupTierDisplay(tierId)
  const previewUrl = resolveGalleryCardImageUrl(thumbnail)

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
            boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 24px 48px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{
            display: 'flex', justifyContent: 'flex-end',
            padding: '12px 14px 0',
          }}>
            <button
              type="button"
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

          <div style={{
            flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain',
            padding: '0 20px 24px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
          }}>
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

            <div style={{
              width: '100%',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.08)',
              padding: 16,
              marginBottom: 20,
            }}>
              <p style={{
                color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 900,
                letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 12px',
              }}>
                🏷️ SEASON 5 RANK
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 72, aspectRatio: '9/16', borderRadius: 10, overflow: 'hidden',
                  flexShrink: 0,
                  boxShadow: `0 0 0 2px ${tier.color}66`,
                }}>
                  {previewUrl ? (
                    <img src={previewUrl} alt="카드" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%',
                      background: `linear-gradient(135deg, ${tier.color}33, ${tier.color}11)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: 28 }}>{tier.emoji}</span>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: tier.color, fontWeight: 900, fontSize: 18, margin: '0 0 4px' }}>
                    TIER: {tier.name}
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, margin: '0 0 4px' }}>
                    #{rank} · {nickname}
                  </p>
                  {winRate != null && (
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, margin: 0 }}>
                      WIN RATE: {winRate}%
                    </p>
                  )}
                </div>
              </div>
            </div>

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
