import { Link } from 'react-router-dom'

/**
 * VictorySpace VS 로고
 * @param {Object} props
 * @param {number} [props.size=32] - 로고 크기 (px)
 * @param {boolean} [props.dark] - 다크 배경용 (로고 색상 반전)
 * @param {boolean} [props.link] - Link로 감쌀지 (기본 true)
 * @param {string} [props.className] - 추가 클래스
 */
export function Logo({ size = 32, dark = false, link = true, className = '' }) {
  const img = (
    <img
      src="/logo.png"
      alt="VictorySpace"
      width={size}
      height={size}
      className={`object-contain ${dark ? 'invert' : ''} ${className}`}
    />
  )
  if (link) {
    return (
      <Link to="/" className="inline-flex items-center shrink-0">
        {img}
      </Link>
    )
  }
  return img
}
