import { useState, useMemo, useEffect } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronUp, ChevronDown, List, Pencil, Share2, Swords, Vote } from 'lucide-react'
import { useUIStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'
import { copyToClipboard, cn } from '../lib/utils'
import { getAdminNotices } from '../lib/noticeStorage'
import { canAccessAdmin } from '../lib/adminAuth'
import { canViewNotice, getTierById } from '../lib/tiers'
import { NoticeExposureBadge } from '../components/notice/NoticeExposureBadge'
import { buildNoticeListSearchString, parseNoticePageParam } from '../lib/noticeListNav'

/** MZ 파스텔 — 공지 목록과 동일 계열 */
const PAGE_BG =
  'bg-gradient-to-br from-rose-50/98 via-fuchsia-50/35 to-cyan-50/50'
const SECTION_CARD =
  'rounded-2xl border border-pink-100/60 bg-white/92 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px]'
const HEADER_GLASS =
  'bg-gradient-to-b from-white/90 via-rose-50/40 to-fuchsia-50/20 backdrop-blur-md border-b border-pink-100/55'

// 목업 데이터 (NoticePage와 동일)
const MOCK_NOTICES = [
  { id: '1', category: 'event', tag: '이벤트', tagColor: 'bg-amber-100 text-amber-700', title: '나이키 vs 아디다스 배틀 오픈!', date: '2026.01.24', author: '운영팀', isBanner: true, content: '역대급 브랜드 경쟁이 시작됩니다!\n\n나이키와 아디다스, 당신의 선택은?\n투표에 참여하고 포인트를 받아가세요.\n\n■ 이벤트 기간: 2026.01.24 ~ 2026.02.07\n■ 참여 방법: 해당 매치업에 투표\n■ 보상: 참여 시 포인트 10점, 적중 시 추가 포인트 20점' },
  { id: '2', category: 'notice', tag: '공지', tagColor: 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200/50', title: '시스템 점검 안내', date: '2026.01.24', author: '관리자', content: '안녕하세요, VictorySpace입니다.\n\n서비스 안정화를 위한 시스템 점검이 진행됩니다.\n\n■ 일시: 2026년 1월 25일 02:00 ~ 04:00\n■ 내용: 서버 업그레이드 및 DB 최적화\n■ 영향: 해당 시간대 서비스 이용이 일시 중단됩니다.\n\n불편을 드려 죄송합니다.' },
  { id: '3', category: 'event', tag: '이벤트', tagColor: 'bg-amber-100 text-amber-700', title: '승리 예측 성공하고 포인트 받자!', date: '2026.01.23', author: '운영팀', content: '투표 적중 시 추가 포인트 2배 이벤트!\n\n■ 기간: 2026.01.23 ~ 2026.01.30\n■ 조건: 투표한 매치업에서 승리 측 선택 시\n■ 보상: 기존 포인트 + 추가 2배 지급' },
  { id: '4', category: 'update', tag: '업데이트', tagColor: 'bg-sky-100 text-sky-800 border border-sky-200/50', title: '프로필 배지 기능 추가!', date: '2026.01.20', author: '개발팀', content: '새로운 프로필 배지 기능이 추가되었습니다.\n\n■ 크리에이터 배지: 첫 매치업 생성 시\n■ 투표 마니아: 10회 투표 완료 시\n■ 안목 마스터: 10번 연속 적중 시\n\n나의 성과를 배지로 자랑해 보세요!' },
  { id: '5', category: 'winner', tag: '당첨자', tagColor: 'bg-emerald-100 text-emerald-700', title: '1월 2주차 이벤트 당첨자 발표', date: '2026.01.18', author: '운영팀', content: '나이키 vs 아디다스 투표 이벤트 당첨자를 발표합니다.\n\n■ 1등: user_*** (포인트 500점)\n■ 2등: user_*** (포인트 300점)\n■ 3등: user_*** (포인트 100점)\n\n당첨자분들께는 1월 20일까지 포인트가 지급됩니다.' },
  { id: '6', category: 'notice', tag: '공지', tagColor: 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200/50', title: '개인정보처리방침 개정 안내', date: '2026.01.14', author: '관리자', content: '개인정보처리방침이 개정됩니다.\n\n■ 시행일: 2026년 1월 15일\n■ 주요 변경: 제3자 제공 항목 보완, 보유 기간 명시\n\n자세한 내용은 개인정보처리방침 페이지를 확인해 주세요.' },
  { id: '7', category: 'event', tag: '이벤트', tagColor: 'bg-amber-100 text-amber-700', title: '신규 가입 이벤트', date: '2026.01.12', author: '운영팀', content: '가입 시 포인트 50점을 지급합니다.\n\n■ 대상: 신규 가입자\n■ 보상: 포인트 50점\n■ 기간: 상시 진행' },
  { id: '8', category: 'update', tag: '업데이트', tagColor: 'bg-sky-100 text-sky-800 border border-sky-200/50', title: '알림 기능 개선', date: '2026.01.10', author: '개발팀', content: '실시간 알림 푸시 지원이 추가되었습니다.\n\n■ 새 기능: 투표 결과, 댓글 알림\n■ 설정: 마이페이지에서 알림 on/off 가능' },
  { id: '9', category: 'winner', tag: '당첨자', tagColor: 'bg-emerald-100 text-emerald-700', title: '1월 1주차 당첨자', date: '2026.01.08', author: '운영팀', content: '연말 이벤트 당첨자를 발표합니다.\n\n■ 당첨자: 서비스 내 알림으로 개별 안내\n■ 보상: 1월 10일까지 지급 완료' },
  { id: '10', category: 'notice', tag: '공지', tagColor: 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200/50', title: '서비스 이용 안내', date: '2026.01.05', author: '관리자', content: '이용약관 및 커뮤니티 가이드라인을 확인해 주세요.\n\n■ 이용약관: /terms\n■ 개인정보처리방침: /privacy\n■ 커뮤니티 가이드라인: /community-policy' },
  { id: '11', category: 'event', tag: '이벤트', tagColor: 'bg-amber-100 text-amber-700', title: '첫 투표 보너스', date: '2026.01.03', author: '운영팀', content: '첫 투표 시 포인트 10점을 추가로 지급합니다.\n\n■ 대상: 첫 투표 완료 유저\n■ 보상: 포인트 10점' },
  { id: '12', category: 'update', tag: '업데이트', tagColor: 'bg-sky-100 text-sky-800 border border-sky-200/50', title: '랭킹 시스템 업데이트', date: '2026.01.01', author: '개발팀', content: '시즌제 랭킹이 도입되었습니다.\n\n■ 주간/월간/전체 랭킹\n■ 시즌 종료 시 보상 지급' },
  { id: '13', category: 'winner', tag: '당첨자', tagColor: 'bg-emerald-100 text-emerald-700', title: '12월 4주차 당첨자', date: '2025.12.30', author: '운영팀', content: '연말 특별 이벤트 당첨자를 발표합니다.\n\n■ 당첨자: 개별 알림 안내' },
  { id: '14', category: 'notice', tag: '공지', tagColor: 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200/50', title: '연말 연휴 운영 안내', date: '2025.12.28', author: '관리자', content: '12/31~1/2 고객센터 휴무 안내입니다.\n\n■ 휴무: 12월 31일 ~ 1월 2일\n■ 긴급 문의: contact@victoryspace.com' },
  { id: '15', category: 'event', tag: '이벤트', tagColor: 'bg-amber-100 text-amber-700', title: '연말 경쟁 페스티벌', date: '2025.12.25', author: '운영팀', content: '12월 한 달간 특별 이벤트가 진행됩니다.\n\n■ 기간: 12월 1일 ~ 31일\n■ 보상: 참여 시 포인트 2배' },
  { id: '16', category: 'update', tag: '업데이트', tagColor: 'bg-sky-100 text-sky-800 border border-sky-200/50', title: '다크모드 지원', date: '2025.12.22', author: '개발팀', content: '눈이 편한 다크 테마가 추가되었습니다.\n\n■ 설정: 시스템 설정에 따라 자동 적용' },
  { id: '17', category: 'winner', tag: '당첨자', tagColor: 'bg-emerald-100 text-emerald-700', title: '12월 3주차 당첨자', date: '2025.12.20', author: '운영팀', content: '주간 이벤트 당첨자를 발표합니다.' },
  { id: '18', category: 'notice', tag: '공지', tagColor: 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200/50', title: '정기 점검 완료', date: '2025.12.18', author: '관리자', content: '1월 15일 정기 점검이 완료되었습니다.\n\n■ 점검 시간: 02:00 ~ 04:00\n■ 서비스 정상화 완료' },
  { id: '19', category: 'event', tag: '이벤트', tagColor: 'bg-amber-100 text-amber-700', title: '친구 초대 이벤트', date: '2025.12.15', author: '운영팀', content: '친구 초대 시 양쪽 모두 포인트를 지급합니다.\n\n■ 초대자: 포인트 30점\n■ 피초대자: 포인트 50점' },
  { id: '20', category: 'update', tag: '업데이트', tagColor: 'bg-sky-100 text-sky-800 border border-sky-200/50', title: '공지사항 페이지 오픈', date: '2025.12.12', author: '개발팀', content: '공지·이벤트·업데이트를 한곳에서 확인할 수 있습니다.\n\n■ 경로: /notice' },
  { id: '21', category: 'winner', tag: '당첨자', tagColor: 'bg-emerald-100 text-emerald-700', title: '12월 2주차 당첨자', date: '2025.12.10', author: '운영팀', content: '주간 랭킹 보상 당첨자를 발표합니다.' },
  { id: '22', category: 'notice', tag: '공지', tagColor: 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200/50', title: '개발팀 인사', date: '2025.12.08', author: '관리자', content: '새로운 개발자가 합류했습니다.\n\n앞으로 더 나은 서비스를 위해 노력하겠습니다.' },
]

const FILTER_TABS = [
  { id: 'all', label: '전체' },
  { id: 'notice', label: '공지' },
  { id: 'event', label: '이벤트' },
  { id: 'update', label: '업데이트' },
  { id: 'winner', label: '당첨자' },
]

export function NoticeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const filter = searchParams.get('filter') || 'all'
  const { showToast, openCreateDrawer, openLoginModal } = useUIStore()
  const { user, profile } = useAuthStore()

  const [adminNotices, setAdminNotices] = useState([])

  useEffect(() => {
    let cancelled = false
    const reload = () => {
      getAdminNotices().then((list) => { if (!cancelled) setAdminNotices(list) })
    }
    reload()
    window.addEventListener('vics:notices:updated', reload)
    return () => {
      cancelled = true
      window.removeEventListener('vics:notices:updated', reload)
    }
  }, [])

  const allNotices = useMemo(() => [...adminNotices, ...MOCK_NOTICES], [adminNotices])
  const notice = allNotices.find((n) => n.id === id)

  // 탭 필터에 맞는 목록 (NoticePage와 동일한 순서, 접근 가능한 것만)
  const filteredNotices = (filter === 'all' ? allNotices : allNotices.filter((n) => n.category === filter))
    .filter((n) => canViewNotice(n, profile ?? null))
  const bannerNotice = filteredNotices.find((n) => n.isBanner) || filteredNotices[0]
  const navList = bannerNotice
    ? [bannerNotice, ...filteredNotices.filter((n) => n.id !== bannerNotice.id)]
    : filteredNotices
  const currentIndex = navList.findIndex((n) => n.id === id)
  const prevNotice = currentIndex > 0 ? navList[currentIndex - 1] : null
  const nextNotice = currentIndex >= 0 && currentIndex < navList.length - 1 ? navList[currentIndex + 1] : null

  const filterParam = FILTER_TABS.some((t) => t.id === filter) ? filter : 'all'
  const listQs = buildNoticeListSearchString(filterParam, parseNoticePageParam(searchParams.get('page')))

  // 공지 없음
  if (!notice) {
    return (
      <div className={cn('min-h-screen flex flex-col items-center justify-center px-4', PAGE_BG)}>
        <div className={cn(SECTION_CARD, 'text-center px-8 py-10 max-w-sm w-full')}>
          <p className="text-sm font-medium text-fuchsia-800/75 mb-4">존재하지 않는 공지입니다.</p>
          <Link
            to={`/notice${listQs}`}
            className="text-sm font-black text-fuchsia-700 hover:text-fuchsia-900 underline decoration-fuchsia-300/80 underline-offset-2"
          >
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  // 티어 제한 공지 — 접근 차단
  if (!canViewNotice(notice, profile ?? null)) {
    const requiredTier = getTierById(notice.targetTierId)
    const exactOnly = notice.targetTierExact === true
    return (
      <div className={cn('min-h-screen flex flex-col items-center justify-center px-4', PAGE_BG)}>
        <div className={cn(SECTION_CARD, 'text-center px-8 py-10 max-w-sm w-full space-y-4')}>
          <div className="text-5xl">{requiredTier?.emoji || '🔒'}</div>
          <p className="text-base font-black text-fuchsia-950">
            {exactOnly
              ? `${requiredTier?.name || '특정'} 티어 전용 공지예요`
              : `${requiredTier?.name || '특정'} 티어 이상 공지예요`}
          </p>
          <p className="text-sm font-medium leading-relaxed text-fuchsia-700/70">
            {user
              ? exactOnly
                ? `이 공지는 ${requiredTier?.emoji} ${requiredTier?.name} 티어와 정확히 일치할 때만 볼 수 있어요.\n현재 티어를 확인해 주세요.`
                : `이 공지는 ${requiredTier?.emoji} ${requiredTier?.name} 티어 이상에게 공개돼요.\n현재 티어를 확인해 주세요.`
              : '로그인 후 본인의 티어를 확인해야 열람할 수 있어요.'}
          </p>
          {!user && (
            <button
              type="button"
              onClick={openLoginModal}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-pink-500 px-5 py-2.5 text-sm font-black text-white shadow-md shadow-fuchsia-300/35 transition hover:brightness-105"
            >
              로그인하기
            </button>
          )}
          <Link
            to={`/notice${listQs}`}
            className="block text-sm font-black text-fuchsia-600 hover:text-fuchsia-900 underline decoration-fuchsia-300/80 underline-offset-2"
          >
            공지 목록으로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('min-h-screen w-full min-w-0', PAGE_BG)}>
      <div className="max-w-2xl mx-auto w-full">
        {/* 헤더 */}
        <div className={cn('sticky top-0 z-10 px-4 py-3 flex items-center justify-between gap-3', HEADER_GLASS)}>
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-xl hover:bg-pink-100/60 transition-colors shrink-0"
              aria-label="뒤로"
            >
              <ArrowLeft size={20} className="text-fuchsia-900" />
            </button>
            <h1 className="text-lg font-black text-fuchsia-950 truncate tracking-tight">공지사항</h1>
          </div>
          {notice.category === 'event' && (
            <button
              type="button"
              onClick={async () => {
                const url = window.location.href
                const text = `${notice.title}\n${url}`
                await copyToClipboard(text)
                showToast('친구에게 공유할 링크가 복사됐어요! 💬', 'success')
              }}
              className="p-2 rounded-xl border border-amber-200/70 bg-amber-50/90 text-amber-700 hover:bg-amber-100 transition-colors shrink-0 shadow-sm"
              aria-label="공유"
            >
              <Share2 size={20} />
            </button>
          )}
        </div>

        <article className={cn(SECTION_CARD, 'mx-4 mt-4 mb-4 p-5 border-pink-100/70')}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex flex-row items-center px-2.5 py-0.5 rounded-lg text-xs font-black whitespace-nowrap [word-break:keep-all]',
                notice.tagColor
              )}
            >
              {notice.tag}
            </span>
            <NoticeExposureBadge notice={notice} className="text-[11px]" />
          </div>
          <h2 className="text-xl font-black text-fuchsia-950 mb-2 leading-snug">{notice.title}</h2>
          <p className="text-sm text-fuchsia-700/60 font-medium mb-6">
            {notice.date} | {notice.author}
          </p>
          {notice.content?.includes('<') ? (
            <div
              className="text-[15px] text-fuchsia-900/90 leading-[1.8] prose prose-p:my-2 prose-img:rounded-lg max-w-none prose-headings:text-fuchsia-950"
              dangerouslySetInnerHTML={{ __html: notice.content }}
            />
          ) : (
            <div className="text-[15px] text-fuchsia-900/90 leading-[1.8] whitespace-pre-line">
              {notice.content || ''}
            </div>
          )}
        </article>

        {/* CTA: 플랫폼 활동 유도 */}
        <div className="mx-4 mb-4 rounded-2xl border border-pink-100/70 bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-cyan-50/40 px-4 py-6 text-center shadow-sm">
          <p className="text-sm font-black text-fuchsia-950 mb-3">이 공지를 읽고 바로 참여해보세요!</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-black bg-gradient-to-r from-lime-400 to-emerald-500 text-[#0f1f0f] hover:brightness-105 transition-all shadow-md shadow-emerald-300/40 ring-1 ring-white/50"
            >
              <Vote size={18} />
              매치업 투표하러 가기
            </Link>
            <button
              type="button"
              onClick={() => (user ? openCreateDrawer() : openLoginModal())}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-black bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white hover:brightness-105 transition-all shadow-md shadow-fuchsia-300/35"
            >
              <Swords size={18} />
              매치업 만들기
            </button>
          </div>
        </div>

        {/* 하단 네비게이션 */}
        <div className="px-4 pb-8 pt-2">
          <div className={cn(SECTION_CARD, 'p-4 flex flex-wrap gap-2 justify-center items-center border-pink-100/70')}>
            {prevNotice ? (
              <Link
                to={`/notice/${prevNotice.id}${listQs}`}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-black bg-sky-100 text-sky-700 border border-sky-200/60 hover:bg-sky-200/80 transition-colors shadow-sm"
              >
                <ChevronUp size={16} />
                이전글
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold bg-sky-50 text-sky-300 border border-sky-100 cursor-not-allowed">
                <ChevronUp size={16} />
                이전글
              </span>
            )}
            {nextNotice ? (
              <Link
                to={`/notice/${nextNotice.id}${listQs}`}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-black bg-amber-100 text-amber-700 border border-amber-200/60 hover:bg-amber-200/80 transition-colors shadow-sm"
              >
                <ChevronDown size={16} />
                다음글
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold bg-amber-50 text-amber-300 border border-amber-100 cursor-not-allowed">
                <ChevronDown size={16} />
                다음글
              </span>
            )}
            <Link
              to={`/notice${listQs}`}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-black bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:brightness-105 transition-colors shadow-md shadow-emerald-300/35 ring-1 ring-white/40"
            >
              <List size={16} />
              목록으로
            </Link>
            {canAccessAdmin(user) && notice.source === 'admin' && (
              <Link
                to={`/admin/notice/edit/${notice.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-black bg-violet-100 text-violet-800 border border-violet-200/70 hover:bg-violet-200/80 transition-colors shadow-sm"
              >
                <Pencil size={16} />
                수정하기
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
