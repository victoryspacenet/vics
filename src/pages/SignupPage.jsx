import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useUIStore } from '../store/uiStore'
import { Button } from '../components/ui/Button'
import { Logo } from '../components/ui/Logo'

export function SignupPage() {
  const navigate = useNavigate()
  const { showToast } = useUIStore()

  const [form, setForm] = useState({
    nickname: '',
    email: '',
    password: '',
    birthdate: '',
    gender: '',
  })
  const [nicknameStatus, setNicknameStatus] = useState(null) // null | 'checking' | 'available' | 'taken'
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  const set = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: null }))
  }

  const checkNickname = async () => {
    if (!form.nickname.trim()) return
    setNicknameStatus('checking')
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('nickname', form.nickname.trim())
      .maybeSingle()
    setNicknameStatus(data ? 'taken' : 'available')
  }

  const validate = () => {
    const errs = {}
    if (!form.nickname.trim()) errs.nickname = '닉네임을 입력해주세요'
    if (nicknameStatus === 'taken') errs.nickname = '이미 사용 중인 닉네임이에요'
    if (!form.email.trim()) errs.email = '이메일을 입력해주세요'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = '올바른 이메일 형식이 아니에요'
    if (!form.password || form.password.length < 6) errs.password = '비밀번호는 6자 이상이어야 해요'
    if (!form.birthdate) errs.birthdate = '생년월일을 입력해주세요'
    if (!form.gender) errs.gender = '성별을 선택해주세요'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate() || loading) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            nickname: form.nickname.trim(),
            birthdate: form.birthdate,
            gender: form.gender,
          },
        },
      })
      if (error) throw error

      // 프로필에 추가 정보 업데이트
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('profiles').upsert({
          id: user.id,
          nickname: form.nickname.trim(),
          email: form.email.trim(),
          birthdate: form.birthdate,
          gender: form.gender,
        })
      }

      showToast('회원가입 완료! 환영해요 🎉', 'success')
      navigate('/')
    } catch (err) {
      showToast(err.message || '회원가입에 실패했어요', 'error')
    } finally {
      setLoading(false)
    }
  }

  const isValid = form.nickname && form.email && form.password && form.birthdate && form.gender
    && nicknameStatus !== 'taken'

  return (
    <div className="max-w-sm mx-auto py-8 min-w-0 px-1">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <Logo size={48} dark={false} link={false} />
        </div>
        <h1 className="text-xl font-black text-[#22282E]">VICS 가입하기</h1>
        <p className="text-sm text-gray-400 mt-1">대결의 세계에 합류하세요</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 닉네임 */}
        <div>
          <label className="block text-xs font-semibold text-[#22282E] mb-2">닉네임</label>
          <div className="flex gap-2 min-w-0">
            <input
              type="text"
              value={form.nickname}
              onChange={(e) => { set('nickname', e.target.value); setNicknameStatus(null) }}
              placeholder="멋진 닉네임을 입력해요"
              className="flex-1 min-w-0 px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#22282E] transition-colors"
            />
            <button
              type="button"
              onClick={checkNickname}
              className="px-3 py-2.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors shrink-0"
            >
              중복확인
            </button>
          </div>
          {nicknameStatus === 'available' && (
            <p className="flex items-center gap-1 text-xs text-green-600 mt-1">
              <CheckCircle size={12} /> 사용 가능한 닉네임이에요
            </p>
          )}
          {nicknameStatus === 'taken' && (
            <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
              <AlertCircle size={12} /> 이미 사용 중인 닉네임이에요
            </p>
          )}
          {errors.nickname && (
            <p className="text-xs text-red-500 mt-1">{errors.nickname}</p>
          )}
        </div>

        {/* 이메일 */}
        <div>
          <label className="block text-xs font-semibold text-[#22282E] mb-2">이메일</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="example@email.com"
            className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#22282E] transition-colors"
          />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
        </div>

        {/* 비밀번호 */}
        <div>
          <label className="block text-xs font-semibold text-[#22282E] mb-2">비밀번호</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            placeholder="6자 이상 입력해요"
            className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#22282E] transition-colors"
          />
          {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
        </div>

        {/* 생년월일 */}
        <div>
          <label className="block text-xs font-semibold text-[#22282E] mb-2">생년월일</label>
          <input
            type="date"
            value={form.birthdate}
            onChange={(e) => set('birthdate', e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#22282E] transition-colors"
          />
          {errors.birthdate && <p className="text-xs text-red-500 mt-1">{errors.birthdate}</p>}
        </div>

        {/* 성별 */}
        <div>
          <label className="block text-xs font-semibold text-[#22282E] mb-2">성별</label>
          <div className="grid grid-cols-2 gap-2">
            {[{ id: 'male', label: '남성' }, { id: 'female', label: '여성' }].map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => set('gender', g.id)}
                className={`py-2.5 text-sm font-medium rounded-xl border transition-all ${
                  form.gender === g.id
                    ? 'border-[#22282E] bg-[#22282E] text-white'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          {errors.gender && <p className="text-xs text-red-500 mt-1">{errors.gender}</p>}
        </div>

        <Button size="full" disabled={!isValid || loading} className="mt-2">
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              가입 중...
            </span>
          ) : '회원가입 완료'}
        </Button>
      </form>

      <p className="text-center text-sm text-gray-400 mt-6">
        이미 계정이 있으신가요?{' '}
        <Link to="/login" className="text-[#22282E] font-semibold hover:underline">로그인</Link>
      </p>
    </div>
  )
}
