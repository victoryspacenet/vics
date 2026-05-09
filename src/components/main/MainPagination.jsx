import { ChevronLeft, ChevronRight } from 'lucide-react'

export function MainPagination({ current, total, onPage }) {
  const WINDOW = 5
  const half = Math.floor(WINDOW / 2)
  let start = Math.max(1, current - half)
  let end = Math.min(total, start + WINDOW - 1)
  if (end - start + 1 < WINDOW) start = Math.max(1, end - WINDOW + 1)
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i)

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={() => onPage(current - 1)}
        disabled={current === 1}
        className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        <ChevronLeft size={18} />
      </button>
      {start > 1 && (
        <>
          <PaginationBtn page={1} current={current} onClick={onPage} />
          {start > 2 && <span className="text-gray-300 text-sm px-1">…</span>}
        </>
      )}
      {pages.map((p) => (
        <PaginationBtn key={p} page={p} current={current} onClick={onPage} />
      ))}
      {end < total && (
        <>
          {end < total - 1 && <span className="text-gray-300 text-sm px-1">…</span>}
          <PaginationBtn page={total} current={current} onClick={onPage} />
        </>
      )}
      <button
        onClick={() => onPage(current + 1)}
        disabled={current === total}
        className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  )
}

function PaginationBtn({ page, current, onClick }) {
  const active = page === current
  return (
    <button
      onClick={() => onClick(page)}
      className={`w-10 h-10 flex items-center justify-center rounded-full text-sm font-black transition-all ${
        active ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md scale-110' : 'border-2 border-gray-200 text-gray-600 hover:bg-gray-50'
      }`}
    >
      {page}
    </button>
  )
}
