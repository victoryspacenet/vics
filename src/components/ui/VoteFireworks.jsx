import { useEffect, useState } from 'react'

/**
 * Master 티어 이상 전용 투표 이펙트 - 클릭 시 불꽃 발사
 */
export function VoteFireworks({ trigger, x, y }) {
  const [particles, setParticles] = useState([])

  useEffect(() => {
    if (!trigger || x == null || y == null) return

    const count = 18
    const colors = ['#f59e0b', '#f97316', '#ef4444', '#fbbf24', '#fcd34d']
    const newParticles = Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.2
      const tx = Math.cos(angle) * (70 + Math.random() * 50)
      const ty = Math.sin(angle) * (70 + Math.random() * 50)
      const size = 5 + Math.random() * 6
      return {
        id: i,
        tx,
        ty,
        size,
        color: colors[i % colors.length],
      }
    })
    setParticles(newParticles)
    const t = setTimeout(() => setParticles([]), 650)
    return () => clearTimeout(t)
  }, [trigger, x, y])

  if (particles.length === 0) return null

  return (
    <div
      className="fixed pointer-events-none z-[9999]"
      style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
    >
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute left-0 top-0 rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size}px ${p.color}`,
            animation: `voteFirework 0.6s ease-out forwards`,
            transform: `translate(0, 0)`,
            ['--end-x']: `${p.tx}px`,
            ['--end-y']: `${p.ty}px`,
          }}
        />
      ))}
      <style>{`
        @keyframes voteFirework {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--end-x), var(--end-y)) scale(0.3); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
