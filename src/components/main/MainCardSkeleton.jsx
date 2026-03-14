export function MainCardSkeleton({ compact }) {
  return (
    <div className={`bg-[#1a2332] rounded-xl border border-white/10 p-4 animate-pulse ${compact ? 'shrink-0 w-full min-w-0' : ''}`}>
      <div className="h-4 w-3/4 bg-white/10 rounded mb-3" />
      <div className="grid grid-cols-2 gap-2">
        <div className="aspect-square bg-white/10 rounded-lg" />
        <div className="aspect-square bg-white/10 rounded-lg" />
      </div>
      <div className="mt-3 h-3 w-20 bg-white/10 rounded" />
    </div>
  )
}
