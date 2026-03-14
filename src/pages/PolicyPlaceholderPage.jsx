export function PolicyPlaceholderPage({ title }) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="text-center text-gray-500">
        <p className="text-lg font-bold mb-2">{title}</p>
        <p className="text-sm">준비 중입니다.</p>
      </div>
    </div>
  )
}
