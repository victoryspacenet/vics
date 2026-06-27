import { useEffect, useState } from 'react'
import { fetchTendencyReportStatus } from '../../lib/tendencyReport'
import { TendencyReportMyPageCardView } from './TendencyReportMyPageCardView'

/**
 * @param {{ userId?: string }} props
 */
export function TendencyReportMyPageCard({ userId }) {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void fetchTendencyReportStatus().then((s) => {
      if (!cancelled) setStatus(s)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  if (!status) return null

  return <TendencyReportMyPageCardView status={status} />
}
