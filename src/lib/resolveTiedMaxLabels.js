/**
 * 동일 최대값을 가진 항목 키를 우선순위 순으로 모두 반환 (0 이하 제외)
 * @param {Record<string, number>} scores
 * @param {string[]} orderedKeys
 */
export function resolveTiedMaxKeys(scores, orderedKeys) {
  if (!orderedKeys?.length) return []

  let max = 0
  for (const key of orderedKeys) {
    const score = Math.max(0, Math.floor(Number(scores?.[key]) || 0))
    if (score > max) max = score
  }
  if (max <= 0) return []

  return orderedKeys.filter(
    (key) => Math.max(0, Math.floor(Number(scores?.[key]) || 0)) === max,
  )
}

/**
 * @param {string[]} keys
 * @param {Record<string, string>} labelMap
 */
export function labelsForKeys(keys, labelMap) {
  return (keys || []).map((key) => labelMap[key]).filter(Boolean)
}

/**
 * @param {string[]} labels
 */
export function joinActivityLabels(labels) {
  return (labels || []).filter(Boolean).join(' · ')
}

/**
 * @param {Record<string, number>} scores
 * @param {string[]} orderedKeys
 * @param {Record<string, string>} labelMap
 */
export function mapTiedMaxLabels(scores, orderedKeys, labelMap) {
  const keys = resolveTiedMaxKeys(scores, orderedKeys)
  const labels = labelsForKeys(keys, labelMap)
  if (!labels.length) return { keys: [], labels: [], label: '' }
  return { keys, labels, label: joinActivityLabels(labels) }
}
