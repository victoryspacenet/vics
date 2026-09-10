import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { fetchUserEngagementForMatchups } from '../../lib/matchupUserEngagement'

const MatchupEngagementContext = createContext(null)

/**
 * 피드·목록에서 카드별 votes/likes N+1 방지
 */
export function MatchupEngagementProvider({ matchupIds, children }) {
  const { user } = useAuthStore()
  const idKey = useMemo(
    () => [...new Set((matchupIds || []).map(String).filter(Boolean))].sort().join(','),
    [matchupIds],
  )
  const [state, setState] = useState({
    ready: false,
    votesByMatchupId: {},
    likedMatchupIds: new Set(),
    votesQueryOk: true,
    likesQueryOk: true,
  })

  useEffect(() => {
    let cancelled = false
    if (!user?.id || !idKey) {
      setState({
        ready: true,
        votesByMatchupId: {},
        likedMatchupIds: new Set(),
        votesQueryOk: true,
        likesQueryOk: true,
      })
      return undefined
    }
    setState((s) => ({ ...s, ready: false }))
    const ids = idKey.split(',').filter(Boolean)
    void fetchUserEngagementForMatchups(user.id, ids).then((result) => {
      if (cancelled) return
      setState({
        ready: true,
        votesByMatchupId: result.votesByMatchupId,
        likedMatchupIds: result.likedMatchupIds,
        votesQueryOk: result.votesQueryOk !== false,
        likesQueryOk: result.likesQueryOk !== false,
      })
    })
    return () => {
      cancelled = true
    }
  }, [user?.id, idKey])

  const value = useMemo(
    () => ({
      ready: state.ready,
      votesByMatchupId: state.votesByMatchupId,
      likedMatchupIds: state.likedMatchupIds,
      votesQueryOk: state.votesQueryOk,
      likesQueryOk: state.likesQueryOk,
    }),
    [state.ready, state.votesByMatchupId, state.likedMatchupIds, state.votesQueryOk, state.likesQueryOk],
  )

  return (
    <MatchupEngagementContext.Provider value={value}>{children}</MatchupEngagementContext.Provider>
  )
}

export function useMatchupEngagement(matchupId) {
  const ctx = useContext(MatchupEngagementContext)
  if (!ctx || !matchupId) return null
  const id = String(matchupId)
  const key = id.toLowerCase()
  return {
    ready: ctx.ready,
    userVote: ctx.votesByMatchupId[id] ?? ctx.votesByMatchupId[key] ?? null,
    liked: ctx.likedMatchupIds.has(id) || ctx.likedMatchupIds.has(key),
    votesQueryOk: ctx.votesQueryOk !== false,
    likesQueryOk: ctx.likesQueryOk !== false,
  }
}
