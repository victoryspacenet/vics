import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X, AlertTriangle, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { getLevel, formatNumber, cn } from '../lib/utils'

/** MZ 파스텔 — 프로필 편집 계열 */
const PAGE_BG =
  'bg-gradient-to-br from-rose-50/98 via-fuchsia-50/35 to-cyan-50/50'
const SECTION_CARD =
  'rounded-2xl border border-pink-100/50 bg-white/92 shadow-[0_4px_28px_-10px_rgba(244,114,182,0.18)] backdrop-blur-[2px]'
const HEADER_GLASS =
  'bg-gradient-to-b from-white/90 via-rose-50/40 to-fuchsia-50/20 backdrop-blur-md border-b border-pink-100/55'

// ── 탈퇴 사유 ────────────────────────────────────────────────────────
const REASONS = [
  { id: 'lack_content',    label: '콘텐츠가 부족해요'      },
  { id: 'too_many_notifs', label: '알림이 너무 자주 와요'   },
  { id: 'hard_to_use',     label: '앱 사용이 어려워요'      },
  { id: 'privacy',         label: '개인정보가 걱정돼요'     },
  { id: 'other',           label: '직접 입력'               },
]

// ── 최종 확인 팝업 ──────────────────────────────────────────────────
function FinalConfirmModal({ open, nickname, onConfirm, onCancel, loading }) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 z-50 bg-fuchsia-950/30 backdrop-blur-sm" />
      <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
        <div
          className="rounded-3xl w-full max-w-sm shadow-2xl shadow-pink-200/40 overflow-hidden border border-pink-100/60 ring-2 ring-white/80
            bg-gradient-to-b from-white via-rose-50/40 to-fuchsia-50/30"
          style={{ animation: 'fade-in-up 0.3s cubic-bezier(0.16,1,0.3,1) both' }}
        >
          {/* 경고 아이콘 영역 */}
          <div className="bg-gradient-to-b from-red-50 to-rose-50/80 px-6 pt-7 pb-5 flex flex-col items-center gap-3 border-b border-red-100/50">
            <div className="w-16 h-16 rounded-full bg-red-100 border border-red-200/60 flex items-center justify-center shadow-sm">
              <AlertTriangle size={30} className="text-red-500" />
            </div>
            <p className="text-base font-black text-fuchsia-950 text-center">
              마지막 확인이에요
            </p>
            <p className="text-sm text-fuchsia-900/70 text-center leading-relaxed">
              <span className="font-bold text-fuchsia-950">{nickname}</span>님의 계정을<br />
              <span className="text-red-500 font-bold">영구적으로 삭제</span>합니다.<br />
              이 작업은 되돌릴 수 없어요.
            </p>
          </div>

          {/* 버튼 */}
          <div className="px-6 py-5 space-y-2 bg-white/50">
            <button
              onClick={onConfirm}
              disabled={loading}
              className="w-full py-3.5 bg-red-500 text-white rounded-2xl text-sm font-black hover:bg-red-600 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-md shadow-red-200/50"
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> 탈퇴 처리 중…</>
                : '💔 네, 탈퇴하겠습니다'
              }
            </button>
            <button
              onClick={onCancel}
              disabled={loading}
              className="w-full py-3.5 rounded-2xl text-sm font-black border-2 border-fuchsia-300 bg-white text-fuchsia-900 hover:bg-fuchsia-50 transition-colors disabled:opacity-50"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────
export function DeleteAccountPage() {
  const navigate  = useNavigate()
  const { user, profile, signOut } = useAuthStore()
  const { showToast } = useUIStore()

  const [matchupCount,  setMatchupCount]  = useState(0)
  const [reason,        setReason]        = useState('')
  const [customReason,  setCustomReason]  = useState('')
  const [agreed,        setAgreed]        = useState(false)
  const [showConfirm,   setShowConfirm]   = useState(false)
  const [deleting,      setDeleting]      = useState(false)

  useEffect(() => {
    if (!user) { navigate('/'); return }
    // 생성한 매치업 수 조회
    supabase
      .from('matchups')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', user.id)
      .then(({ count }) => setMatchupCount(count || 0))
  }, [user])

  const levelObj = getLevel(profile?.points || 0)
  const points   = profile?.points || 0
  const canDelete = agreed && reason !== ''

  // 최종 탈퇴 실행
  const handleDelete = async () => {
    if (!canDelete || deleting) return
    setDeleting(true)
    try {
      // 탈퇴 완료 화면에서 표시할 데이터를 먼저 저장
      sessionStorage.setItem('vics_goodbye', JSON.stringify({
        nickname:  profile?.nickname  || '',
        createdAt: profile?.created_at || null,
        points:    profile?.points    || 0,
      }))

      await supabase.from('profiles').delete().eq('id', user.id)
      await supabase.auth.signOut()
      await signOut()
      navigate('/goodbye', { replace: true })
    } catch {
      sessionStorage.removeItem('vics_goodbye')
      showToast('계정 삭제에 실패했어요. 고객센터에 문의해주세요.', 'error')
      setDeleting(false)
      setShowConfirm(false)
    }
  }

  return (
    <div className={cn('max-w-screen-sm mx-auto min-h-screen', PAGE_BG)}>

      {/* ── 상단 바 ── */}
      <div className={cn('sticky top-0 z-30 flex items-center justify-between h-14 px-4', HEADER_GLASS)}>
        <button
          onClick={() => navigate('/mypage/edit')}
          className="p-2 -ml-2 rounded-xl hover:bg-pink-100/60 transition-colors"
        >
          <ArrowLeft size={20} className="text-fuchsia-900" />
        </button>
        <h1 className="text-base font-black text-fuchsia-950">회원 탈퇴</h1>
        <button
          onClick={() => navigate('/mypage/edit')}
          className="px-4 py-1.5 text-sm font-bold text-fuchsia-700/80 hover:text-fuchsia-950 transition-colors"
        >
          닫기
        </button>
      </div>

      <div className="px-4 py-5 space-y-4 pb-8">

        {/* ── 감성 헤드라인 ── */}
        <div className={`${SECTION_CARD} px-6 py-6 text-center`}>
          <div className="text-4xl mb-3">😢</div>
          <h2 className="text-lg font-black text-fuchsia-950 leading-snug mb-1">
            잠깐만요, {profile?.nickname || ''}님!
          </h2>
          <p className="text-base font-bold text-fuchsia-800/75">정말 저희를 떠나시나요?</p>
        </div>

        {/* ── 탈퇴 전 손실 데이터 요약 ── */}
        <div className={`${SECTION_CARD} overflow-hidden`}>
          <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-pink-100/50">
            <span className="text-base">⚠️</span>
            <span className="text-sm font-black text-fuchsia-950">탈퇴 전 꼭 확인해주세요</span>
          </div>

          <div className="px-5 py-4 space-y-3">
            {/* 안목 점수 / 티어 */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-100 to-fuchsia-100 border border-violet-200/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm">{levelObj.emoji}</span>
              </div>
              <div>
                <p className="text-sm font-bold text-fuchsia-950">
                  {levelObj.emoji} 활동 등급 및 데이터가 영구 삭제돼요
                </p>
                <p className="text-xs text-fuchsia-700/55">
                  쌓아온 레벨과 안목 점수가 모두 사라져요
                </p>
              </div>
            </div>

            {/* 포인트 */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-100 to-yellow-100 border border-amber-200/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm">💎</span>
              </div>
              <div>
                <p className="text-sm font-bold text-fuchsia-950">
                  보유 중인{' '}
                  <span className="text-amber-600">{formatNumber(points)}P</span>
                  가 모두 소멸돼요
                </p>
                <p className="text-xs text-fuchsia-700/55">
                  포인트는 탈퇴 시 환불되지 않아요
                </p>
              </div>
            </div>

            {/* 매치업 수 */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-100 to-rose-100 border border-orange-200/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm">⚔️</span>
              </div>
              <div>
                <p className="text-sm font-bold text-fuchsia-950">
                  생성한{' '}
                  <span className="text-orange-500">{matchupCount}개</span>의 매치업 기록이 사라져요
                </p>
                <p className="text-xs text-fuchsia-700/55">
                  투표 결과와 댓글까지 모두 삭제돼요
                </p>
              </div>
            </div>
          </div>

          {/* 경고 배너 */}
          <div className="mx-4 mb-4 px-4 py-3 bg-gradient-to-r from-red-50 to-rose-50 rounded-xl border border-red-200/60">
            <p className="text-xs text-red-600 font-bold text-center">
              🚨 위 데이터는 탈퇴 즉시 복구가 불가능합니다
            </p>
          </div>
        </div>

        {/* ── 탈퇴 사유 수집 ── */}
        <div className={`${SECTION_CARD} overflow-hidden`}>
          <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-pink-100/50">
            <span className="text-base">❓</span>
            <div>
              <p className="text-sm font-black text-fuchsia-950">탈퇴하시려는 이유가 무엇인가요?</p>
              <p className="text-[11px] text-fuchsia-700/55">더 나은 VICS를 위해 알려주세요</p>
            </div>
          </div>

          <div className="px-4 py-3 space-y-1">
            {REASONS.map((r) => (
              <button
                key={r.id}
                onClick={() => setReason(r.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${
                  reason === r.id
                    ? 'bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white shadow-md shadow-fuchsia-300/35'
                    : 'bg-white/70 text-fuchsia-900/85 border border-pink-100/60 hover:bg-pink-50/80'
                }`}
              >
                {/* 라디오 도트 */}
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  reason === r.id ? 'border-white' : 'border-fuchsia-300'
                }`}>
                  {reason === r.id && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <span className="text-sm font-bold">{r.label}</span>
              </button>
            ))}

            {/* 직접 입력 텍스트 박스 (기타 선택 시) */}
            {reason === 'other' && (
              <div className="pt-1 pb-1">
                <textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  maxLength={100}
                  rows={3}
                  placeholder="자유롭게 의견을 남겨주세요 (최대 100자)"
                  className="w-full px-4 py-3 border border-pink-200/80 rounded-xl text-sm outline-none bg-white/90 focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200/50 resize-none transition-colors placeholder:text-fuchsia-300/80"
                  autoFocus
                />
                <p className="text-right text-[10px] text-fuchsia-700/50 mt-1">{customReason.length}/100</p>
              </div>
            )}
          </div>
        </div>

        {/* ── 동의 체크박스 ── */}
        <div className={`${SECTION_CARD} px-5 py-4`}>
          <p className="text-xs font-black text-pink-400 uppercase tracking-wider mb-3">확인 사항</p>
          <button
            onClick={() => setAgreed(!agreed)}
            className="w-full flex items-start gap-3 text-left"
          >
            {/* 커스텀 체크박스 */}
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
              agreed ? 'bg-red-500 border-red-500' : 'border-pink-300 bg-white'
            }`}>
              {agreed && <X size={12} className="text-white" strokeWidth={3} />}
            </div>
            <p className="text-sm text-fuchsia-900/80 leading-relaxed">
              위 유의사항을 모두 읽었으며,{' '}
              <span className="font-bold text-fuchsia-950">모든 데이터 삭제에 동의</span>
              합니다.{' '}
              <span className="text-red-500 font-bold">(필수)</span>
            </p>
          </button>
        </div>

        {/* ── 액션 버튼 (확인 사항 바로 아래, 스크롤 흐름에 고정) ── */}
        <div
          className={cn(
            'flex flex-col gap-2 pt-4 mt-1 rounded-2xl border border-pink-100/60',
            'bg-gradient-to-b from-white/95 via-rose-50/50 to-fuchsia-50/30 backdrop-blur-[2px]',
            'p-4 shadow-[0_4px_24px_-12px_rgba(244,114,182,0.2)]',
          )}
        >
          <button
            type="button"
            onClick={() => canDelete && setShowConfirm(true)}
            disabled={!canDelete}
            className={`w-full py-3.5 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 shrink-0 ${
              canDelete
                ? 'bg-red-500 text-white hover:bg-red-600 active:scale-95 shadow-md shadow-red-200/40'
                : 'bg-fuchsia-100/60 text-fuchsia-400/90 cursor-not-allowed border border-pink-100/60'
            }`}
          >
            💔 회원 탈퇴하기
          </button>
          <button
            type="button"
            onClick={() => navigate('/mypage/edit')}
            className="w-full min-h-[3.25rem] py-2.5 sm:py-3.5 px-2 rounded-2xl text-sm font-black bg-gradient-to-r from-lime-400 to-emerald-400 text-[#0f1f0f] shadow-md shadow-emerald-200/50 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all text-center whitespace-normal leading-snug [overflow-wrap:anywhere] shrink-0"
          >
            ✨ 좀 더 써볼게요 (취소)
          </button>
        </div>
      </div>

      {/* ── 최종 확인 팝업 ── */}
      <FinalConfirmModal
        open={showConfirm}
        nickname={profile?.nickname || ''}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}
