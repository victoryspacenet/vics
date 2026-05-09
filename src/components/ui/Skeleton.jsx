/**
 * 스켈레톤 UI - 로딩 시 회색 박스 플레이스홀더
 * 실시간 데이터 로드 시 화면이 텅 비어 보이지 않도록 사용
 */
export function Skeleton({ className = '', ...props }) {
  return (
    <div
      className={`bg-gray-100 rounded animate-pulse ${className}`}
      {...props}
    />
  )
}
