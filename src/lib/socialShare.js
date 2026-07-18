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

function recordShareSuccess(kind = 'matchup') {
  void import('./userShareEvent').then(({ logUserShareEvent }) => logUserShareEvent(kind))
}

const KAKAO_SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.1/kakao.min.js'

let kakaoSdkPromise = null
let kakaoInitKey = null

export async function isNativeCapacitorApp() {
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (Capacitor.isNativePlatform()) return true
    const platform = Capacitor.getPlatform?.()
    return Boolean(platform && platform !== 'web')
  } catch {
    return false
  }
}

/**
 * Capacitor 네이티브 셸 판별 — 개발자 빌드(라이브리로드 등)에서 isNativePlatform()이
 * 예상과 다르게 동작할 수 있어 여러 신호를 함께 확인한다.
 */
function isCapacitorNativeShell() {
  if (typeof window === 'undefined') return false
  const cap = window.Capacitor
  if (!cap) return false
  if (cap.isNativePlatform?.()) return true
  const platform = cap.getPlatform?.()
  // getPlatform()이 'web'이면 브라우저(또는 @capacitor/core만 번들된 PWA)이므로
  // window.Capacitor가 존재해도 네이티브로 취급하지 않는다.
  return Boolean(platform && platform !== 'web')
}

/** iOS 기본 스킴(capacitor://localhost) 등 네이티브 전용 프로토콜 */
function isCapacitorSchemeShell() {
  if (typeof window === 'undefined') return false
  const { protocol } = window.location
  return protocol === 'capacitor:' || protocol === 'ionic:'
}

/** Capacitor androidScheme:https → https://localhost (JS SDK 도메인 등록 불가 → 4011) */
function isCapacitorHttpsLocalhostShell() {
  if (typeof window === 'undefined') return false
  const { protocol, hostname } = window.location
  return protocol === 'https:' && (hostname === 'localhost' || hostname === '127.0.0.1')
}

function isLocalhostHostname() {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1'
}

function getKakaoJsKey() {
  const raw = String(import.meta.env.VITE_KAKAO_JS_KEY || '')
  if (!raw) return ''
  // Netlify/복붙 시 따옴표·개행·제로폭 공백(ZWSP)·BOM이 섞이면 카카오 4011
  const cleaned = raw
    .replace(/^['"]|['"]$/g, '')
    .replace(/[\s\u200B-\u200D\uFEFF]/g, '')
  if (import.meta.env.DEV && cleaned && !/^[0-9a-fA-F]{32}$/.test(cleaned)) {
    console.warn(
      '[kakao-share] VITE_KAKAO_JS_KEY가 일반적인 카카오 키 형식(32자리 16진수)이 아니에요. ' +
        `length=${cleaned.length}. 카카오 콘솔의 "JavaScript 키" 값을 다시 복사해 주세요.`,
    )
  }
  return cleaned
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
    || isCapacitorSchemeShell()
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

/** 랭킹 갤러리 공유 — 랭킹 페이지 URL (항상 /ranking 경로) */
export function getRankingPageShareUrl() {
  if (typeof window === 'undefined') {
    const site = getPublicShareOrigin()
    return site ? `${site}/ranking` : 'https://www.victoryspace.net/ranking'
  }
  const origin = getPublicShareOrigin() || window.location.origin
  try {
    return new URL('/ranking', origin.endsWith('/') ? origin : `${origin}/`).href
  } catch {
    return resolvePublicShareUrl(`${window.location.origin}/ranking`)
  }
}

/** @param {{ rank?: number, nickname?: string, tierName?: string }} opts */
export function buildRankingGalleryShareHeadline(nickname) {
  return nickname ? `${nickname}님의 VICS 랭킹 카드 🏆` : '나의 VICS 랭킹 카드 🏆'
}

export function buildRankingGalleryShareSubline(rank, tierName) {
  return [rank != null ? `#${rank}` : '', tierName || ''].filter(Boolean).join(' · ')
}

/** @param {{ rank?: number, nickname?: string, tierName?: string }} opts */
export function buildRankingGalleryShareText({ rank, nickname, tierName } = {}) {
  const url = getRankingGallerySharePageUrl({ rank, nickname, tierName })
  const lines = [buildRankingGalleryShareHeadline(nickname)]
  const sub = buildRankingGalleryShareSubline(rank, tierName)
  if (sub) lines.push(sub)
  lines.push('', 'VictorySpace에서 나도 도전해 보세요 👇', url)
  return lines.join('\n')
}

function buildRankingShareQueryString({ nickname, rank, tierName, cardId } = {}) {
  const qs = new URLSearchParams()
  if (rank != null && rank !== '') qs.set('rank', String(rank))
  if (tierName) qs.set('tier', tierName)
  if (nickname) qs.set('nickname', nickname)
  if (cardId) qs.set('sid', String(cardId).slice(0, 12))
  const s = qs.toString()
  return s ? `?${s}` : ''
}

/** 카카오·SNS 링크 미리보기용 공유 URL (OG 주입 — /ranking/share) */
export function getRankingGallerySharePageUrl({ nickname, rank, tierName, cardId } = {}) {
  if (typeof window === 'undefined') {
    const site = getPublicShareOrigin() || 'https://www.victoryspace.net'
    return `${site.replace(/\/+$/, '')}/ranking/share${buildRankingShareQueryString({ nickname, rank, tierName, cardId })}`
  }
  const qs = buildRankingShareQueryString({ nickname, rank, tierName, cardId })
  return resolvePublicShareUrl(`${window.location.origin}/ranking/share${qs}`)
}

/** @param {{ nickname?: string, rank?: number, tierName?: string, thumbnailUrl?: string }} opts */
export function getRankingShareImageUrl({ nickname, rank, tierName, thumbnailUrl } = {}) {
  const origin = getPublicShareOrigin()
  if (!origin) return defaultOgImageUrl()
  const qs = new URLSearchParams()
  if (rank != null && rank !== '') qs.set('rank', String(rank))
  if (tierName) qs.set('tier', tierName)
  if (nickname) qs.set('nickname', nickname)
  if (thumbnailUrl && /^https:\/\//i.test(thumbnailUrl)) qs.set('thumb', thumbnailUrl)
  return `${origin.replace(/\/+$/, '')}/api/ranking-share-image?${qs.toString()}`
}

export function buildRankingGalleryShareDescription({ rank, tierName } = {}) {
  const lines = []
  const sub = buildRankingGalleryShareSubline(rank, tierName)
  if (sub) lines.push(sub)
  lines.push('VictorySpace에서 나도 도전해 보세요 👇')
  return lines.join('\n')
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

export const DEFAULT_OG_IMAGE_PATH = '/api/site-og-image'

function defaultOgImageUrl() {
  const origin = getPublicShareOrigin()
  return origin ? `${origin.replace(/\/+$/, '')}${DEFAULT_OG_IMAGE_PATH}` : null
}

export function getMatchupShareImageUrl(matchup, _safeMediaUrlFn) {
  if (!matchup?.id) return null
  const origin = getPublicShareOrigin()
  if (!origin) return null
  // A|VS|B 합성 썸네일 (Netlify function)
  return `${origin.replace(/\/+$/, '')}/api/matchup-share-image?matchupId=${encodeURIComponent(matchup.id)}`
}

/** 카카오·링크 미리보기용 공유 URL (OG 주입 — /matchup/share/:id) */
export function getMatchupSharePageUrl(matchupId) {
  if (!matchupId) return ''
  const id = encodeURIComponent(String(matchupId))
  if (typeof window === 'undefined') {
    const site = getPublicShareOrigin() || 'https://www.victoryspace.net'
    return `${site.replace(/\/+$/, '')}/matchup/share/${id}`
  }
  return resolvePublicShareUrl(`${window.location.origin}/matchup/share/${id}`)
}

/** 매치업 상세 페이지 URL (앱 내 이동·북마크) */
export function getMatchupDetailPageUrl(matchupId) {
  if (!matchupId) return ''
  const id = encodeURIComponent(String(matchupId))
  if (typeof window === 'undefined') {
    const site = getPublicShareOrigin() || 'https://www.victoryspace.net'
    return `${site.replace(/\/+$/, '')}/matchup/${id}`
  }
  return resolvePublicShareUrl(`${window.location.origin}/matchup/${id}`)
}

/** @param {{ matchupId: string, matchup?: object }} opts */
export async function warmMatchupSharePreview({ matchupId, matchup } = {}) {
  const id = matchupId || matchup?.id
  if (!id) return

  const shareUrl = getMatchupSharePageUrl(id)
  const imageUrl = matchup
    ? getMatchupShareImageUrl(matchup)
    : (() => {
        const origin = getPublicShareOrigin()
        return origin
          ? `${origin.replace(/\/+$/, '')}/api/matchup-share-image?matchupId=${encodeURIComponent(String(id))}`
          : null
      })()

  const tasks = []
  if (shareUrl && /^https:\/\//i.test(shareUrl)) {
    tasks.push(fetch(shareUrl, { mode: 'no-cors', cache: 'no-store' }).catch(() => {}))
  }
  if (imageUrl && /^https:\/\//i.test(imageUrl)) {
    tasks.push(fetch(imageUrl, { mode: 'no-cors', cache: 'no-store' }).catch(() => {}))
  }
  await Promise.allSettled(tasks)
}

/** @param {{ matchupId: string, matchup?: object, title?: string, showToast?: (msg: string, type?: string) => void }} opts */
export async function copyMatchupShareLink({ matchupId, matchup, title, showToast }) {
  const url = getMatchupSharePageUrl(matchupId)
  if (!url) {
    showToast?.('공유 링크를 만들 수 없어요', 'error')
    return false
  }
  try {
    await warmMatchupSharePreview({ matchupId, matchup })
    const clipText = title ? `${String(title).trim()}\n${url}` : url
    await copyToClipboard(clipText)
    showToast?.('링크를 복사했어요. 카카오톡에 붙여넣으면 VS 썸네일 미리보기가 뜹니다', 'success')
    return true
  } catch {
    showToast?.('복사에 실패했어요. 주소창의 링크를 직접 복사해 주세요', 'error')
    return false
  }
}

function resolveHttpsShareImageUrl(imageUrl) {
  const candidates = [imageUrl, defaultOgImageUrl()].filter(Boolean)
  for (const raw of candidates) {
    if (typeof raw === 'string' && /^https:\/\//i.test(raw)) return raw
  }
  return null
}

/** 카카오 피드 공유용 — 링크·이미지는 https 운영 도메인 권장 */
function getKakaoFeedShareOrigin() {
  const site = getSiteOrigin()
  if (site && /^https:\/\//i.test(site)) return site
  if (typeof window !== 'undefined' && /^https:\/\//i.test(window.location.origin)) {
    if (!isLocalhostHostname()) return window.location.origin
  }
  return ''
}

function validateKakaoSdkSharePayload({ url, imageUrl }) {
  const jsKey = getKakaoJsKey()
  if (!jsKey) return { ok: false, reason: 'no-key' }
  if (isNativeOrAppShell()) return { ok: false, reason: 'app-shell' }

  const feedOrigin = getKakaoFeedShareOrigin()
  if (!feedOrigin) {
    return { ok: false, reason: 'no-https-origin' }
  }

  const shareUrl = resolvePublicShareUrl(url)
  if (!shareUrl || !/^https:\/\//i.test(shareUrl)) {
    return { ok: false, reason: 'http-share-url' }
  }

  const img = resolveHttpsShareImageUrl(imageUrl)
  if (!img) return { ok: false, reason: 'http-image-url' }

  return { ok: true, shareUrl, imageUrl: img }
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

function blobToDataUri(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('blob read failed'))
    reader.readAsDataURL(blob)
  })
}

const NATIVE_GALLERY_ALBUM_NAME = 'VICS'

/** Android: 앱 전용 앨범(`VICS`)이 없으면 만들고 identifier를 반환. iOS는 앨범 없이도 저장 가능. */
async function ensureNativeGalleryAlbumId(Media, Capacitor) {
  if (Capacitor.getPlatform() !== 'android') return undefined
  const findAlbum = async () => {
    const { albums } = await Media.getAlbums()
    const { path: albumsPath } = await Media.getAlbumsPath()
    return albums.find(
      (a) => a.name === NATIVE_GALLERY_ALBUM_NAME && a.identifier.startsWith(albumsPath),
    )
  }
  const existing = await findAlbum()
  if (existing) return existing.identifier
  await Media.createAlbum({ name: NATIVE_GALLERY_ALBUM_NAME })
  const created = await findAlbum()
  return created?.identifier
}

/**
 * Capacitor 네이티브 앱(WebView)에서는 `<a download>`·`navigator.share` 파일 첨부가
 * 안정적으로 동작하지 않아, 사진첩(카메라 롤)에 직접 저장한다 (`@capacitor-community/media`).
 * 웹(모바일 브라우저·PC)에서는 지원되지 않으므로 호출 전 네이티브 여부를 확인해야 한다.
 * @param {Blob} blob
 * @param {{ fileName?: string }} [opts]
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function saveImageBlobToNativeGallery(blob, { fileName = 'vics-matchup-vs', useAppAlbum = false } = {}) {
  try {
    const [{ Media }, { Capacitor }] = await Promise.all([
      import('@capacitor-community/media'),
      import('@capacitor/core'),
    ])
    const dataUri = await blobToDataUri(blob)
    const albumIdentifier = useAppAlbum
      ? await ensureNativeGalleryAlbumId(Media, Capacitor)
      : undefined
    await Media.savePhoto({
      path: dataUri,
      fileName,
      ...(albumIdentifier ? { albumIdentifier } : {}),
    })
    return { ok: true }
  } catch (e) {
    console.warn('[socialShare] saveImageBlobToNativeGallery failed', e)
    return { ok: false, reason: e?.code || e?.message || 'save-failed' }
  }
}

export function isMobileShareDevice() {
  if (typeof navigator === 'undefined') return false
  return isIosDevice() || isAndroidDevice()
}

/** 모바일 브라우저 — data URL 다운로드(Android) 또는 공유 시트「이미지 저장」(iOS) */
export async function saveImageBlobToMobileWebGallery(blob, { fileName = 'vics-matchup-vs.jpg' } = {}) {
  const file = await blobToShareFile(blob)
  const payload = { files: [file] }

  if (isIosDevice() && navigator.share) {
    try {
      if (!navigator.canShare || navigator.canShare(payload)) {
        await navigator.share(payload)
        return { ok: true, method: 'ios-share-save' }
      }
    } catch (e) {
      if (e?.name === 'AbortError') return { ok: false, reason: 'cancelled' }
    }
  }

  try {
    const dataUri = await blobToDataUri(blob)
    const link = document.createElement('a')
    link.href = dataUri
    link.download = fileName.endsWith('.jpg') ? fileName : `${fileName}.jpg`
    link.rel = 'noopener'
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    return { ok: true, method: 'download' }
  } catch (e) {
    return { ok: false, reason: e?.message || 'download-failed' }
  }
}

export async function isNativeGallerySaveContext() {
  return isNativeOrAppShell() || await isNativeCapacitorApp()
}

/**
 * 인스타 공유 — VS 합성 이미지를 갤러리(카메라 롤)에 저장한 뒤 인스타 앱 스토리/게시 화면으로 연다.
 * (모바일 브라우저·Capacitor 앱 공통 — Web Share 파일 첨부 우회)
 */
async function shareViaInstagramGalleryFlow({
  shareImageCtx,
  url,
  notify,
  copyLink,
  preferStory = true,
}) {
  let linkCopied = false
  try {
    await copyToClipboard(url)
    linkCopied = true
  } catch {
    void 0
  }

  let blob
  try {
    blob = await resolveShareBlob(shareImageCtx)
  } catch (e) {
    console.warn('[socialShare] instagram image resolve failed', e)
    if (linkCopied) {
      notify('링크는 복사됐어요. 이미지 생성에 실패했어요 — 다시 시도해 주세요 📋', 'info')
    } else {
      await copyLink('이미지 생성에 실패했어요. 링크만 복사했습니다 📋')
    }
    return
  }

  const fileName = 'vics-matchup-vs'
  let imageSaved = false

  if (await isNativeGallerySaveContext()) {
    const saved = await saveImageBlobToNativeGallery(blob, { fileName, useAppAlbum: false })
    imageSaved = saved.ok
    if (!saved.ok) {
      console.warn('[socialShare] native gallery save failed', saved.reason)
    }
  } else if (isMobileShareDevice()) {
    const saved = await saveImageBlobToMobileWebGallery(blob, { fileName: `${fileName}.jpg` })
    imageSaved = saved.ok
    if (!saved.ok && saved.reason !== 'cancelled') {
      console.warn('[socialShare] mobile web gallery save failed', saved.reason)
    }
    if (saved.reason === 'cancelled') return
  } else {
    try {
      await saveShareImageToDevice(shareImageCtx)
      imageSaved = true
    } catch {
      imageSaved = false
    }
  }

  if (imageSaved) {
    if (await isNativeGallerySaveContext()) {
      notify('VS 합성 이미지를 사진첩에 저장했어요! 인스타에서 방금 저장한 사진을 선택해 올려 주세요 📸', 'success')
    } else if (isMobileShareDevice()) {
      notify(
        isIosDevice()
          ? '「이미지 저장」을 선택한 뒤, 인스타 스토리·게시물에서 사진을 고르세요 📸 (링크도 복사됨)'
          : 'VS 합성 이미지를 저장했어요! 인스타 스토리·게시물에서 방금 저장한 사진을 선택해 올려 주세요 📸 (링크도 복사됨)',
        linkCopied ? 'success' : 'info',
      )
    } else {
      notify(
        linkCopied
          ? 'VS 합성 이미지(다운로드) + 링크 복사 완료! 인스타 새 게시물에 올려 주세요 📸'
          : 'VS 합성 이미지(다운로드) 완료! 링크는 주소창 URL을 복사해 주세요 📸',
        linkCopied ? 'success' : 'info',
      )
    }

    if (isMobileShareDevice()) {
      await new Promise((resolve) => setTimeout(resolve, 700))
      void tryOpenInstagramApp({ preferStory })
    }
    recordShareSuccess('matchup')
    return
  }

  if (linkCopied) {
    notify('링크는 복사됐어요. 이미지 저장만 실패했어요 — 다시 눌러 주세요 📋', 'info')
  } else {
    await copyLink('이미지 저장에 실패했어요. 링크만 복사했습니다 — 다시 시도해 주세요 📋')
  }
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
    recordShareSuccess('matchup')
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

const INSTAGRAM_WEB_FALLBACK = 'https://www.instagram.com/'

function isIosDevice() {
  return typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

function isAndroidDevice() {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
}

/** @param {{ preferStory?: boolean }} opts — story-camera vs feed camera */
function getInstagramAppUrl({ preferStory = true } = {}) {
  if (isAndroidDevice()) {
    const path = preferStory ? 'story-camera' : 'camera'
    const fallback = encodeURIComponent(INSTAGRAM_WEB_FALLBACK)
    return `intent://${path}/#Intent;package=com.instagram.android;scheme=instagram;S.browser_fallback_url=${fallback};end`
  }
  if (isIosDevice()) {
    return preferStory ? 'instagram://story-camera' : 'instagram://camera'
  }
  return INSTAGRAM_WEB_FALLBACK
}

/**
 * 합성/스토리 이미지 저장 후 인스타 앱 딥링크 — 미설치·실패 시 웹 fallback
 * @param {{ preferStory?: boolean, fallbackMs?: number }} opts
 */
export async function tryOpenInstagramApp({ preferStory = true, fallbackMs = 1600 } = {}) {
  if (typeof window === 'undefined') return

  const isMobile = isIosDevice() || isAndroidDevice()
  if (!isMobile) {
    window.open(INSTAGRAM_WEB_FALLBACK, '_blank', 'noopener,noreferrer')
    return
  }

  let appUrl = getInstagramAppUrl({ preferStory })
  // Capacitor WebView: intent:// 대신 instagram:// scheme
  if (await isNativeGallerySaveContext()) {
    appUrl = preferStory ? 'instagram://story-camera' : 'instagram://camera'
  }

  let cleared = false
  const clear = () => {
    if (cleared) return
    cleared = true
    window.clearTimeout(timer)
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', clear)
  }
  const onHide = () => {
    if (document.hidden) clear()
  }

  const timer = window.setTimeout(() => {
    clear()
    window.open(INSTAGRAM_WEB_FALLBACK, '_blank', 'noopener,noreferrer')
  }, fallbackMs)

  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', clear)

  try {
    window.location.assign(appUrl)
  } catch {
    clear()
    window.open(INSTAGRAM_WEB_FALLBACK, '_blank', 'noopener,noreferrer')
  }
}

async function tryCapacitorShare({ url, notify }) {
  try {
    const { Share } = await import('@capacitor/share')
    await Share.share({ url, dialogTitle: '공유하기' })
    notify('공유했어요')
    recordShareSuccess('matchup')
    return true
  } catch (e) {
    const msg = String(e?.message || e || '')
    if (/cancel/i.test(msg)) return true
    return false
  }
}

function kakaoSdkSkipMessage(reason) {
  switch (reason) {
    case 'no-key':
      return '카카오 JavaScript 키가 없어요. .env.local에 VITE_KAKAO_JS_KEY를 넣고 dev 서버를 재시작해 주세요.'
    case 'app-shell':
      return '앱에서는 카카오톡을 선택해 링크를 공유해 주세요.'
    case 'no-https-origin':
      return '로컬에서는 VITE_SITE_ORIGIN=https://www.victoryspace.net 을 .env.local에 설정해야 카카오 공유가 됩니다.'
    case 'http-share-url':
    case 'http-image-url':
      return '공유 링크·썸네일은 https 운영 URL이 필요해요. VITE_SITE_ORIGIN을 확인해 주세요.'
    default:
      return '카카오 공유창을 열지 못했어요. 링크 복사로 공유해 주세요.'
  }
}

function isKakao4011Error(err) {
  const text = `${err?.code ?? ''} ${err?.message ?? ''} ${String(err ?? '')}`
  return /4011|wrong appKey|잘못.*앱 키|invalid.*app key/i.test(text)
}

function getCapacitorDebugInfo() {
  if (typeof window === 'undefined') return { hasGlobal: false }
  const cap = window.Capacitor
  if (!cap) return { hasGlobal: false }
  return {
    hasGlobal: true,
    isNativePlatform: (() => {
      try { return Boolean(cap.isNativePlatform?.()) } catch { return 'error' }
    })(),
    platform: (() => {
      try { return cap.getPlatform?.() } catch { return 'error' }
    })(),
  }
}

function logKakaoShareDiagnostics(context, extra = {}) {
  if (typeof window === 'undefined') return
  const key = getKakaoJsKey()
  // eslint-disable-next-line no-console
  console.info('[kakao-share]', context, {
    origin: window.location.origin,
    protocol: window.location.protocol,
    hostname: window.location.hostname,
    canUseSdk: canUseKakaoJsSdk(),
    isAppShell: isNativeOrAppShell(),
    capacitor: getCapacitorDebugInfo(),
    keyLength: key.length,
    keyLooksValid: /^[0-9a-fA-F]{32}$/.test(key),
    keyPrefix: key ? `${key.slice(0, 6)}…${key.slice(-4)}` : '(empty)',
    shareOrigin: getPublicShareOrigin(),
    ...extra,
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

async function runKakaoFeedSdkShare({
  safeTitle,
  description = '',
  url,
  imageUrl,
  buttonTitle = '보러 가기',
  notify,
}) {
  const jsKey = getKakaoJsKey()
  if (!jsKey || !canUseKakaoJsSdk()) return { ok: false, reason: 'sdk-unavailable' }

  const payload = validateKakaoSdkSharePayload({ url, imageUrl })
  if (!payload.ok) {
    return { ok: false, reason: payload.reason }
  }

  logKakaoShareDiagnostics('before-send', { shareUrl: payload.shareUrl, imageUrl: payload.imageUrl })
  try {
    const Kakao = await loadKakaoSdkOnce()
    ensureKakaoInitialized(Kakao, jsKey)
    if (!Kakao.isInitialized()) {
      return { ok: false, reason: 'init-failed' }
    }
    await Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: safeTitle,
        description: description || '',
        imageUrl: payload.imageUrl,
        link: { mobileWebUrl: payload.shareUrl, webUrl: payload.shareUrl },
      },
      buttons: [{ title: buttonTitle, link: { mobileWebUrl: payload.shareUrl, webUrl: payload.shareUrl } }],
    })
    return { ok: true }
  } catch (e) {
    // 항상(운영 포함) 출력 — 콘솔에서 실제 code·msg를 확인해 카카오 콘솔 설정과 대조
    console.error('[kakao-share] sendDefault failed', {
      code: e?.code,
      message: e?.message,
      raw: e,
    })
    logKakaoShareDiagnostics('after-fail', { shareUrl: payload.shareUrl, imageUrl: payload.imageUrl })
    if (isKakao4011Error(e)) {
      notify?.(
        '카카오 4011: 앱 키가 잘못됐거나(REST API 키 등) 해당 앱에서 "카카오톡 공유" 제품이 비활성화 상태일 수 있어요. 브라우저 콘솔의 [kakao-share] 로그를 확인해 주세요.',
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
      recordShareSuccess('matchup')
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
      recordShareSuccess('matchup')
    } catch {
      notify('복사에 실패했어요. 주소창의 링크를 직접 복사해 주세요', 'error')
    }
  }

  switch (platform) {
    case 'kakao': {
      const isNative = isNativeOrAppShell() || await isNativeCapacitorApp()
      logKakaoShareDiagnostics('kakao-share-start', { isNative, isMobile })

      if (isNative) {
        if (await tryCapacitorShare({ url, notify })) return
        if (isMobile && await tryWebShare()) return
        await copyLink('링크를 복사했어요. 카카오톡에 붙여넣어 주세요 📋')
        return
      }

      const trySdk = () => runKakaoFeedSdkShare({
        safeTitle,
        url,
        imageUrl,
        buttonTitle: '매치업 보기',
        notify,
      })

      const handleSdkFallback = async (sdk, copyHint) => {
        if (sdk.ok) return true
        if (sdk.reason === '4011') {
          await copyLink('운영 링크를 복사했어요. JavaScript 키를 확인한 뒤 dev 서버를 재시작해 주세요 📋')
          return true
        }
        if (['no-key', 'no-https-origin', 'http-share-url', 'http-image-url', 'app-shell'].includes(sdk.reason)) {
          notify?.(kakaoSdkSkipMessage(sdk.reason), 'info')
          await copyLink(copyHint || '링크를 복사했어요. 카카오톡에 붙여넣으면 VS 썸네일 미리보기가 뜹니다 📋')
          return true
        }
        return false
      }

      // 웹 브라우저 (localhost dev · 운영): PC는 SDK 공유창 우선
      if (!isMobile) {
        const sdk = await trySdk()
        if (await handleSdkFallback(sdk, '운영 링크를 복사했어요. 키 수정 후 dev 서버를 재시작해 주세요 📋')) return
      }
      if (isMobile && await tryWebShare()) return
      {
        const sdk = await trySdk()
        if (await handleSdkFallback(sdk, '운영 링크를 복사했어요. JavaScript 키를 확인해 주세요 📋')) return
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
      await shareViaInstagramGalleryFlow({
        shareImageCtx,
        url,
        notify,
        copyLink,
        preferStory: true,
      })
      return
    }
    default:
      await copyLink()
  }
}

/**
 * 랭킹 갤러리 — 링크 카드(OG) 공유
 * 카카오 JS SDK(4011) 없이 URL 공유·복사만 사용 → 채팅에 붙이면 클릭 가능한 미리보기 카드
 * @param {{ nickname?: string, rank?: number, tierName?: string, thumbnailUrl?: string, showToast?: (msg: string, type?: string) => void }} opts
 */
export async function shareRankingGallery({ nickname, rank, tierName, cardId, showToast }) {
  const title = buildRankingGalleryShareHeadline(nickname)
  const description = buildRankingGalleryShareDescription({ rank, tierName })
  const sharePageUrl = getRankingGallerySharePageUrl({ nickname, rank, tierName, cardId })
  const notify = (msg, type = 'success') => showToast?.(msg, type)

  const copyLink = async (hint) => {
    try {
      await copyToClipboard(sharePageUrl)
      notify(hint || '랭킹 공유 링크를 복사했어요. 카카오톡에 붙여넣으면 랭킹 카드 미리보기가 뜹니다')
      recordShareSuccess('ranking')
    } catch {
      notify('복사에 실패했어요. 주소창의 링크를 직접 복사해 주세요', 'error')
    }
  }

  const tryWebShare = async () => {
    if (typeof navigator === 'undefined' || !navigator.share) return false
    const payload = { title, text: description, url: sharePageUrl }
    try {
      if (navigator.canShare && !navigator.canShare(payload)) return false
      await navigator.share(payload)
      notify('공유했어요')
      recordShareSuccess('ranking')
      return true
    } catch (e) {
      if (e?.name === 'AbortError') return true
      return false
    }
  }

  const isNative = isNativeOrAppShell() || await isNativeCapacitorApp()
  if (isNative) {
    if (await tryCapacitorShare({ url: sharePageUrl, notify })) return
  }

  if (await tryWebShare()) return

  await copyLink()
}

/**
 * OG 미리보기 + 클릭 가능한 URL 공유 (성향 리포트·랭킹 등)
 * @param {{
 *   title: string,
 *   description?: string,
 *   url: string,
 *   imageUrl?: string,
 *   buttonTitle?: string,
 *   shareFile?: File | null,
 *   showToast?: (msg: string, type?: string) => void,
 *   recordKind?: string,
 * }} opts
 */
export async function shareClickableLinkCard({
  title,
  description = '',
  url: rawUrl,
  imageUrl,
  buttonTitle = '보러 가기',
  shareFile = null,
  showToast,
  recordKind = 'tendency',
}) {
  const url = resolvePublicShareUrl(rawUrl)
  const safeTitle = (title || 'VictorySpace').trim()
  const notify = (msg, type = 'success') => showToast?.(msg, type)
  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const ogImage = imageUrl
    ? resolvePublicShareUrl(imageUrl)
    : resolvePublicShareUrl(`${getPublicShareOrigin()}${DEFAULT_OG_IMAGE_PATH}`)

  const shareText = [safeTitle, description, url].filter(Boolean).join('\n')

  const copyLink = async (hint) => {
    try {
      await copyToClipboard(url)
      notify(hint || '공유 링크를 복사했어요. 카카오톡에 붙여넣으면 탭해서 열 수 있어요 📋')
      recordShareSuccess(recordKind)
    } catch {
      notify('복사에 실패했어요. 아래 링크를 길게 눌러 복사해 주세요', 'error')
    }
  }

  const tryWebShare = async () => {
    if (typeof navigator === 'undefined' || !navigator.share) return false
    const payload = shareFile
      ? { title: safeTitle, text: shareText, url, files: [shareFile] }
      : { title: safeTitle, text: shareText, url }
    try {
      if (navigator.canShare && !navigator.canShare(payload)) {
        if (!shareFile) return false
        const linkOnly = { title: safeTitle, text: shareText, url }
        if (navigator.canShare && !navigator.canShare(linkOnly)) return false
        await navigator.share(linkOnly)
        notify('링크가 공유됐어요. 받는 분이 URL을 탭하면 리포트를 볼 수 있어요')
        recordShareSuccess(recordKind)
        return true
      }
      await navigator.share(payload)
      notify(shareFile ? '이미지와 링크가 공유됐어요!' : '링크가 공유됐어요. URL을 탭하면 리포트를 볼 수 있어요')
      recordShareSuccess(recordKind)
      return true
    } catch (e) {
      if (e?.name === 'AbortError') return true
      return false
    }
  }

  const tryKakaoSdk = () =>
    runKakaoFeedSdkShare({
      safeTitle,
      description,
      url,
      imageUrl: ogImage,
      buttonTitle,
      notify,
    })

  const handleKakaoFallback = async (sdk) => {
    if (sdk.ok) {
      notify('카카오톡 공유창이 열렸어요. 「보러 가기」를 누르면 리포트로 이동해요')
      recordShareSuccess(recordKind)
      return true
    }
    if (sdk.reason === '4011') {
      await copyLink('운영 링크를 복사했어요. 카카오톡 채팅에 붙여넣으면 탭해서 열 수 있어요 📋')
      return true
    }
    if (['no-key', 'no-https-origin', 'http-share-url', 'http-image-url', 'app-shell'].includes(sdk.reason)) {
      notify?.(kakaoSdkSkipMessage(sdk.reason), 'info')
      await copyLink()
      return true
    }
    return false
  }

  const isNative = isNativeOrAppShell() || (await isNativeCapacitorApp())
  if (isNative) {
    if (await tryCapacitorShare({ url, notify })) {
      recordShareSuccess(recordKind)
      return
    }
    if (isMobile && (await tryWebShare())) return
    await copyLink()
    return
  }

  if (!isMobile) {
    const sdk = await tryKakaoSdk()
    if (await handleKakaoFallback(sdk)) return
  }

  if (isMobile && (await tryWebShare())) return

  const sdk = await tryKakaoSdk()
  if (await handleKakaoFallback(sdk)) return

  await copyLink()
}

/** @param {File} file @param {string} [filename] */
export function downloadShareFile(file, filename) {
  if (!file || typeof document === 'undefined') return
  const objectUrl = URL.createObjectURL(file)
  try {
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = filename || file.name || 'vics-share.png'
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
