import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Heart, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fetchFanCheerAlreadySent, submitFandomCheer } from '../lib/fandomCheer'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'

function isUuidString(s) {
  if (!s || typeof s !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.trim())
}

export function VictoryReportCheerPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuthStore()
  const { openLoginModal, showToast } = useUIStore()

  const ownerId = useMemo(() => {
    const raw = searchParams.get('owner')
    if (raw && isUuidString(raw)) return raw.trim()
    return null
  }, [searchParams])

  const [ownerNickname, setOwnerNickname] = useState('크리에이터')
  const [cheerBody, setCheerBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [fanCheerDone, setFanCheerDone] = useState(false)
  const [fanCheerChecking, setFanCheerChecking] = useState(false)

  useEffect(() => {
    if (!ownerId) return
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', ownerId)
        .maybeSingle()
      if (cancelled) return
      if (error || !data?.nickname) {
        setOwnerNickname('크리에이터')
        return
      }
      setOwnerNickname(data.nickname)
    })()
    return () => {
      cancelled = true
    }
  }, [ownerId])

  useEffect(() => {
    if (!ownerId || !user?.id || user.id === ownerId) {
      setFanCheerDone(false)
      setFanCheerChecking(false)
      return
    }
    let cancelled = false
    setFanCheerChecking(true)
    ;(async () => {
      const done = await fetchFanCheerAlreadySent(ownerId)
      if (cancelled) return
      setFanCheerDone(done)
      setFanCheerChecking(false)
    })()
    return () => {
      cancelled = true
    }
  }, [ownerId, user?.id])

  const isSelf = Boolean(user?.id && ownerId && user.id === ownerId)

  const handleSubmit = useCallback(async () => {
    if (!ownerId || isSelf || fanCheerDone) {
      if (import.meta.env.DEV) {
        console.warn('[VictoryReportCheer] submit skipped', { ownerId: Boolean(ownerId), isSelf, fanCheerDone })
      }
      return
    }
    if (!user?.id) {
      openLoginModal()
      return
    }
    const trimmed = cheerBody.trim()
    if (!trimmed) {
      showToast('응원 메시지를 입력해 주세요.', 'error')
      return
    }
    setSubmitting(true)
    try {
      const res = await submitFandomCheer(ownerId, trimmed)
      if (!res.ok) {
        showToast(res.error || '전송에 실패했어요.', 'error')
        if (res.duplicate) setFanCheerDone(true)
        return
      }
      setCheerBody('')
      setFanCheerDone(true)
      showToast('응원이 전해졌어요! ✨', 'success')
      // 바로 뒤로 가면 성공 토스트를 못 보는 경우가 많아 짧게 지연
      window.setTimeout(() => {
        if (window.history.length > 1) navigate(-1)
        else navigate(`/rewards/v-card?owner=${encodeURIComponent(ownerId)}`)
      }, 450)
    } finally {
      setSubmitting(false)
    }
  }, [ownerId, isSelf, fanCheerDone, user?.id, cheerBody, navigate, openLoginModal, showToast])

  if (!ownerId) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="text-sm font-bold text-slate-700">응원 대상을 찾을 수 없어요.</p>
        <Link to="/rewards" className="mt-4 inline-block text-sm font-black text-fuchsia-700 underline">
          포인트 리워드로
        </Link>
      </div>
    )
  }

  if (isSelf) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="text-sm font-bold text-slate-700">본인에게는 응원 한마디를 남길 수 없어요.</p>
        <Link to="/rewards/v-card" className="mt-4 inline-block text-sm font-black text-fuchsia-700 underline">
          V-Card 리포트로
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-[60vh] max-w-lg px-4 pb-12 pt-6">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(`/rewards/v-card?owner=${encodeURIComponent(ownerId)}`))}
        className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-fuchsia-700 hover:text-fuchsia-900"
      >
        <ArrowLeft size={18} />
        뒤로
      </button>

      <header className="mb-6 text-center">
        <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-pink-200/80 bg-white/90 px-4 py-1 text-xs font-black text-pink-700 shadow-sm">
          <Heart size={14} className="text-rose-500" fill="currentColor" />
          응원 한마디
        </p>
        <h1 className="text-xl font-black tracking-tight text-[#22282E] sm:text-2xl">
          <span className="text-fuchsia-600">{ownerNickname}</span> 님께
        </h1>
        <p className="mt-2 text-sm font-semibold text-slate-600">축하(Clap) 후 이어지는 한 줄 응원이에요.</p>
      </header>

      <section className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-white to-sky-50/70 p-5 shadow-md">
        <div className="mb-3 flex items-center gap-2 text-sky-900">
          <Sparkles className="h-5 w-5 shrink-0 text-sky-600" />
          <p className="text-sm font-black">메시지 (1-50자)</p>
        </div>
        {user?.id ? (
          fanCheerChecking ? (
            <p className="py-6 text-center text-sm font-semibold text-slate-500">확인 중…</p>
          ) : fanCheerDone ? (
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-4 py-5 text-center">
              <p className="text-sm font-black text-emerald-900">이 V-Card에는 이미 응원을 보냈어요.</p>
              <p className="mt-2 text-xs font-semibold text-emerald-800/90">계정당 한 번만 응원할 수 있어요.</p>
            </div>
          ) : (
            <>
              <textarea
                value={cheerBody}
                onChange={(e) => setCheerBody(e.target.value)}
                maxLength={50}
                rows={5}
                placeholder="예: 이번 시즌도 기대할게요!"
                className="w-full resize-y rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-sky-400/40"
              />
              <div className="mt-2 flex justify-between gap-2 text-[11px] font-semibold text-slate-500">
                <span className="min-w-0">욕설·광고성 내용은 제재될 수 있어요.</span>
                <span className="shrink-0 tabular-nums">{cheerBody.length}/50</span>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSubmit()}
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 py-3 text-sm font-black text-white shadow-md transition hover:brightness-105 disabled:opacity-50"
              >
                {submitting ? '전송 중…' : '응원 보내기'}
              </button>
            </>
          )
        ) : (
          <button
            type="button"
            onClick={() => openLoginModal()}
            className="w-full rounded-xl border-2 border-sky-400 bg-white py-3 text-sm font-black text-sky-950 hover:bg-sky-50"
          >
            로그인하고 응원 남기기
          </button>
        )}
      </section>

      <p className="mt-6 text-center text-xs text-slate-500">
        V-Card 리포트는{' '}
        <Link
          to={`/rewards/v-card?owner=${encodeURIComponent(ownerId)}`}
          className="font-bold text-fuchsia-700 underline-offset-2 hover:underline"
        >
          여기
        </Link>
        에서 다시 볼 수 있어요.
      </p>
    </div>
  )
}
