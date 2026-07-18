import { ExternalLink, Link2, X } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { cn } from '../../lib/utils'
import { buildTendencyShareMiddleLine } from '../../lib/tendencyReportShare'
import { copyToClipboard } from '../../lib/utils'
import { Logo } from '../ui/Logo'

/**
 * 성향 리포트 공유 시트 — URL 복사 (카카오 미리보기: 로고 + 성향 문구 + 링크)
 */
export function TendencyReportShareSheet({
  open,
  onClose,
  report,
  shareUrl,
  showToast,
}) {
  if (!report || !shareUrl) return null

  const middleLine = buildTendencyShareMiddleLine(report)

  const handleCopyLink = async () => {
    try {
      await copyToClipboard(shareUrl)
      showToast?.(
        '링크를 복사했어요. 카카오톡에 붙이면 로고·성향 문구·링크 미리보기가 뜹니다 📋',
        'success',
      )
      onClose?.()
    } catch {
      showToast?.('복사에 실패했어요. 아래 링크를 길게 눌러 복사해 주세요', 'error')
    }
  }

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="성향 리포트 공유"
      rootClassName="z-[100050]"
      className="max-w-md border border-violet-500/20 bg-gradient-to-br from-[#1a1035] to-[#0f172a] text-white shadow-2xl"
      headerClassName="border-white/10"
      titleClassName="text-white"
      bodyClassName="space-y-4"
    >
      <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-center shadow-inner">
        <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-fuchsia-300/70">
          카카오톡 미리보기 구성
        </p>
        <div className="mx-auto flex max-w-[280px] flex-col items-center gap-3">
          <Logo size={36} dark link={false} className="opacity-90" />
          <p className="text-sm font-bold leading-snug text-violet-100/95">{middleLine}</p>
          <p className="w-full break-all border-t border-white/10 pt-3 text-[11px] font-semibold text-cyan-300/90">
            {shareUrl.replace(/^https?:\/\//, '')}
          </p>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-violet-200/55 text-center px-1">
        링크만 복사해 카톡에 붙여 넣으면, 메인 OG와 겹치지 않고 위 구성의 미리보기 카드가 표시됩니다.
      </p>

      <a
        href={shareUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'flex items-start gap-2 break-all rounded-xl border border-cyan-400/20 bg-cyan-500/5 px-3 py-2.5',
          'text-xs font-semibold text-cyan-300 underline-offset-2 hover:text-cyan-200 hover:underline',
        )}
      >
        <ExternalLink size={14} className="mt-0.5 shrink-0" aria-hidden />
        {shareUrl}
      </a>

      <button
        type="button"
        onClick={() => void handleCopyLink()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-600 py-3 text-sm font-black text-white transition hover:brightness-105"
      >
        <Link2 size={16} aria-hidden />
        링크 복사
      </button>

      <button
        type="button"
        onClick={onClose}
        className="flex w-full items-center justify-center gap-1 py-2 text-xs font-semibold text-white/45 hover:text-white/70"
      >
        <X size={14} aria-hidden />
        닫기
      </button>
    </Modal>
  )
}
