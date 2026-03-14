import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Check, X, Loader2, ChevronRight,
  LogOut, Trash2, Shield, Award, Pencil,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { getLevel, LEVELS } from '../lib/utils'

// ── 활동 배지 프리셋 ────────────────────────────────────────────────
const ACTIVITY_BADGES = [
  { id: 'creator_1', emoji: '🎨', name: '크리에이터',      desc: '첫 매치업 생성'      },
  { id: 'voter_10',  emoji: '🗳️', name: '투표 마니아',     desc: '10회 투표 완료'      },
  { id: 'voter_100', emoji: '⚡', name: '투표 전문가',     desc: '100회 투표 완료'     },
  { id: 'win_10',    emoji: '🎯', name: '안목 마스터',     desc: '10번 연속 정답'      },
  { id: 'trending',  emoji: '🔥', name: '트렌드세터',      desc: '핫 매치업 1위 달성'  },
  { id: 'social',    emoji: '🤝', name: '소셜 버터플라이', desc: '댓글 50개 작성'      },
  { id: 'early',     emoji: '🌟', name: '얼리어답터',      desc: '초기 가입자'         },
  { id: 'comeback',  emoji: '💪', name: '불굴의 투지',     desc: '패배 후 10회 재도전' },
]

const LEVEL_BADGES = LEVELS.map((lv) => ({
  id: `level_${lv.level}`,
  emoji: lv.emoji,
  name: lv.name,
  desc: `레벨 ${lv.level} 달성`,
}))

const ALL_BADGES = [...LEVEL_BADGES, ...ACTIVITY_BADGES]

// ── 확인 모달 ────────────────────────────────────────────────────────
function ConfirmModal({ open, title, desc, confirmLabel, danger, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-fade-in-up">
          <p className="text-base font-black text-[#22282E] text-center mb-2">{title}</p>
          <p className="text-sm text-gray-500 text-center leading-relaxed mb-6">{desc}</p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 border border-gray-200 rounded-2xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 py-3 rounded-2xl text-sm font-black transition-all ${
                danger
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-[#22282E] text-white hover:bg-[#363d46]'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── 배지 선택 Bottom Sheet ────────────────────────────────────────────
function BadgeSheet({ open, onClose, selected, onSelect }) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 max-w-screen-sm mx-auto"
        style={{ animation: 'fade-in-up 0.3s cubic-bezier(0.16,1,0.3,1) both' }}
      >
        <div className="bg-white rounded-t-3xl px-4 pt-3 pb-8 max-h-[75vh] flex flex-col">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4 flex-shrink-0" />
          <p className="text-sm font-black text-[#22282E] text-center mb-1 flex-shrink-0">🏆 대표 배지 선택</p>
          <p className="text-xs text-gray-400 text-center mb-4 flex-shrink-0">
            랭킹, 매치업 카드에 닉네임 옆에 노출됩니다
          </p>

          <div className="overflow-y-auto flex-1">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider px-1 mb-2">레벨 배지</p>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {LEVEL_BADGES.map((badge) => (
                <BadgeTile key={badge.id} badge={badge} isSelected={selected === badge.id}
                  onSelect={() => { onSelect(badge.id); onClose() }} />
              ))}
            </div>

            <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider px-1 mb-2">활동 배지</p>
            <div className="grid grid-cols-4 gap-2">
              {ACTIVITY_BADGES.map((badge) => (
                <BadgeTile key={badge.id} badge={badge} isSelected={selected === badge.id}
                  onSelect={() => { onSelect(badge.id); onClose() }} />
              ))}
            </div>

            <button
              onClick={() => { onSelect(null); onClose() }}
              className={`w-full mt-3 py-3 rounded-2xl text-sm font-bold transition-colors ${
                selected === null
                  ? 'bg-gray-100 text-[#22282E] border-2 border-[#22282E]'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              배지 표시 안 함
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function BadgeTile({ badge, isSelected, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className={`flex flex-col items-center gap-1 p-2.5 rounded-2xl border-2 transition-all ${
        isSelected
          ? 'border-[#22282E] bg-gray-50 shadow-sm scale-105'
          : 'border-transparent bg-gray-50 hover:border-gray-200'
      }`}
    >
      <span className="text-2xl">{badge.emoji}</span>
      <span className="text-[10px] font-black text-[#22282E] text-center leading-tight">{badge.name}</span>
      {isSelected && <div className="w-3 h-0.5 bg-[#22282E] rounded-full" />}
    </button>
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────
export function ProfileEditPage() {
  const navigate = useNavigate()
  const { user, profile, fetchProfile, updateProfile, signOut } = useAuthStore()
  const { showToast } = useUIStore()

  const [nickname,      setNickname]      = useState('')
  const [bio,           setBio]           = useState('')
  const [featuredBadge, setFeaturedBadge] = useState(null)
  const [nicknameStatus, setNicknameStatus] = useState('idle')
  const [saving,        setSaving]        = useState(false)
  const [badgeSheet,    setBadgeSheet]    = useState(false)
  const [logoutModal,   setLogoutModal]   = useState(false)

  const nickCheckTimer = useRef(null)

  useEffect(() => {
    if (!user) { navigate('/'); return }
    if (profile) {
      setNickname(profile.nickname || '')
      setBio(profile.bio || '')
      setFeaturedBadge(profile.featured_badge || null)
    }
  }, [profile, user])

  // 닉네임 중복 검사 (디바운스 600ms)
  const handleNicknameChange = (val) => {
    setNickname(val)
    clearTimeout(nickCheckTimer.current)
    const trimmed = val.trim()
    if (!trimmed || trimmed.length < 2) { setNicknameStatus('idle'); return }
    if (trimmed === profile?.nickname)  { setNicknameStatus('same'); return }
    setNicknameStatus('checking')
    nickCheckTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles').select('id').eq('nickname', trimmed).maybeSingle()
      setNicknameStatus(data ? 'dup' : 'ok')
    }, 600)
  }

  // 변경 여부 감지
  const hasChanges = () => {
    const trimmed = nickname.trim()
    if (nicknameStatus === 'dup' || nicknameStatus === 'checking') return false
    if (trimmed.length < 2 || trimmed.length > 12) return false
    return (
      trimmed                  !== (profile?.nickname      || '') ||
      bio                      !== (profile?.bio           || '') ||
      (featuredBadge || null)  !== (profile?.featured_badge || null)
    )
  }

  // 저장
  const handleSave = async () => {
    if (!hasChanges() || saving) return
    setSaving(true)
    try {
      const { error } = await updateProfile({
        nickname: nickname.trim(),
        bio: bio.trim() || null,
        featured_badge: featuredBadge || null,
      })
      if (error) { showToast('저장에 실패했어요. 다시 시도해주세요', 'error'); return }
      await fetchProfile(user.id)
      showToast('프로필이 업데이트되었습니다! ✓', 'success')
      navigate('/mypage')
    } catch {
      showToast('저장 중 오류가 발생했어요', 'error')
    } finally {
      setSaving(false)
    }
  }

  // 로그아웃
  const handleLogout = async () => {
    setLogoutModal(false)
    await signOut()
    navigate('/')
    showToast('로그아웃 되었습니다', 'success')
  }

  const nicknameHint = {
    idle:     null,
    checking: { text: '중복 확인 중…',             color: 'text-gray-400'    },
    ok:       { text: '✓ 사용 가능한 닉네임이에요', color: 'text-emerald-500' },
    dup:      { text: '✗ 이미 사용 중인 닉네임이에요', color: 'text-red-500' },
    same:     { text: '현재 닉네임과 동일해요',     color: 'text-gray-400'    },
  }[nicknameStatus]

  const selectedBadgeObj = featuredBadge ? ALL_BADGES.find((b) => b.id === featuredBadge) : null
  const levelObj         = getLevel(profile?.points || 0)

  return (
    <div className="max-w-screen-sm mx-auto min-h-screen bg-gray-50">

      {/* ── 상단 바 ── */}
      <div className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <button
          onClick={() => navigate('/mypage')}
          className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={20} className="text-[#22282E]" />
        </button>
        <h1 className="text-base font-black text-[#22282E]">프로필 편집</h1>
        <button
          onClick={handleSave}
          disabled={!hasChanges() || saving}
          className={`px-4 py-1.5 text-sm font-black rounded-full transition-all ${
            hasChanges() && !saving
              ? 'bg-[#22282E] text-white hover:bg-[#363d46] active:scale-95 shadow-sm'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : '완료'}
        </button>
      </div>

      <div className="px-4 py-4 space-y-3 pb-32">

        {/* ── 아바타 영역 → 사진 수정 페이지로 이동 ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center gap-3">
          <div
            className="relative cursor-pointer group"
            onClick={() => navigate('/mypage/edit/image')}
          >
            <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-gray-100">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="아바타" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                    <span className="text-3xl font-black text-gray-500">
                      {profile?.nickname?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
              }
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-full flex items-center justify-center transition-opacity">
                <Pencil size={20} className="text-white" />
              </div>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-7 h-7 bg-[#22282E] rounded-full flex items-center justify-center shadow-md">
              <Pencil size={13} className="text-white" />
            </div>
          </div>
          <p className="text-xs text-gray-400">사진을 탭하면 이미지 수정 화면으로 이동해요</p>
        </div>

        {/* ── 닉네임 수정 ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 pt-4 pb-2">
            <Pencil size={14} className="text-violet-500" />
            <span className="text-sm font-black text-[#22282E]">닉네임 수정</span>
          </div>
          <div className="px-4 pb-4">
            <div className="relative">
              <input
                type="text"
                value={nickname}
                onChange={(e) => handleNicknameChange(e.target.value)}
                maxLength={12}
                placeholder="닉네임 입력 (2~12자)"
                className={`w-full px-4 py-3 pr-16 border rounded-xl text-sm outline-none transition-colors ${
                  nicknameStatus === 'dup'
                    ? 'border-red-300 bg-red-50 focus:border-red-400'
                    : nicknameStatus === 'ok'
                    ? 'border-emerald-300 bg-emerald-50 focus:border-emerald-400'
                    : 'border-gray-200 focus:border-[#22282E]'
                }`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {nicknameStatus === 'checking' && <Loader2 size={14} className="text-gray-400 animate-spin" />}
                {nicknameStatus === 'ok'       && <Check   size={14} className="text-emerald-500" />}
                {nicknameStatus === 'dup'      && <X       size={14} className="text-red-500" />}
                <span className="text-xs text-gray-400 tabular-nums">{nickname.length}/12</span>
              </div>
            </div>
            {nicknameHint && (
              <p className={`text-xs mt-1.5 px-1 ${nicknameHint.color}`}>{nicknameHint.text}</p>
            )}
          </div>
        </div>

        {/* ── 한 줄 소개 ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 pt-4 pb-2">
            <span className="text-sm">💬</span>
            <span className="text-sm font-black text-[#22282E]">한 줄 소개</span>
          </div>
          <div className="px-4 pb-4">
            <div className="relative">
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={30}
                rows={2}
                placeholder="나를 표현하는 한 마디..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#22282E] transition-colors resize-none"
              />
              <span className="absolute right-3 bottom-3 text-[10px] text-gray-400 tabular-nums">
                {bio.length}/30
              </span>
            </div>
          </div>
        </div>

        {/* ── 대표 배지 설정 ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 pt-4 pb-2">
            <Award size={14} className="text-yellow-500" />
            <span className="text-sm font-black text-[#22282E]">대표 배지 설정</span>
          </div>
          <button
            onClick={() => setBadgeSheet(true)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors border-t border-gray-50"
          >
            <div className="flex items-center gap-3">
              {selectedBadgeObj
                ? <>
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-xl flex-shrink-0">
                      {selectedBadgeObj.emoji}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-[#22282E]">{selectedBadgeObj.name}</p>
                      <p className="text-xs text-gray-400">{selectedBadgeObj.desc}</p>
                    </div>
                  </>
                : <>
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Award size={18} className="text-gray-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-500">배지 선택하기</p>
                      <p className="text-xs text-gray-400">획득한 배지 중 노출할 것을 선택해요</p>
                    </div>
                  </>
              }
            </div>
            <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
          </button>
          <div className="mx-4 mb-4 mt-1 px-4 py-3 bg-gray-50 rounded-xl flex items-center gap-3">
            <span className="text-xl">{levelObj.emoji}</span>
            <div>
              <p className="text-xs font-bold text-[#22282E]">현재 레벨: {levelObj.name}</p>
              <p className="text-[10px] text-gray-400">레벨 배지는 자동으로 획득됩니다</p>
            </div>
          </div>
        </div>

        {/* ── 계정 이메일 ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={14} className="text-blue-500" />
            <span className="text-sm font-black text-[#22282E]">계정 이메일</span>
          </div>
          <p className="text-sm text-gray-500 pl-1">{user?.email}</p>
          {user?.app_metadata?.provider !== 'email' && (
            <p className="text-xs text-gray-400 mt-1 pl-1">소셜 로그인 계정은 이메일을 변경할 수 없어요</p>
          )}
        </div>

        {/* ── 로그아웃 / 회원탈퇴 ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setLogoutModal(true)}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <LogOut size={15} className="text-gray-500" />
            </div>
            <span className="text-sm font-bold text-gray-600">로그아웃</span>
          </button>
          <div className="h-px bg-gray-50 mx-4" />
          <button
            onClick={() => navigate('/mypage/delete')}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-red-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <Trash2 size={15} className="text-red-500" />
            </div>
            <span className="text-sm font-bold text-red-500">회원 탈퇴</span>
            <ChevronRight size={14} className="text-red-300 ml-auto" />
          </button>
        </div>

        <p className="text-[10px] text-gray-300 text-center py-2">VICS v1.0.0</p>
      </div>

      {/* ── 하단 완료 버튼 (고정) ── */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-white/95 backdrop-blur-sm border-t border-gray-100 max-w-screen-sm mx-auto z-20">
        <button
          onClick={handleSave}
          disabled={!hasChanges() || saving}
          className={`w-full py-3.5 rounded-2xl text-sm font-black transition-all ${
            hasChanges() && !saving
              ? 'bg-gradient-to-r from-lime-400 to-emerald-400 text-[#0f1f0f] shadow-md shadow-emerald-100 hover:shadow-lg hover:-translate-y-0.5 active:scale-95'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {saving
            ? <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" /> 저장 중…
              </span>
            : '완료'}
        </button>
      </div>

      <BadgeSheet open={badgeSheet} onClose={() => setBadgeSheet(false)}
        selected={featuredBadge} onSelect={setFeaturedBadge} />
      <ConfirmModal open={logoutModal} title="로그아웃 하시겠어요?"
        desc="로그아웃 후에도 언제든지 다시 로그인할 수 있어요."
        confirmLabel="로그아웃" onConfirm={handleLogout} onCancel={() => setLogoutModal(false)} />
    </div>
  )
}
