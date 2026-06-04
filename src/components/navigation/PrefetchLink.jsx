import { Link } from 'react-router-dom'
import { prefetchRoute } from '../../lib/routePrefetch'

/**
 * @param {import('react-router-dom').LinkProps} props
 */
export function PrefetchLink({ to, onPointerEnter, onFocus, onTouchStart, ...rest }) {
  const target = typeof to === 'string' ? to : typeof to?.pathname === 'string' ? to.pathname : ''

  const warm = () => {
    if (target) prefetchRoute(target)
  }

  return (
    <Link
      to={to}
      onPointerEnter={(e) => {
        warm()
        onPointerEnter?.(e)
      }}
      onFocus={(e) => {
        warm()
        onFocus?.(e)
      }}
      onTouchStart={(e) => {
        warm()
        onTouchStart?.(e)
      }}
      {...rest}
    />
  )
}
