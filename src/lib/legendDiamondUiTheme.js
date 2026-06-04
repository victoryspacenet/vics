/**
 * 다이아 팬덤 전용 — 앱 셸(헤더·배경·하단 내비) 다크 다이아몬드 UI
 * `profiles.legend_diamond_theme_disabled` 로 끌 수 있음 (기본 false = 적용)
 */

/**
 * @param {{ fandom_tier?: string | null; legend_diamond_theme_disabled?: boolean | null } | null | undefined} profile
 */
export function isLegendDiamondShellActive(profile) {
  if (!profile || profile.fandom_tier !== 'diamond') return false
  return profile.legend_diamond_theme_disabled !== true
}
