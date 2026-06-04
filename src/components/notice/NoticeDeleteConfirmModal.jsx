import { AlertTriangle, Trash2 } from 'lucide-react'
import { Modal } from '../ui/Modal'

/**
 * 공지 삭제 확인 모달 (팝업 공지 삭제 UX와 동일 패턴)
 * @param {boolean} isOpen
 * @param {() => void} onClose
 * @param {() => void | Promise<void>} onConfirm
 * @param {string} [title] — 모달 제목
 * @param {string} [description] — 안내 문구
 * @param {string} [itemLabel] — 삭제 대상 제목(단건) 또는 요약
 * @param {boolean} [confirming]
 */
export function NoticeDeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = '이 공지를 삭제할까요?',
  description = '삭제하면 복구할 수 없어요. 유저 공지 목록에서도 바로 사라져요.',
  itemLabel,
  confirming = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[min(22rem,calc(100vw-2rem))]" bodyClassName="p-0">
      <div className="p-6 pt-5">
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 ring-2 ring-red-100">
            <AlertTriangle size={26} className="text-red-500" strokeWidth={2.25} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-black tracking-tight text-[#22282E]">{title}</h3>
            <p className="text-sm font-medium leading-relaxed text-gray-500">{description}</p>
            {itemLabel ? (
              <p className="truncate text-xs font-bold text-gray-400">&ldquo;{itemLabel}&rdquo;</p>
            ) : null}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={confirming}
              className="flex flex-1 items-center justify-center rounded-xl border-2 border-gray-200/90 bg-white py-2.5 text-sm font-black text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={confirming}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 py-2.5 text-sm font-black text-white shadow-md shadow-red-500/25 transition hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 size={16} />
              {confirming ? '삭제 중…' : '삭제하기'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
