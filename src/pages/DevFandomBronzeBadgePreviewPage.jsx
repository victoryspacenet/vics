import { useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { FandomBronzeStarBadge } from '../components/fandom/FandomBronzeStarBadge'
import { FandomGoldExclusiveEmojiBar } from '../components/fandom/FandomGoldExclusiveEmojiBar'
import { Avatar } from '../components/ui/Avatar'
import { fandomTierHasGoldProfileGlow, fandomTierHasSilverProfileGlow } from '../lib/fandomTiers'
import { cn } from '../lib/utils'

/**
 * 팬덤 브론즈 — 닉네임 옆 스타 배지 가상 화면 (`npm run dev` 전용)
 */
export function DevFandomBronzeBadgePreviewPage() {
  if (!import.meta.env.DEV) {
    return <Navigate to="/" replace />
  }

  const [emojiDemoTier, setEmojiDemoTier] = useState(/** @type {'gold'|'diamond'|'silver'} */ ('gold'))
  const [emojiDemoText, setEmojiDemoText] = useState('')
  const emojiDemoRef = useRef(null)

  const samples = [
    { tier: 'bronze', caption: 'fandom_tier = bronze → 스타 배지 표시' },
    { tier: 'silver', caption: 'silver 이상 → 브론즈 전용 배지 없음' },
    { tier: 'none', caption: 'none → 배지 없음' },
  ]

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <div>
        <h1 className="text-lg font-black text-slate-900">팬덤 브론즈 스타 배지 (가상 화면)</h1>
        <p className="mt-2 text-sm font-medium text-slate-600">
          피드·매치업 카드에서 작성자 닉네임 바로 옆에 붙는 UI와 동일한 컴포넌트입니다. 실제 앱에서는{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">profiles.fandom_tier</code> 값으로
          결정돼요.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          URL: <code className="rounded bg-violet-50 px-1">/dev/fandom-bronze-badge</code>
        </p>
      </div>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">피드 카드 작성자 줄과 유사</p>
        {samples.map(({ tier, caption }) => (
          <div
            key={tier}
            className="flex items-center gap-2 rounded-xl border border-gray-200/90 bg-white px-4 py-3 shadow-sm"
          >
            <Avatar src={null} alt="데모" size="xs" className="lg:w-8 lg:h-8" />
            <span className="text-xs font-medium text-gray-500 lg:text-sm">라이징스타닉네임</span>
            <FandomBronzeStarBadge tierId={tier} />
            <span className="ml-auto max-w-[10rem] text-right text-[10px] font-semibold leading-tight text-slate-400 sm:max-w-none">
              {caption}
            </span>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">
          골드·실버 — 프로필 테두리 글로우 (마이페이지·프로필 편집)
        </p>
        <p className="text-xs text-slate-600">
          <code className="rounded bg-slate-100 px-1 py-0.5">fandom_tier</code> 가{' '}
          <code className="rounded bg-amber-50 px-1 py-0.5">gold</code> /{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5">silver</code> 일 때와 동일한 클래스입니다.
        </p>
        <div className="flex flex-wrap items-end gap-6 pt-2">
          {['gold', 'silver', 'bronze', 'none'].map((tier) => (
            <div key={tier} className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  'rounded-2xl p-4',
                  fandomTierHasGoldProfileGlow(tier) && 'vics-fandom-gold-profile-header',
                  fandomTierHasSilverProfileGlow(tier) && 'vics-fandom-silver-profile-header',
                )}
              >
                {fandomTierHasGoldProfileGlow(tier) ? (
                  <div className="vics-fandom-gold-avatar-wrap">
                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-amber-300 to-amber-600" />
                  </div>
                ) : fandomTierHasSilverProfileGlow(tier) ? (
                  <div className="vics-fandom-silver-avatar-wrap">
                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-slate-200 to-slate-400" />
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded-full bg-pink-100 ring-4 ring-fuchsia-200/60 ring-offset-2 ring-offset-white" />
                )}
              </div>
              <span className="text-[10px] font-semibold text-slate-500">{tier}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">
          골드 전용 이모지 (매치업 댓글·답글)
        </p>
        <p className="text-xs text-slate-600">
          <code className="rounded bg-slate-100 px-1 py-0.5">gold</code> 또는{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5">diamond</code> 일 때만 바가 보입니다.
        </p>
        <div className="flex flex-wrap gap-2">
          {(['gold', 'diamond', 'silver']).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setEmojiDemoTier(t)}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors',
                emojiDemoTier === t
                  ? 'border-amber-400 bg-amber-100 text-amber-950'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100',
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <textarea
          ref={emojiDemoRef}
          value={emojiDemoText}
          onChange={(e) => setEmojiDemoText(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="아래 이모지를 눌러 삽입…"
          className="w-full rounded-xl border border-violet-200/60 bg-violet-50/30 px-3 py-2 text-sm outline-none focus:border-violet-400"
        />
        <FandomGoldExclusiveEmojiBar
          tierId={emojiDemoTier}
          textareaRef={emojiDemoRef}
          value={emojiDemoText}
          onChange={setEmojiDemoText}
          maxLength={500}
        />
      </section>

      <section className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 text-xs font-semibold text-amber-950/90">
        V-Card Clap 등으로 DB에서 <strong className="font-black">bronze</strong>가 되면, 홈 피드·매치업 상세
        댓글 등에서 위 첫 번째 줄처럼 보입니다.
      </section>
    </div>
  )
}
