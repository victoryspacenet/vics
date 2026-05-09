import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { USER_PUBLIC_PROFILE_NAV_ENABLED } from '../../lib/userProfileNav'

/** 인라인(닉네임·아바타 래퍼 등) */
export function UserProfileLink({ userId, className, children, onClick, ...rest }) {
  if (!USER_PUBLIC_PROFILE_NAV_ENABLED || !userId) {
    return (
      <span className={cn(className, 'cursor-default')} aria-disabled="true" onClick={onClick} {...rest}>
        {children}
      </span>
    )
  }
  return (
    <Link
      to={`/profile/${userId}`}
      className={className}
      onClick={(e) => {
        onClick?.(e)
        e.stopPropagation()
      }}
      {...rest}
    >
      {children}
    </Link>
  )
}

/** 랭킹 행처럼 블록 전체 클릭 영역 */
export function UserProfileBlockLink({ userId, className, children, onClick, ...rest }) {
  if (!USER_PUBLIC_PROFILE_NAV_ENABLED || !userId) {
    return (
      <div className={cn(className, 'cursor-default')} onClick={onClick} {...rest}>
        {children}
      </div>
    )
  }
  return (
    <Link
      to={`/profile/${userId}`}
      className={className}
      onClick={(e) => {
        onClick?.(e)
        e.stopPropagation()
      }}
      {...rest}
    >
      {children}
    </Link>
  )
}
