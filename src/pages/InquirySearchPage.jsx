import { useState, useMemo, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Search } from 'lucide-react'
import { cn } from '../lib/utils'
import { LAYOUT_CONTENT_MAX_WIDTH_CLASS } from '../lib/layoutShellClasses'

const ALL_FAQ = [
  { id: '1', question: '승리 포인트는 언제 들어오나요?', category: 'matchup', keywords: ['포인트', '승리', '적중'] },
  { id: '2', question: '주제와 상관없는 글 신고는 어디서?', category: 'report', keywords: ['신고', '글', '신고하기'] },
  { id: '3', question: '닉네임 변경하고 싶어요!', category: 'account', keywords: ['닉네임', '변경', '프로필'] },
  { id: '4', question: '투표는 어떻게 하나요?', category: 'matchup', keywords: ['투표', '매치업'] },
  { id: '5', question: '계정 삭제는 어떻게 하나요?', category: 'account', keywords: ['계정', '삭제', '탈퇴'] },
  { id: '6', question: 'ㅎㅎㅎ', category: 'matchup', keywords: ['매치업', '투표'] },
  { id: '7', question: '시즌제 랭킹이 무엇인가요?', category: 'ranking', keywords: ['랭킹', '시즌', '순위'] },
  { id: '8', question: '랭킹 축하 보너스 금액 기준은?', category: 'ranking', keywords: ['랭킹', '축하', '보너스', 'TOP10', '포인트'] },
]

export function InquirySearchPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const qFromUrl = searchParams.get('q') || ''
  const [query, setQuery] = useState(qFromUrl)

  useEffect(() => {
    setQuery(qFromUrl)
  }, [qFromUrl])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return ALL_FAQ.filter(
      (f) =>
        f.question.toLowerCase().includes(q) ||
        f.keywords.some((k) => k.includes(q) || q.includes(k))
    )
  }, [query])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className={cn(LAYOUT_CONTENT_MAX_WIDTH_CLASS, 'mx-auto')}>
        <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100"
            aria-label="뒤로"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="포인트, 계정, 신고..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              autoFocus
            />
          </div>
        </div>

        <div className="px-4 py-6">
          {query.trim() ? (
            results.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-500 mb-4">검색 결과 {results.length}건</p>
                {results.map((r) => (
                  <Link
                    key={r.id}
                    to={`/inquiry/faq/${r.id}`}
                    className="block p-4 bg-white rounded-xl border border-gray-100 hover:border-gray-200"
                  >
                    <p className="text-sm font-semibold text-[#22282E]">{r.question}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">검색 결과가 없어요.</p>
                <Link
                  to="/inquiry/form"
                  className="text-emerald-600 font-bold hover:underline"
                >
                  1:1 문의하기 →
                </Link>
              </div>
            )
          ) : (
            <p className="text-gray-500 text-sm">검색어를 입력해 주세요.</p>
          )}
        </div>
      </div>
    </div>
  )
}
