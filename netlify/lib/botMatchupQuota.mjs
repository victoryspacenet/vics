/**
 * 관전봇 매치업 형식 한도: 텍스트 90% / 이미지 10%.
 * 텍스트 몫을 실행한 뒤에만 이미지 몫을 연다.
 * 이미지 생성에 한 번 실패한 봇은 다시 시도하지 않는다.
 */
export const BOT_TEXT_SHARE = 0.9
export const BOT_IMAGE_SHARE = 0.1
export const TEXT_PHASE_MAX_AGE_MS = 25 * 60 * 1000
const SETTINGS_KEY = 'virtual_bot_matchups'

function asInt(value, fallback = 0) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.trunc(n)
}

export function splitShareQuota(max, share, accumulator = 0) {
  const cap = Math.max(0, asInt(max, 0))
  const acc = Math.max(0, Number(accumulator) || 0)
  const ratio = Math.min(1, Math.max(0, Number(share) || 0))
  if (cap <= 0) return { text: 0, image: 0, accumulator: acc }
  const next = acc + cap * ratio
  const text = Math.min(cap, Math.floor(next + 1e-9))
  return { text, image: cap - text, accumulator: Math.round((next - text) * 1e6) / 1e6 }
}

export function imageFailedBotIds(raw) {
  const list = raw?.image_failed_bot_ids
  if (!Array.isArray(list)) return []
  return [...new Set(list.map((id) => String(id || '').trim()).filter(Boolean))]
}

export function imageFailedBotIdsWith(raw, botId) {
  const id = String(botId || '').trim()
  return id ? [...new Set([...imageFailedBotIds(raw), id])] : imageFailedBotIds(raw)
}

export function parseBotMatchupSettings(value) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const enabledRaw = String(raw.enabled ?? 'true').trim().toLowerCase()
  return {
    enabled: !['false', '0', 'off', 'no'].includes(enabledRaw),
    intervalHours: Math.max(1, asInt(raw.interval_hours, 48)),
    maxCreates: Math.max(0, Math.min(20, asInt(raw.max_creates_per_run, 3))),
    maxChallenges: Math.max(0, Math.min(20, asInt(raw.max_challenges_per_run, 3))),
    textCreateAcc: Math.max(0, Number(raw.text_create_acc) || 0),
    textChallengeAcc: Math.max(0, Number(raw.text_challenge_acc) || 0),
    lastTextCreate: Math.max(0, asInt(raw.last_text_create, 0)),
    lastTextChallenge: Math.max(0, asInt(raw.last_text_challenge, 0)),
    lastQuotaAt: raw.last_quota_at || null,
    imageFailedBotIds: imageFailedBotIds(raw),
    raw,
  }
}

export async function loadBotMatchupSettings(supabase) {
  const { data, error } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle()
  if (error) throw error
  return parseBotMatchupSettings(data?.value)
}

export async function saveBotMatchupQuotaState(supabase, raw, patch) {
  const next = { ...(raw || {}), ...patch }
  const { error } = await supabase.from('admin_settings').update({ value: next }).eq('key', SETTINGS_KEY)
  if (error) throw error
  return next
}

async function countActiveLeftType(supabase, type) {
  let query = supabase
    .from('matchups')
    .select('id', { count: 'exact', head: true })
    .or('status.eq.active,status.is.null')
    .not('is_demo', 'eq', true)
  if (type === 'text') {
    query = query.or('left_type.eq.text,left_type.is.null')
  } else {
    query = query.eq('left_type', type)
  }
  const { count, error } = await query
  if (error) throw error
  return Number(count) || 0
}

export async function countActiveMediaMix(supabase) {
  const [text, image, video] = await Promise.all([
    countActiveLeftType(supabase, 'text'),
    countActiveLeftType(supabase, 'image'),
    countActiveLeftType(supabase, 'video'),
  ])
  const usable = text + image
  return {
    text,
    image,
    video,
    usable,
    textShare: usable ? text / usable : 0,
    imageShare: usable ? image / usable : 0,
  }
}

export function planTextRunQuota(settings) {
  const createSplit = splitShareQuota(settings.maxCreates, BOT_TEXT_SHARE, settings.textCreateAcc)
  const challengeSplit = splitShareQuota(settings.maxChallenges, BOT_TEXT_SHARE, settings.textChallengeAcc)
  return {
    textCreate: createSplit.text,
    imageCreate: createSplit.image,
    textChallenge: challengeSplit.text,
    imageChallenge: challengeSplit.image,
    createGated: 'text_first',
    textCreateAcc: createSplit.accumulator,
    textChallengeAcc: challengeSplit.accumulator,
  }
}

export function planImageRunQuota(settings, now = Date.now()) {
  const at = settings.lastQuotaAt ? new Date(settings.lastQuotaAt).getTime() : 0
  const textReady = Number.isFinite(at) && at > 0 && now - at <= TEXT_PHASE_MAX_AGE_MS
  if (!textReady) {
    return { imageCreate: 0, imageChallenge: 0, gated: 'wait_text' }
  }
  return {
    imageCreate: Math.max(0, asInt(settings.maxCreates, 0) - asInt(settings.lastTextCreate, 0)),
    imageChallenge: Math.max(0, asInt(settings.maxChallenges, 0) - asInt(settings.lastTextChallenge, 0)),
    gated: 'after_text',
  }
}
