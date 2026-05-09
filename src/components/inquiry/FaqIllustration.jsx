/** FAQ용 간단 일러스트 가이드 - 텍스트로 설명하기 어려운 기능 시각화 */

export function FaqIllustration({ type, className = '' }) {
  const base = 'rounded-xl bg-gray-50 border border-gray-100 p-4 flex items-center justify-center ' + className

  switch (type) {
    case 'points':
      return (
        <div className={base}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-2xl">🏆</div>
            <div className="text-left">
              <p className="text-xs font-bold text-amber-700">적중 시 포인트</p>
              <p className="text-[10px] text-gray-500">24시간 이내 자동 지급</p>
            </div>
          </div>
        </div>
      )
    case 'vote':
      return (
        <div className={base}>
          <div className="flex gap-2">
            <div className="w-14 h-10 rounded-lg bg-emerald-100 border-2 border-dashed border-emerald-300 flex items-center justify-center text-xs font-bold text-emerald-700">
              A
            </div>
            <span className="text-gray-400 self-center">vs</span>
            <div className="w-14 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-xs text-gray-500">
              B
            </div>
          </div>
          <p className="text-[10px] text-gray-500 mt-2">원하는 쪽 탭 → 투표 완료</p>
        </div>
      )
    case 'report':
      return (
        <div className={base}>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <div className="px-2.5 py-1.5 rounded-lg bg-fuchsia-100 text-fuchsia-800 text-xs font-black border border-fuchsia-200/60">
              1:1 문의
            </div>
            <span className="text-gray-400">→</span>
            <div className="px-2.5 py-1.5 rounded-lg bg-rose-100 text-rose-700 text-xs font-black border border-rose-200/60">
              카테고리 · 신고
            </div>
          </div>
          <p className="text-[10px] text-gray-500 mt-2 text-center">문의하기에서 접수</p>
        </div>
      )
    case 'profile':
      return (
        <div className={base}>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-emerald-100 border-2 border-emerald-200" />
            <div>
              <p className="text-xs font-bold text-gray-700">닉네임</p>
              <p className="text-[10px] text-emerald-600">마이페이지 → 프로필 수정</p>
            </div>
          </div>
        </div>
      )
    case 'ranking':
      return (
        <div className={base}>
          <div className="flex items-end justify-center gap-1.5">
            <div className="flex h-12 w-7 flex-col items-center justify-end rounded-t-md bg-slate-200 pb-1">
              <span className="text-[10px] font-black text-slate-600">2</span>
            </div>
            <div className="flex h-14 w-7 flex-col items-center justify-end rounded-t-md bg-violet-200 pb-1 ring-2 ring-violet-400/50">
              <span className="text-[10px] font-black text-violet-800">1</span>
            </div>
            <div className="flex h-10 w-7 flex-col items-center justify-end rounded-t-md bg-slate-200 pb-1">
              <span className="text-[10px] font-black text-slate-600">3</span>
            </div>
          </div>
          <p className="mt-2 text-center text-[10px] text-gray-500">랭킹 · 시즌 집계</p>
        </div>
      )
    case 'delete':
      return (
        <div className={base}>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center text-gray-500 text-lg">⚠</div>
            <div>
              <p className="text-xs font-bold text-gray-700">계정 삭제</p>
              <p className="text-[10px] text-gray-500">마이페이지 → 설정</p>
            </div>
          </div>
        </div>
      )
    default:
      return null
  }
}
