import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, X, AlertTriangle, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { getLevel, formatNumber } from '../lib/utils'

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
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
      <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
        <div
          className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden"
          style={{ animation: 'fade-in-up 0.3s cubic-bezier(0.16,1,0.3,1) both' }}
        >
          {/* 경고 아이콘 영역 */}
          <div className="bg-red-50 px-6 pt-7 pb-5 flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle size={30} className="text-red-500" />
            </div>
            <p className="text-base font-black text-[#22282E] text-center">
              마지막 확인이에요
            </p>
            <p className="text-sm text-gray-500 text-center leading-relaxed">
              <span className="font-bold text-[#22282E]">{nickname}</span>님의 계정을<br />
              <span className="text-red-500 font-bold">영구적으로 삭제</span>합니다.<br />
              이 작업은 되돌릴 수 없어요.
            </p>
          </div>

          {/* 버튼 */}
          <div className="px-6 py-5 space-y-2">
            <button
              onClick={onConfirm}
              disabled={loading}
              className="w-full py-3.5 bg-red-500 text-white rounded-2xl text-sm font-black hover:bg-red-600 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> 탈퇴 처리 중…</>
                : '💔 네, 탈퇴하겠습니다'
              }
            </button>
            <button
              onClick={onCancel}
              disabled={loading}
              className="w-full py-3 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
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
    <div className="max-w-screen-sm mx-auto min-h-screen bg-gray-50">

      {/* ── 상단 바 ── */}
      <div className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <button
          onClick={() => navigate('/mypage/edit')}
          className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={20} className="text-[#22282E]" />
        </button>
        <h1 className="text-base font-black text-[#22282E]">회원 탈퇴</h1>
        <button
          onClick={() => navigate('/mypage/edit')}
          className="px-4 py-1.5 text-sm font-bold text-gray-500 hover:text-[#22282E] transition-colors"
        >
          닫기
        </button>
      </div>

      <div className="px-4 py-5 space-y-4 pb-40">

        {/* ── 감성 헤드라인 ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6 text-center">
          <div className="text-4xl mb-3">😢</div>
          <h2 className="text-lg font-black text-[#22282E] leading-snug mb-1">
            잠깐만요, {profile?.nickname || ''}님!
          </h2>
          <p className="text-base font-bold text-gray-600">정말 저희를 떠나시나요?</p>
        </div>

        {/* ── 탈퇴 전 손실 데이터 요약 ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-gray-50">
            <span className="text-base">⚠️</span>
            <span className="text-sm font-black text-[#22282E]">탈퇴 전 꼭 확인해주세요</span>
          </div>

          <div className="px-5 py-4 space-y-3">
            {/* 안목 점수 / 티어 */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm">{levelObj.emoji}</span>
              </div>
              <div>
                <p className="text-sm font-bold text-[#22282E]">
                  <span className="text-purple-600">{levelObj.name}</span> 티어가 영구 삭제돼요
                </p>
                <p className="text-xs text-gray-400">
                  쌓아온 레벨과 안목 점수가 모두 사라져요
                </p>
              </div>
            </div>

            {/* 포인트 */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm">💎</span>
              </div>
              <div>
                <p className="text-sm font-bold text-[#22282E]">
                  보유 중인{' '}
                  <span className="text-yellow-600">{formatNumber(points)}P</span>
                  가 모두 소멸돼요
                </p>
                <p className="text-xs text-gray-400">
                  포인트는 탈퇴 시 환불되지 않아요
                </p>
              </div>
            </div>

            {/* 매치업 수 */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm">⚔️</span>
              </div>
              <div>
                <p className="text-sm font-bold text-[#22282E]">
                  생성한{' '}
                  <span className="text-orange-500">{matchupCount}개</span>의 매치업 기록이 사라져요
                </p>
                <p className="text-xs text-gray-400">
                  투표 결과와 댓글까지 모두 삭제돼요
                </p>
              </div>
            </div>
          </div>

          {/* 경고 배너 */}
          <div className="mx-4 mb-4 px-4 py-3 bg-red-50 rounded-xl border border-red-100">
            <p className="text-xs text-red-600 font-bold text-center">
              🚨 위 데이터는 탈퇴 즉시 복구가 불가능합니다
            </p>
          </div>
        </div>

        {/* ── 탈퇴 사유 수집 ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-gray-50">
            <span className="text-base">❓</span>
            <div>
              <p className="text-sm font-black text-[#22282E]">탈퇴하시려는 이유가 무엇인가요?</p>
              <p className="text-[11px] text-gray-400">더 나은 VICS를 위해 알려주세요</p>
            </div>
          </div>

          <div className="px-4 py-3 space-y-1">
            {REASONS.map((r) => (
              <button
                key={r.id}
                onClick={() => setReason(r.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${
                  reason === r.id
                    ? 'bg-[#22282E] text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {/* 라디오 도트 */}
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  reason === r.id ? 'border-white' : 'border-gray-300'
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
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#22282E] resize-none transition-colors"
                  autoFocus
                />
                <p className="text-right text-[10px] text-gray-400 mt-1">{customReason.length}/100</p>
              </div>
            )}
          </div>
        </div>

        {/* ── 동의 체크박스 ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
          <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">확인 사항</p>
          <button
            onClick={() => setAgreed(!agreed)}
            className="w-full flex items-start gap-3 text-left"
          >
            {/* 커스텀 체크박스 */}
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
              agreed ? 'bg-red-500 border-red-500' : 'border-gray-300 bg-white'
            }`}>
              {agreed && <X size={12} className="text-white" strokeWidth={3} />}
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              위 유의사항을 모두 읽었으며,{' '}
              <span className="font-bold text-[#22282E]">모든 데이터 삭제에 동의</span>
              합니다.{' '}
              <span className="text-red-500 font-bold">(필수)</span>
            </p>
          </button>
        </div>
      </div>

      {/* ── 하단 버튼 영역 (고정) ── */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-white/95 backdrop-blur-sm border-t border-gray-100 max-w-screen-sm mx-auto z-20 space-y-2">

        {/* 탈퇴하기 버튼 (조건부 활성화) */}
        <button
          onClick={() => canDelete && setShowConfirm(true)}
          disabled={!canDelete}
          className={`w-full py-3.5 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 ${
            canDelete
              ? 'bg-red-500 text-white hover:bg-red-600 active:scale-95 shadow-sm shadow-red-200'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          💔 회원 탈퇴하기
        </button>

        {/* 이탈 방지 버튼 */}
        <button
          onClick={() => navigate('/mypage/edit')}
          className="w-full py-3.5 rounded-2xl text-sm font-black bg-gradient-to-r from-lime-400 to-emerald-400 text-[#0f1f0f] shadow-md shadow-emerald-100 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all"
        >
          ✨ 좀 더 써볼게요 (취소)
        </button>
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
