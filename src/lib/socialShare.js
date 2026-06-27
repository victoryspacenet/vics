/**
 * 매치업·페이지 SNS 공유 (웹 + Capacitor 앱)
 *
 * 카카오톡:
 * - localhost dev(브라우저): JS SDK 공유창 (링크는 VITE_SITE_ORIGIN 운영 URL)
 * - victoryspace.net: JS SDK
 * - Capacitor 앱: @capacitor/share (SDK 금지)
 * - 카카오 콘솔: JavaScript SDK 도메인에 http://localhost:5173 등록 필요
 */
import { copyToClipboard } from './utils'
import { getSiteOrigin } from './siteApiBase'
import { fetchMatchupShareBlob } from './matchupShareCompositeBrowser'

const KAKAO_SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.1/kakao.min.js'

let kakaoSdkPromise = null
let kakaoInitKey = null

async function isNativeCapacitorApp() {
  try {
    const { Capacitor } = await import('@capacitor/core')
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

function isCapacitorNativeShell() {
  if (typeof window === 'undefined') return false
  return Boolean(window.Capacitor?.isNativePlatform?.())
}

/** Capacitor androidScheme:https → https://localhost (JS SDK 도메인 등록 불가 → 4011) */
function isCapacitorHttpsLocalhostShell() {
  if (typeof window === 'undefined' || import.meta.env.DEV) return false
  const { protocol, hostname } = window.location
  return protocol === 'https:' && (hostname === 'localhost' || hostname === '127.0.0.1')
}

function isLocalhostHostname() {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1'
}

function getKakaoJsKey() {
  return String(import.meta.env.VITE_KAKAO_JS_KEY || '').trim()
}

function isLocalDevBrowser() {
  return import.meta.env.DEV && isLocalhostHostname()
}

/** Capacitor 스토어 빌드 WebView (https://localhost, DEV=false) */
function isBundledAppLocalhostShell() {
  return !import.meta.env.DEV && isLocalhostHostname()
}

function getKakaoProductionHostnames() {
  const explicit = String(import.meta.env.VITE_KAKAO_SDK_DOMAINS || '').trim()
  if (explicit) {
    return explicit.split(',').map((s) => s.trim()).filter(Boolean)
  }
  const site = getSiteOrigin()
  if (!site) return []
  try {
    return [new URL(site).hostname]
  } catch {
    return []
  }
}

function isNativeOrAppShell() {
  return (
    isCapacitorNativeShell()
    || isBundledAppLocalhostShell()
    || isCapacitorHttpsLocalhostShell()
  )
}

/** SDK 호출 가능: 운영 웹 또는 npm run dev + localhost (앱 WebView 제외) */
function canUseKakaoJsSdk() {
  if (typeof window === 'undefined') return false
  if (isNativeOrAppShell()) return false
  if (!getKakaoJsKey()) return false
  if (isLocalDevBrowser()) return true
  return isProductionKakaoWebHost()
}

/** 현재 페이지가 카카오 JS SDK를 쓸 수 있는 운영 웹 도메인인지 */
function isProductionKakaoWebHost() {
  if (typeof window === 'undefined') return false
  if (isLocalhostHostname() || isCapacitorNativeShell()) return false
  const host = window.location.hostname
  const allowed = getKakaoProductionHostnames()
  if (!allowed.length) return !isLocalhostHostname()
  return allowed.some((h) => h === host || host === `www.${h}` || h === `www.${host}`)
}

function getPublicShareOrigin() {
  const site = getSiteOrigin()
  if (site) return site.replace(/\/+$/, '')
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin
  return ''
}

/** 공유 링크 — VITE_SITE_ORIGIN 기준 운영 URL */
export function resolvePublicShareUrl(url) {
  if (!url || typeof window === 'undefined') return url || ''
  const origin = getPublicShareOrigin()
  try {
    const parsed = new URL(url, window.location.origin)
    if (!origin) return parsed.toString()
    const canonical = new URL(origin)
    const qs = parsed.searchParams.toString()
    return `${canonical.origin}${parsed.pathname}${qs ? `?${qs}` : ''}${parsed.hash}`
  } catch {
    return url
  }
}

function loadKakaoSdkOnce() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.Kakao) return Promise.resolve(window.Kakao)
  if (kakaoSdkPromise) return kakaoSdkPromise
  kakaoSdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-kakao-sdk]')
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Kakao))
      existing.addEventListener('error', () => reject(new Error('Kakao SDK')))
      return
    }
    const s = document.createElement('script')
    s.src = KAKAO_SDK_URL
    s.async = true
    s.crossOrigin = 'anonymous'
    s.dataset.kakaoSdk = '1'
    s.onload = () => resolve(window.Kakao)
    s.onerror = () => reject(new Error('Kakao SDK load failed'))
    document.head.appendChild(s)
  })
  return kakaoSdkPromise
}

function defaultOgImageUrl() {
  const origin = getPublicShareOrigin()
  return origin ? `${origin}/logo.png` : null
}

export function getMatchupShareImageUrl(matchup, _safeMediaUrlFn) {
  if (!matchup?.id) return null
  const origin = getPublicShareOrigin()
  if (!origin) return null
  // A|VS|B 합성 썸네일 (Netlify function)
  return `${origin.replace(/\/+$/, '')}/api/matchup-share-image?matchupId=${encodeURIComponent(matchup.id)}`
}

function resolveShareImageUrl(imageUrl) {
  return imageUrl || defaultOgImageUrl()
}

async function resolveShareBlob({ imageUrl, matchup, safeMediaUrlFn }) {
  return fetchMatchupShareBlob({
    imageUrl: resolveShareImageUrl(imageUrl),
    matchup,
    safeMediaUrlFn,
    baseOrigin: getPublicShareOrigin(),
  })
}

async function blobToShareFile(blob) {
  return new File([blob], 'vics-matchup-vs.jpg', { type: blob.type || 'image/jpeg' })
}

/** 모바일 네이티브 공유 시 VS 합성 JPEG 첨부 (인스타·페북·X 앱 등) */
async function tryNativeShareWithImage({ safeTitle, url, imageUrl, matchup, safeMediaUrlFn, notify }) {
  if (typeof navigator === 'undefined' || !navigator.share) return false
  try {
    const blob = await resolveShareBlob({ imageUrl, matchup, safeMediaUrlFn })
    const file = await blobToShareFile(blob)
    const payload = { title: safeTitle, text: safeTitle, url, files: [file] }
    if (navigator.canShare && !navigator.canShare(payload)) return false
    await navigator.share(payload)
    notify('공유했어요')
    return true
  } catch {
    return false
  }
}

async function saveShareImageToDevice({ imageUrl, matchup, safeMediaUrlFn }) {
  const blob = await resolveShareBlob({ imageUrl, matchup, safeMediaUrlFn })
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = 'vics-matchup-vs.jpg'
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(objectUrl), 3000)
}

async function tryCapacitorShare({ url, notify }) {
  try {
    const { Share } = await import('@capacitor/share')
    await Share.share({ url, dialogTitle: '공유하기' })
    notify('공유했어요')
    return true
  } catch (e) {
    const msg = String(e?.message || e || '')
    if (/cancel/i.test(msg)) return true
    return false
  }
}

function isKakao4011Error(err) {
  const text = `${err?.code ?? ''} ${err?.message ?? ''} ${String(err ?? '')}`
  return /4011|wrong appKey|잘못.*앱 키|invalid.*app key/i.test(text)
}

function logKakaoShareDiagnostics(context) {
  if (!import.meta.env.DEV || typeof window === 'undefined') return
  const key = getKakaoJsKey()
  console.info('[kakao-share]', context, {
    origin: window.location.origin,
    canUseSdk: canUseKakaoJsSdk(),
    isAppShell: isNativeOrAppShell(),
    keyPrefix: key ? `${key.slice(0, 8)}…` : '(empty)',
    shareUrl: getPublicShareOrigin(),
  })
}

function ensureKakaoInitialized(Kakao, jsKey) {
  if (Kakao.isInitialized() && kakaoInitKey === jsKey) return
  if (Kakao.isInitialized() && typeof Kakao.cleanup === 'function') {
    try {
      Kakao.cleanup()
    } catch {
      /* ignore */
    }
  }
  Kakao.init(jsKey)
  kakaoInitKey = jsKey
}

async function runKakaoFeedSdkShare({ safeTitle, url, imageUrl, notify }) {
  const jsKey = getKakaoJsKey()
  if (!jsKey || !canUseKakaoJsSdk()) return { ok: false, reason: 'sdk-unavailable' }
  logKakaoShareDiagnostics('before-send')
  try {
    const Kakao = await loadKakaoSdkOnce()
    ensureKakaoInitialized(Kakao, jsKey)
    if (!Kakao.isInitialized()) {
      return { ok: false, reason: 'init-failed' }
    }
    const img = imageUrl || defaultOgImageUrl()
    if (!img) throw new Error('Kakao share image required')
    await Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: safeTitle,
        // 카카오 피드: 썸네일 아래 매치업 제목만 표시 (작성자 A 설명 제외)
        description: '',
        imageUrl: img,
        link: { mobileWebUrl: url, webUrl: url },
      },
      buttons: [{ title: '매치업 보기', link: { mobileWebUrl: url, webUrl: url } }],
    })
    return { ok: true }
  } catch (e) {
    console.warn('[shareMatchupToSns] Kakao SDK failed', e)
    if (isKakao4011Error(e)) {
      notify?.(
        '카카오 JavaScript 키가 맞지 않아요. REST API 키가 아니라, localhost를 등록한 JavaScript 키 줄의 값을 .env.local에 넣고 dev 서버를 재시작해 주세요.',
        'error',
      )
      return { ok: false, reason: '4011' }
    }
    return { ok: false, reason: 'sdk-error' }
  }
}

/**
 * @param {'kakao'|'facebook'|'twitter'|'instagram'} platform
 * @param {{ title: string, url: string, imageUrl?: string | null, matchup?: object, safeMediaUrlFn?: (url: string) => string, showToast?: (msg: string, type?: string) => void }} opts
 */
export async function shareMatchupToSns(platform, opts) {
  const { title, url: rawUrl, imageUrl, matchup, safeMediaUrlFn, showToast } = opts
  const url = resolvePublicShareUrl(rawUrl)
  const enc = encodeURIComponent
  const safeTitle = (title || 'VICS 매치업').trim()
  const notify = (msg, type = 'success') => showToast?.(msg, type)
  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const shareImageCtx = { imageUrl, matchup, safeMediaUrlFn }

  const tryWebShare = async () => {
    if (!navigator.share) return false
    const payload = { title: safeTitle, text: `${safeTitle}\n${url}`, url }
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
      const isNative = isNativeOrAppShell() || await isNativeCapacitorApp()

      if (isNative) {
        if (await tryCapacitorShare({ url, notify })) return
        if (isMobile && await tryWebShare()) return
        await copyLink('링크를 복사했어요. 카카오톡에 붙여넣어 주세요 📋')
        return
      }

      const trySdk = () => runKakaoFeedSdkShare({ safeTitle, url, imageUrl, notify })

      // 웹 브라우저 (localhost dev · 운영): PC는 SDK 공유창 우선
      if (!isMobile) {
        const sdk = await trySdk()
        if (sdk.ok) return
        if (sdk.reason === '4011') {
          await copyLink('운영 링크를 복사했어요. 키 수정 후 dev 서버를 재시작해 주세요 📋')
          return
        }
      }
      if (isMobile && await tryWebShare()) return
      {
        const sdk = await trySdk()
        if (sdk.ok) return
        if (sdk.reason === '4011') {
          await copyLink('운영 링크를 복사했어요. JavaScript 키를 확인해 주세요 📋')
          return
        }
      }
      await copyLink(
        isLocalDevBrowser()
          ? '공유창을 열지 못했어요. 운영 링크를 복사했습니다 — JavaScript 키·http://localhost:5173 등록을 확인해 주세요 📋'
          : '링크를 복사했어요. 카카오톡에 붙여넣어 주세요 📋',
      )
      return
    }
    case 'facebook': {
      if (isMobile && await tryNativeShareWithImage({ safeTitle, url, notify, ...shareImageCtx })) return
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
        '_blank',
        'noopener,noreferrer,width=600,height=460',
      )
      notify('링크 미리보기에 VS 합성 썸네일이 표시돼요')
      return
    }
    case 'twitter': {
      if (isMobile && await tryNativeShareWithImage({ safeTitle, url, notify, ...shareImageCtx })) return
      const text = `${safeTitle}\n${url}`
      window.open(
        `https://x.com/intent/post?text=${enc(text)}`,
        '_blank',
        'noopener,noreferrer,width=550,height=420',
      )
      notify('게시 후 카드 미리보기에 VS 합성 썸네일이 표시돼요')
      return
    }
    case 'instagram': {
      // PC: 네이티브 공유창(취소 시 조기 종료) 대신 저장+복사. 모바일만 파일 공유 시도.
      if (isMobile && await tryNativeShareWithImage({ safeTitle, url, notify, ...shareImageCtx })) return

      // 클립보드는 사용자 클릭 제스처가 유효할 때 먼저 복사 (await 이미지 생성 전)
      let linkCopied = false
      try {
        await copyToClipboard(url)
        linkCopied = true
      } catch {
        /* 이미지 저장 후 fallback 재시도 */
      }

      try {
        await saveShareImageToDevice(shareImageCtx)
        notify(
          linkCopied
            ? (isMobile
              ? 'VS 합성 이미지 저장 + 링크 복사! 인스타 앱에서 새 게시물로 올려 주세요 📸'
              : 'VS 합성 이미지(다운로드) + 링크 복사 완료! 인스타 새 게시물에 이미지·링크를 붙여 넣어 주세요 📸')
            : (isMobile
              ? 'VS 합성 이미지 저장! 링크는 주소창에서 복사해 주세요 📸'
              : 'VS 합성 이미지(다운로드) 완료! 링크는 주소창 URL을 복사해 주세요 📸'),
          linkCopied ? 'success' : 'info',
        )
      } catch {
        if (linkCopied) {
          notify('링크는 복사됐어요. 이미지 저장만 실패했어요 — 다시 눌러 주세요 📋', 'info')
        } else {
          await copyLink('이미지 저장에 실패했어요. 링크만 복사했습니다 — 다시 시도해 주세요 📋')
        }
      }

      if (isMobile) {
        window.open('https://www.instagram.com', '_blank', 'noopener,noreferrer')
      }
      return
    }
    default:
      await copyLink()
  }
}
