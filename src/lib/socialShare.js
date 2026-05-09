/**
 * 매치업·페이지 SNS 공유 (웹)
 * - 카카오: VITE_KAKAO_JS_KEY 있으면 카카오톡 공유(피드), 없으면 Web Share API 또는 링크 복사
 * - 페이스북 / X: 공식 공유 URL 새 창
 * - 인스타그램: 웹 공유 API 없음 → 링크 복사
 */
import { copyToClipboard } from './utils'

const KAKAO_SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js'

let kakaoSdkPromise = null

function loadKakaoSdkOnce() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.Kakao) return Promise.resolve(window.Kakao)
  if (kakaoSdkPromise) return kakaoSdkPromise
  kakaoSdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-kakao-sdk]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Kakao))
      existing.addEventListener('error', () => reject(new Error('Kakao SDK')))
      return
    }
    const s = document.createElement('script')
    s.src = KAKAO_SDK_URL
    s.async = true
    s.dataset.kakaoSdk = '1'
    s.onload = () => resolve(window.Kakao)
    s.onerror = () => reject(new Error('Kakao SDK load failed'))
    document.head.appendChild(s)
  })
  return kakaoSdkPromise
}

/** 매치업 썸네일 등 공유용 절대 HTTPS 이미지 URL (카카오 피드용) */
export function getMatchupShareImageUrl(matchup, safeMediaUrlFn) {
  if (!matchup || typeof safeMediaUrlFn !== 'function') return null
  const raw =
    matchup.left_thumbnail_url ||
    (matchup.left_type === 'image' ? matchup.left_url : null) ||
    matchup.right_thumbnail_url ||
    (matchup.right_type === 'image' ? matchup.right_url : null)
  if (!raw) return null
  const u = safeMediaUrlFn(raw)
  if (!u) return null
  if (/^https:\/\//i.test(u)) return u
  if (u.startsWith('//')) return `https:${u}`
  if (typeof window !== 'undefined' && u.startsWith('/')) return `${window.location.origin}${u}`
  return null
}

function defaultOgImageUrl() {
  if (typeof window === 'undefined') return null
  return `${window.location.origin}/logo.png`
}

/**
 * @param {'kakao'|'facebook'|'twitter'|'instagram'} platform
 * @param {{ title: string, description?: string, url: string, imageUrl?: string | null, showToast?: (msg: string, type?: string) => void }} opts
 */
export async function shareMatchupToSns(platform, opts) {
  const { title, description = '', url, imageUrl, showToast } = opts
  const enc = encodeURIComponent
  const safeTitle = (title || 'VICS 매치업').trim()
  const safeDesc = (description || '').trim().slice(0, 200)
  const notify = (msg, type = 'success') => showToast?.(msg, type)

  const tryWebShare = async () => {
    if (!navigator.share) return false
    const payload = {
      title: safeTitle,
      text: `${safeTitle}\n${url}`,
      url,
    }
    try {
      if (navigator.canShare && !navigator.canShare(payload)) return false
      await navigator.share(payload)
      notify('공유했어요')
      return true
    } catch (e) {
      if (e?.name === 'AbortError') return true
      return false
    }
  }

  const copyLink = async (hint) => {
    try {
      await copyToClipboard(url)
      notify(hint || '링크를 복사했어요')
    } catch {
      notify('복사에 실패했어요. 주소창의 링크를 직접 복사해 주세요', 'error')
    }
  }

  switch (platform) {
    case 'kakao': {
      const jsKey = import.meta.env.VITE_KAKAO_JS_KEY
      if (jsKey) {
        try {
          const Kakao = await loadKakaoSdkOnce()
          if (!Kakao.isInitialized()) Kakao.init(jsKey)
          const img = imageUrl || defaultOgImageUrl()
          await Kakao.Share.sendDefault({
            objectType: 'feed',
            content: {
              title: safeTitle,
              description: safeDesc || 'VICS에서 경쟁을 확인해 보세요',
              imageUrl: img,
              link: { mobileWebUrl: url, webUrl: url },
            },
            buttons: [{ title: '매치업 보기', link: { mobileWebUrl: url, webUrl: url } }],
          })
          return
        } catch (e) {
          console.warn('[shareMatchupToSns] Kakao', e)
        }
      }
      if (await tryWebShare()) return
      await copyLink('링크를 복사했어요. 카카오톡 채팅에 붙여넣어 주세요')
      return
    }
    case 'facebook': {
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
        '_blank',
        'noopener,noreferrer,width=600,height=460'
      )
      return
    }
    case 'twitter': {
      const text = `${safeTitle}\n${url}`
      window.open(
        `https://x.com/intent/post?text=${enc(text)}`,
        '_blank',
        'noopener,noreferrer,width=550,height=420'
      )
      return
    }
    case 'instagram': {
      await copyLink('링크를 복사했어요. 인스타그램 스토리·게시에 붙여넣어 주세요')
      return
    }
    default:
      await copyLink()
  }
}
