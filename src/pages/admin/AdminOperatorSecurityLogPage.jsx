import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Shield } from 'lucide-react'
import { getOperatorSecurityLogs } from '../../lib/operatorAdminStorage'

const ACTION_LABEL = {
  permission_change: '권한·상태 변경',
  delete: '계정 삭제',
  auto_suspend_idle: '자동 정지(90일 미접속)',
}

function formatDetail(detail) {
  if (!detail || typeof detail !== 'object') return ''
  try {
    return JSON.stringify(detail, null, 0)
  } catch {
    return ''
  }
}

export function AdminOperatorSecurityLogPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    void getOperatorSecurityLogs({ limit: 200 }).then((list) => {
      setRows(list)
      setLoading(false)
    })
  }, [])

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 text-sm">
          <Link to="/admin/settings" className="text-gray-500 hover:text-emerald-600">
            [⚙️ 설정]
          </Link>
          <ChevronRight size={16} className="text-gray-300" />
          <Link to="/admin/settings/operators" className="text-gray-500 hover:text-emerald-600">
            운영자 계정 관리
          </Link>
          <ChevronRight size={16} className="text-gray-300" />
          <span className="font-black text-[#22282E]">보안 로그</span>
        </div>
      </div>

      <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/80 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
          <Shield size={20} />
        </span>
        <div className="min-w-0 text-sm text-emerald-900">
          <p className="font-bold text-emerald-950">권한 변경·계정 삭제·90일 미접속 자동 정지</p>
          <p className="mt-1 font-medium leading-relaxed text-emerald-800/95">
            아래는 위 이벤트가 발생할 때마다 기록된 내역이에요. 90일 정지는 목록·로그 화면을 열 때 서버에서
            함께 적용돼요.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <h2 className="border-b border-gray-100 bg-gray-50 px-4 py-3 text-sm font-black text-[#22282E]">
          최근 기록
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="px-4 py-2.5 text-left font-bold text-gray-600">일시</th>
                <th className="px-4 py-2.5 text-left font-bold text-gray-600">유형</th>
                <th className="px-4 py-2.5 text-left font-bold text-gray-600">대상</th>
                <th className="px-4 py-2.5 text-left font-bold text-gray-600">실행 주체</th>
                <th className="px-4 py-2.5 text-left font-bold text-gray-600">비고</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    불러오는 중…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500">
                    아직 기록이 없어요.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">
                      {r.createdAt
                        ? new Date(r.createdAt).toLocaleString('ko-KR', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : '-'}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-[#22282E]">
                      {ACTION_LABEL[r.action] || r.action}
                    </td>
                    <td className="max-w-[12rem] px-4 py-2.5 text-gray-800">
                      <span className="font-mono text-xs text-gray-600">{r.targetOperatorId || '—'}</span>
                      {r.targetOperatorName && (
                        <span className="mt-0.5 block truncate text-xs font-medium">{r.targetOperatorName}</span>
                      )}
                    </td>
                    <td className="max-w-[10rem] truncate px-4 py-2.5 text-gray-700">{r.actorLabel || '—'}</td>
                    <td className="max-w-xs px-4 py-2.5 font-mono text-[11px] text-gray-500">
                      {formatDetail(r.detail)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Link
        to="/admin/settings/operators"
        className="mt-6 inline-flex text-sm font-bold text-emerald-700 hover:underline"
      >
        ← 운영자 목록으로
      </Link>
    </div>
  )
}
