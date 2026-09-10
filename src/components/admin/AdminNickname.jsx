import { cn } from '../../lib/utils'
import { isSpectatorBotUser } from '../../lib/adminSpectatorBot'

/**
 * 관리자 전용 닉네임 표시. 관전봇이면 닉네임 뒤에 뱃지만 붙입니다.
 * 공개 피드·랭킹에는 쓰지 마세요.
 */
export function AdminNickname({
  nickname,
  isBot,
  user,
  className,
  nickClassName,
  as: Comp = 'span',
}) {
  const bot = isBot === true || isSpectatorBotUser(user) || isSpectatorBotUser({ is_bot: isBot })
  const name = String(nickname || user?.nickname || '').trim() || '-'

  return (
    <Comp className={cn('inline-flex max-w-full items-center gap-1.5', className)}>
      <span className={cn('truncate', nickClassName)}>{name}</span>
      {bot ? (
        <span className="shrink-0 rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-black leading-none tracking-tight text-white">
          관전봇
        </span>
      ) : null}
    </Comp>
  )
}
