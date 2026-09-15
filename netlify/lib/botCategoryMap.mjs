/**
 * 운영 카테고리 id(cat_xxx) → 관전봇 멘트/이미지 풀 키, 표시 라벨.
 * JS가 id만 보고 eternal_quest로 떨어지면 맛집·패션 매치업에 무관한 도전이 붙는다.
 */
const PROMPT_KEYS = new Set(['eternal_quest', 'fashion', '맛집', '맛식'])

export function promptKeyFromBlob(...parts) {
  const blob = parts
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  if (!blob) return null
  if (PROMPT_KEYS.has(String(parts[0] || '').trim())) return String(parts[0]).trim()
  if (blob.includes('eternal') || blob.includes('영원한')) return 'eternal_quest'
  if (blob.includes('fashion') || blob.includes('패션')) return 'fashion'
  if (blob.includes('맛식') || blob.includes('food_taste')) return '맛식'
  if (blob.includes('맛집') || blob.includes('food_place') || blob.includes('food_gourmet')) return '맛집'
  return null
}

export function mapBotChallengeCategoryKey(raw) {
  return promptKeyFromBlob(raw)
}

export async function loadBotCategoryCatalog(supabase) {
  const { data, error } = await supabase
    .from('category_admin_config')
    .select('data')
    .eq('id', 'default')
    .maybeSingle()
  if (error) throw error
  const cats = Array.isArray(data?.data?.activeCategories) ? data.data.activeCategories : []
  const keyById = new Map()
  const labelById = new Map()
  for (const cat of cats) {
    const id = String(cat?.id || '').trim()
    if (!id) continue
    const label = String(cat?.label || '').trim()
    const slug = String(cat?.slug || '').trim()
    const key = promptKeyFromBlob(id, label, slug)
    if (key) keyById.set(id, key)
    if (label) labelById.set(id, label)
    else if (key) labelById.set(id, key)
  }
  return { keyById, labelById }
}

export function resolveBotCategoryKey(category, catalog) {
  const raw = String(category || '').trim()
  if (!raw) return null
  if (catalog?.keyById?.has(raw)) return catalog.keyById.get(raw)
  return mapBotChallengeCategoryKey(raw)
}

export function resolveBotCategoryLabel(category, catalog) {
  const raw = String(category || '').trim()
  if (!raw) return null
  if (catalog?.labelById?.has(raw)) return catalog.labelById.get(raw)
  return mapBotChallengeCategoryKey(raw)
}
