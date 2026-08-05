/** Google Ads 전환 추적 — 지정 매치업 상세 페이지 조회 */
const GOOGLE_ADS_PAGE_VIEW_MATCHUP_IDS = new Set([
  '3500b3c0-7334-4dce-a214-7253fadffbaf',
  'd28ed08d-4269-45eb-babd-b9aa6f1f9442',
  'b41ab510-994d-46ab-ba64-1e892b84a32b',
  '01e7a337-363b-465d-9b5e-41607fc642ac',
])

function normalizeMatchupId(id) {
  return String(id || '').trim().toLowerCase()
}

export function isGoogleAdsPageViewMatchup(id) {
  return GOOGLE_ADS_PAGE_VIEW_MATCHUP_IDS.has(normalizeMatchupId(id))
}

/** index.html Google tag(AW-18348481099) 로드 후, 지정 매치업 상세 진입 시 1회 발화 */
export function trackGoogleAdsMatchupPageView(matchupId) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  if (!isGoogleAdsPageViewMatchup(matchupId)) return

  window.gtag('event', 'ads_conversion_PAGE_VIEW_1', {})

  window.gtag('event', 'conversion', {
    send_to: 'AW-18348481099/QHXNCNvf6dgcEMu0nq1E',
    value: 1.0,
    currency: 'KRW',
  })

  window.gtag('event', 'conversion', {
    send_to: 'AW-18348481099/0xN1CI-igNkcEMu0nq1E',
    value: 1.0,
    currency: 'KRW',
  })
}
