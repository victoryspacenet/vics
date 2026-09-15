/**
 * 관전봇 매치업 형식 한도: 텍스트 10% / 이미지 90%.
 * 한 틱 슬롯을 나눈 뒤, 전체 active 매치업 믹스가 90% 이미지에 못 미치면 생성은 이미지로만 채운다.
 */
export const BOT_TEXT_SHARE = 0.1
export const BOT_IMAGE_SHARE = 0.9
export const QUOTA_STALE_MS = 15 * 60 * 1000
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

export function gateCreatesForMix({ text, image }, mix) {
  const textN = Math.max(0, asInt(mix?.text, 0))
  const imageN = Math.max(0, asInt(mix?.image, 0))
  const usable = textN + imageN
  const imageShare = usable === 0 ? 0 : imageN / usable
  const total = Math.max(0, asInt(text, 0) + asInt(image, 0))
  if (imageShare + 1e-9 < BOT_IMAGE_SHARE) {
    return { text: 0, image: total, gated: 'fill_image' }
  }
  return { text: asInt(text, 0), image: asInt(image, 0), gated: 'maintain' }
}

export function imageQuotaFromTextSlot(max, lastText, lastAt, now = Date.now()) {
  const cap = Math.max(0, asInt(max, 0))
  const last = Math.max(0, asInt(lastText, 0))
  const at = lastAt ? new Date(lastAt).getTime() : 0
  if (!at || Number.isNaN(at) || now - at > QUOTA_STALE_MS) {
    return Math.max(0, cap - splitShareQuota(cap, BOT_TEXT_SHARE, 0).text)
  }
  return Math.max(0, cap - Math.min(cap, last))
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

export function planTextRunQuota(settings, mix) {
  const createSplit = splitShareQuota(settings.maxCreates, BOT_TEXT_SHARE, settings.textCreateAcc)
  const challengeSplit = splitShareQuota(settings.maxChallenges, BOT_TEXT_SHARE, settings.textChallengeAcc)
  const gated = gateCreatesForMix(createSplit, mix)
  return {
    textCreate: gated.text,
    imageCreate: gated.image,
    textChallenge: challengeSplit.text,
    imageChallenge: challengeSplit.image,
    createGated: gated.gated,
    textCreateAcc: createSplit.accumulator,
    textChallengeAcc: challengeSplit.accumulator,
    mix,
  }
}

export function planImageRunQuota(settings, mix, now = Date.now()) {
  const fromSlot = {
    imageCreate: imageQuotaFromTextSlot(
      settings.maxCreates,
      settings.lastTextCreate,
      settings.lastQuotaAt,
      now,
    ),
    imageChallenge: imageQuotaFromTextSlot(
      settings.maxChallenges,
      settings.lastTextChallenge,
      settings.lastQuotaAt,
      now,
    ),
  }
  const gated = gateCreatesForMix({ text: 0, image: fromSlot.imageCreate }, mix)
  if (gated.gated === 'fill_image') {
    return {
      imageCreate: settings.maxCreates,
      imageChallenge: fromSlot.imageChallenge,
      gated: 'fill_image',
    }
  }
  return { ...fromSlot, gated: 'maintain' }
}
