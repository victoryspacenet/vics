export function MainCardSkeleton({ compact }) {
  return (
    <div className={`bg-gradient-to-br from-white to-slate-100/80 rounded-2xl border border-gray-200/70 shadow-sm p-4 animate-pulse ${compact ? 'shrink-0 w-full min-w-0' : ''}`}>
      <div className="h-4 w-3/4 bg-gray-200/80 rounded mb-3" />
      <div className="grid grid-cols-2 gap-2">
        <div className="aspect-square bg-gray-100 rounded-xl" />
        <div className="aspect-square bg-gray-100 rounded-xl" />
      </div>
      <div className="mt-3 h-3 w-20 bg-gray-200/80 rounded" />
    </div>
  )
}
