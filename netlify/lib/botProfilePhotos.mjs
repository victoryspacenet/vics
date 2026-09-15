/**
 * 관전봇 프로필 사진 — 전체의 50%만 아바타.
 * 인물이 들어가면 한국인만. 사진 봇 중 일부만 한국인 실사 얼굴, 나머지는 한국 일상 컷.
 */
import sharp from 'sharp'
import { uploadBotPng } from './botMatchupImage.mjs'

export const BOT_PHOTO_SHARE = 0.5
/** 사진 있는 봇 가운데 한국인 얼굴 비율 */
export const BOT_FACE_SHARE_OF_PHOTOS = 0.3

/** 위키미디어 실사 — 한국인 얼굴이 보이게 크롭 */
const KOREAN_FACE_CROPS = [
  { key: 'ddp-dress', file: 'Woman in fashionable dress (Unsplash).jpg', left: 0.65, top: 0.08, width: 0.25, height: 0.52, gravity: 'west' },
  { key: 'kimbap-maker', file: 'Maker (8746345233).jpg', left: 0.32, top: 0.16, width: 0.36, height: 0.5, gravity: 'north' },
  { key: 'subway-green', file: 'From Seoul subway (first half or 2013) 16.JPG', left: 0.72, top: 0.36, width: 0.24, height: 0.4, gravity: 'northwest' },
  { key: 'subway-suit', file: 'From Seoul subway (first half or 2013) 16.JPG', left: 0.0, top: 0.42, width: 0.22, height: 0.42, gravity: 'west' },
]

/** 위키미디어 공용 — 한국 음식·서울 장소. 외국인 얼굴 풀(randomuser 등)은 쓰지 않음. */
const KOREAN_AVATAR_FILES = [
  'Korean.food-Bibimbap-02.jpg',
  'Korean.snacks-Tteokbokki-04.jpg',
  'Korean_Teokbokki.jpg',
  'Kimbop_at_Korea_House.jpg',
  'Bibimbap_and_banchan.jpg',
  'Gimbap_(pixabay).jpg',
  'Dongchimi-gimbap.jpg',
  'Cheese-tteok-bokki.jpg',
  'Ddeokbokki-01.jpg',
  'Five_different_Kimchi.jpg',
  'Banchan_and_kimchi_bowl_01.jpg',
  'Bapsang.jpg',
  'Sundubu-jjigae.jpg',
  'Naengmyeon.jpg',
  'Budae-jjigae.jpg',
  'Hotteok.jpg',
  'Patbingsu.jpg',
  'Bingsu.jpg',
  'Soju.jpg',
  'Makgeolli.jpg',
  'Gyeongbokgung.jpg',
  'Bukchon_Hanok_Village.jpg',
  'Han_River.jpg',
  'Bibim-bap 1.jpg',
  'Bibimbap 2.jpg',
  'Bibimbap 3.jpg',
  'Bibimbap 6.jpg',
  'Bibimbap 7.jpg',
  'Bibimbap 8.jpg',
  'Bibimbap at MazeLand, Jeju, Korea.JPG',
  'Cheese-tteok-bokki 1.jpg',
  'Colorful cheese tteok.jpg',
  'Duk Bok Kee.jpg',
  'Bagged Tteokbokki.jpg',
  'Beef kimbap from a DC lunch counter.jpg',
  'Dongchimi-gimbap 2.jpg',
  'Banchan and kimchi bowl 02.jpg',
  'Banchan and kimchi bowl 03.jpg',
  'Bean-curd kimchi (9552085997).jpg',
  'Delivery food with kimchi, meat and salads.jpg',
  'Biji-jjigae and gat-gimchi.jpg',
  'Bok choy green kimchi.jpg',
  'Fishcake Kimbap (16329470757).jpg',
  'Freshly prepared kimbap in a package with a label.jpg',
  'Gyeongbokgung Palace.jpg',
  'Geunjeongjeon.jpg',
  'Gyeonghoeru.jpg',
  'Dak-galbi.jpg',
  'Tteok-galbi.jpg',
  'Japchae.jpg',
  'Pajeon.jpg',
  'Eomuk.jpg',
  'Seolleongtang.jpg',
  'Samgyetang.jpg',
  'Jokbal.jpg',
  'Sujebi.jpg',
  'Mandu.jpg',
]

const WIKIMEDIA_UA = 'VICSBotAvatarFill/1.0 (https://www.victoryspace.net; spectator-bot avatars)'

function hash32(text) {
  const s = String(text || '')
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function hasPhoto(row) {
  return Boolean(String(row?.avatar_url || '').trim())
}

export function photoTargetCount(total, share = BOT_PHOTO_SHARE) {
  const n = Math.max(0, Number(total) || 0)
  const ratio = Math.min(1, Math.max(0, Number(share) || 0))
  return Math.round(n * ratio)
}

function compareBotId(a, b) {
  const dh = hash32(a.id) - hash32(b.id)
  if (dh !== 0) return dh
  return String(a.id).localeCompare(String(b.id))
}

export function pickBotsNeedingPhotos(bots, share = BOT_PHOTO_SHARE) {
  const rows = Array.isArray(bots) ? bots.filter((b) => b?.id) : []
  const withPhoto = rows.filter(hasPhoto)
  const without = rows.filter((b) => !hasPhoto(b))
  const need = Math.max(0, photoTargetCount(rows.length, share) - withPhoto.length)
  without.sort(compareBotId)
  return without.slice(0, need)
}

export function wantsKoreanFace(bot) {
  return hash32(`face:${bot?.id}`) % 10 < Math.round(BOT_FACE_SHARE_OF_PHOTOS * 10)
}

export function pickBotsForFaceReplace(bots) {
  return (Array.isArray(bots) ? bots : [])
    .filter((b) => b?.id && hasPhoto(b) && wantsKoreanFace(b))
    .sort(compareBotId)
    .slice(0, KOREAN_FACE_CROPS.length)
}

function sniffImage(bytes) {
  if (bytes?.[0] === 0x89 && bytes?.[1] === 0x50 && bytes.length > 8_000) {
    return { ext: 'png', type: 'image/png' }
  }
  if (bytes?.[0] === 0xff && bytes?.[1] === 0xd8 && bytes.length > 2_000) {
    return { ext: 'jpg', type: 'image/jpeg' }
  }
  return null
}

async function fetchWithTimeout(url, init, ms) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function fileKey(name) {
  return String(name || '').replace(/ /g, '_').toLowerCase()
}

function pickKoreanAvatarFile(bot, used) {
  const start = hash32(bot.id) % KOREAN_AVATAR_FILES.length
  for (let step = 0; step < KOREAN_AVATAR_FILES.length; step += 1) {
    const name = KOREAN_AVATAR_FILES[(start + step) % KOREAN_AVATAR_FILES.length]
    const key = fileKey(name)
    if (used.has(key)) continue
    used.add(key)
    return name
  }
  return KOREAN_AVATAR_FILES[start]
}

function pickFaceCrop(bot, used) {
  const start = hash32(`crop:${bot.id}`) % KOREAN_FACE_CROPS.length
  for (let step = 0; step < KOREAN_FACE_CROPS.length; step += 1) {
    const spec = KOREAN_FACE_CROPS[(start + step) % KOREAN_FACE_CROPS.length]
    if (used.has(spec.key)) continue
    used.add(spec.key)
    return spec
  }
  return null
}

async function toSquareJpeg(bytes, box) {
  const image = sharp(bytes)
  const meta = await image.metadata()
  const width = Number(meta.width) || 0
  const height = Number(meta.height) || 0
  if (width < 80 || height < 80) throw new Error('face image too small')
  const extract = box
    ? {
        left: Math.max(0, Math.floor(width * box.left)),
        top: Math.max(0, Math.floor(height * box.top)),
        width: Math.max(40, Math.floor(width * box.width)),
        height: Math.max(40, Math.floor(height * box.height)),
      }
    : {
        left: 0,
        top: 0,
        width,
        height: Math.max(40, Math.floor(height * 0.88)),
      }
  extract.width = Math.min(extract.width, width - extract.left)
  extract.height = Math.min(extract.height, height - extract.top)
  return image
    .extract(extract)
    .resize(640, 640, { fit: 'cover', position: box?.gravity || 'attention' })
    .jpeg({ quality: 86 })
    .toBuffer()
}

async function fetchCroppedKoreanFace(spec) {
  const bytes = await fetchKoreanAvatarBytes(spec.file)
  return toSquareJpeg(bytes, spec)
}

function wikimediaUrl(filename) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=640`
}

async function fetchKoreanAvatarBytes(filename) {
  const res = await fetchWithTimeout(
    wikimediaUrl(filename),
    {
      headers: {
        Accept: 'image/jpeg,image/png,image/*',
        'User-Agent': WIKIMEDIA_UA,
      },
      redirect: 'follow',
    },
    18_000,
  )
  if (!res.ok) throw new Error(`korean avatar fetch ${res.status}`)
  const bytes = Buffer.from(await res.arrayBuffer())
  if (!sniffImage(bytes)) throw new Error('korean avatar is not an image')
  return bytes
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ max?: number, started?: number, budgetMs?: number, replaceExisting?: boolean, facesOnly?: boolean, revertExtraFaces?: boolean }} [opts]
 */
export async function ensureBotProfilePhotos(supabase, opts = {}) {
  const max = Math.max(0, Math.trunc(Number(opts.max) || 0) || 2)
  const started = opts.started || Date.now()
  const budgetMs = Number(opts.budgetMs) > 0 ? Number(opts.budgetMs) : 50_000
  const facesOnly = Boolean(opts.facesOnly)
  const revertExtraFaces = Boolean(opts.revertExtraFaces)
  const replaceExisting = Boolean(opts.replaceExisting) || facesOnly || revertExtraFaces

  const { data: bots, error } = await supabase
    .from('profiles')
    .select('id, nickname, avatar_url')
    .eq('is_bot', true)
    .order('id', { ascending: true })
  if (error) throw error

  const rows = bots || []
  const withPhoto = rows.filter(hasPhoto)
  const faceKeepIds = new Set(pickBotsForFaceReplace(rows).map((b) => b.id))
  const selected = revertExtraFaces
    ? rows.filter((b) => hasPhoto(b) && wantsKoreanFace(b) && !faceKeepIds.has(b.id)).sort(compareBotId)
    : facesOnly
      ? pickBotsForFaceReplace(rows)
      : replaceExisting && withPhoto.length
        ? [...withPhoto].sort(compareBotId)
        : pickBotsNeedingPhotos(rows)
  const result = {
    bots: rows.length,
    withPhoto: withPhoto.length,
    target: photoTargetCount(rows.length),
    faceTarget: pickBotsForFaceReplace(rows).length,
    queued: selected.length,
    attempted: 0,
    uploaded: 0,
    faces: 0,
    errors: [],
  }
  if (!selected.length || max <= 0) return result

  const usedFiles = new Set()
  const usedFaceCrops = new Set()
  for (const bot of selected.slice(0, max)) {
    if (Date.now() - started > budgetMs) {
      result.errors.push('time_budget')
      break
    }
    result.attempted += 1
    const useFace = !revertExtraFaces && (facesOnly || wantsKoreanFace(bot))
    const crop = useFace ? pickFaceCrop(bot, usedFaceCrops) : null
    if (useFace && !crop) continue
    if (result.attempted > 1) await sleep(350)
    try {
      let bytes
      if (useFace) {
        bytes = await fetchCroppedKoreanFace(crop)
        result.faces += 1
      } else {
        const filename = pickKoreanAvatarFile(bot, usedFiles)
        bytes = await fetchKoreanAvatarBytes(filename)
      }
      const sniffed = sniffImage(bytes) || { ext: 'jpg', type: 'image/jpeg' }
      const publicUrl = await uploadBotPng(
        supabase,
        `avatars/${bot.id}/profile.${sniffed.ext}`,
        bytes,
        sniffed.type,
      )
      const { error: uErr } = await supabase
        .from('profiles')
        .update({
          avatar_url: `${publicUrl}?t=${Date.now()}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bot.id)
        .eq('is_bot', true)
      if (uErr) throw new Error(uErr.message)
      result.uploaded += 1
      if (!hasPhoto(bot)) result.withPhoto += 1
    } catch (e) {
      result.errors.push(`${bot.id}: ${e?.message || e}`)
    }
  }

  result.errors = result.errors.slice(0, 8)
  return result
}
