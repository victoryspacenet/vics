/**
 * SNS OG 스크래퍼 vs 앱 내 WebView(실제 사용자) 구분
 * — KakaoTalk/LINE 인앱 브라우저를 크롤러로 오인하면 SPA가 로드되지 않음
 */
const OG_SCRAPER_REGEX =
  /bot|crawler|spider|crawling|facebookexternalhit|twitterbot|linkedinbot|slurp|whatsapp|telegram|pinterest|duckduckbot|googlebot|bingbot|yandexbot|slackbot|discordbot|kakaotalkbot|kakaostorybot|kakaotalk[-_]?scrap|kakaostory[-_]?scrap|kakaotalkscrap|kakaostoryscrap|yeti|naverbot/i

function isOgScraperUserAgent(ua) {
  const s = String(ua || '')
  if (!s) return false

  // KakaoTalk·KakaoStory 앱 내 브라우저 — 실제 사용자
  if (/kakaotalk|kakaostory/i.test(s) && /(?:iPhone|iPad|iPod|Android|Mobile)/i.test(s)) {
    if (!/(?:bot|scrap|crawler)/i.test(s)) return false
  }

  // LINE 앱 내 브라우저
  if (/\bLine\//i.test(s) && /(?:iPhone|iPad|iPod|Android|Mobile)/i.test(s)) {
    if (!/(?:bot|scrap|crawler)/i.test(s)) return false
  }

  return OG_SCRAPER_REGEX.test(s)
}

module.exports = { isOgScraperUserAgent, OG_SCRAPER_REGEX }
