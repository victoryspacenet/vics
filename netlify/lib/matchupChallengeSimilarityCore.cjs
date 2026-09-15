/**
 * 도전 유사도 검사 코어 (사람 API · 관전봇 공용)
 */
function isHttpsMediaUrl(u) {
  if (!u || typeof u !== 'string') return false
  try {
    const { protocol, hostname } = new URL(u)
    if (protocol !== 'https:') return false
    if (hostname.endsWith('.supabase.co')) return true
    if (hostname.endsWith('netlify.app')) return true
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true
    return false
  } catch {
    return false
  }
}

function isLikelyRasterImageUrl(u) {
  if (!u || typeof u !== 'string') return false
  const path = u.split('?')[0].toLowerCase()
  if (/\.(jpe?g|png|webp|gif)(\b|\/|$)/i.test(path)) return true
  if (/\.supabase\.co\/storage\/v1\/object\//i.test(u) && /-poster(\.|$)/i.test(path)) return true
  return false
}

function resolveVisualImageUrl(side) {
  if (!side || side.type === 'text') return null
  const candidates = [side.thumb, side.url].filter(Boolean)
  for (const raw of candidates) {
    if (!isHttpsMediaUrl(raw)) continue
    if (isLikelyRasterImageUrl(raw)) return raw
    if (side.type === 'image' && /\.supabase\.co\/storage\//i.test(raw)) return raw
  }
  return null
}

const CATEGORY_LABEL_KO = {
  eternal_quest: '영원한 난제',
  romance: '연애',
  relationships: '인간관계',
  work_life: '직장&갓생',
  balance_game: '밸런스게임',
  food_gourmet: '맛집&맛식',
  fashion: '패션',
  realtime_ranking: '실시간 랭킹',
}

function formatCategoryLabel(categoryId) {
  if (!categoryId || typeof categoryId !== 'string') return null
  const id = categoryId.trim()
  return CATEGORY_LABEL_KO[id] || id
}

function sanitizeCategoryLabel(label) {
  if (!label || typeof label !== 'string') return null
  const cleaned = label
    .normalize('NFC')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .trim()
    .slice(0, 40)
  return cleaned || null
}

function categoryHintKo(categoryLabel) {
  if (categoryLabel === '맛집') {
    return (
      `참고: "맛집"은 매장·공간 중심이 이상적이지만, A·B 모두 음식·외식과 연관되면 같은 대분야로 보고 통과 수준의 점수를 주세요.\n` +
      `B가 맛식에 가까운 음식 클로즈업이어도 음식·외식 주제면 거부 사유가 아닙니다.\n\n`
    )
  }
  if (categoryLabel === '맛식') {
    return (
      `참고: "맛식"은 음식·요리 중심이 이상적이지만, A·B 모두 음식·외식·매장과 연관되면 같은 대분야로 보고 통과 수준의 점수를 주세요.\n` +
      `B가 맛집에 가까운 매장 사진이어도 음식·외식 주제면 거부 사유가 아닙니다.\n\n`
    )
  }
  return ''
}

function buildUserContentParts({ title, description, categoryLabel, left, right }) {
  const categoryLine = categoryLabel
    ? `카테고리(맥락): ${categoryLabel}\nB는 이 카테고리·A와 **같은 대분야·주제 영역**이면 됩니다. 완전히 다른 분야(예: 패션 vs 음식)만 0~25점.\n\n${categoryHintKo(categoryLabel)}`
    : ''

  const parts = [
    {
      type: 'text',
      text:
        `아래는 한국어 매치업 앱 "VICS"의 경쟁입니다. A=매치업 메이커, B=도전자.\n` +
        `B가 A·선택 카테고리와 **같은 대분야·주제 영역**에 속하는지 0~100 정수로 평가하세요.\n` +
        `100=같은 분야·같은 경쟁 맥락, 0=완전히 다른 분야·악의적 무관 콘텐츠.\n\n` +
        `✅ 통과 기준 — 아래 중 하나만 해당하면 세부 차이와 관계없이 통과:\n` +
        `- B가 A·카테고리와 같은 대분야·도메인\n` +
        `- B가 같은 경쟁 주제(같은 카테고리 안의 대결)에 참여하는 콘텐츠\n\n` +
        `❌ 감점하면 안 되는 것(같은 대분야면 점수 유지):\n` +
        `- A와 B의 구체적 소재·장면·대상이 다름 (다른 매장, 다른 사진, 다른 문장)\n` +
        `- 표현·톤·구도·각도·세부 장르 차이 (맛집 vs 맛식 등)\n` +
        `- 텍스트 vs 이미지/영상 내용의 세부 차이\n\n` +
        `이미지/영상이 있으면 시각 내용을 참고하되, 위 세부 차이만으로 낮은 점수를 주지 마세요.\n` +
        `반드시 JSON 한 객체만: {"similarity":정수0~100,"reason_ko":"한국어 한 문장"}\n\n` +
        categoryLine +
        `경쟁 제목: ${title || '(없음)'}\n` +
        `설명: ${description || '(없음)'}\n\n` +
        `A 타입: ${left.type}\n` +
        (left.type === 'text'
          ? `A 텍스트: ${(left.text || '').slice(0, 4000)}\n`
          : `A 미디어: 아래 A 스틸컷 참고.\n`) +
        `\nB 타입: ${right.type}\n` +
        (right.type === 'text'
          ? `B 텍스트: ${(right.text || '').slice(0, 4000)}\n`
          : `B 미디어: 아래 B 스틸컷 참고.\n`),
    },
  ]

  const leftImg = resolveVisualImageUrl(left)
  const rightImg = resolveVisualImageUrl(right)
  if (leftImg) {
    parts.push({ type: 'text', text: '\n[A 스틸컷]' })
    parts.push({ type: 'image_url', image_url: { url: leftImg, detail: 'low' } })
  }
  if (rightImg) {
    parts.push({ type: 'text', text: '\n[B 스틸컷]' })
    parts.push({ type: 'image_url', image_url: { url: rightImg, detail: 'low' } })
  }

  return { parts, leftImg, rightImg }
}

function minChallengeSimilarity() {
  return Math.max(0, Math.min(100, parseInt(process.env.MATCHUP_CHALLENGE_SIMILARITY_MIN || '45', 10)))
}

async function scoreChallengeSimilarity(payload) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const model = process.env.OPENAI_SIMILARITY_MODEL || 'gpt-4o-mini'
  const { title, description, categoryLabel, left, right } = payload
  const { parts, leftImg, rightImg } = buildUserContentParts({
    title,
    description,
    categoryLabel,
    left,
    right,
  })

  if (left.type !== 'text' && !leftImg) {
    throw new Error('A측 미디어를 분석할 수 없어요')
  }
  if (right.type !== 'text' && !rightImg) {
    throw new Error('B측 미디어를 분석할 수 없어요')
  }

  const timeoutMsRaw = parseInt(process.env.MATCHUP_SIMILARITY_OPENAI_TIMEOUT_MS || '20000', 10)
  const timeoutMs = Math.min(90000, Math.max(5000, Number.isFinite(timeoutMsRaw) ? timeoutMsRaw : 20000))
  const ac = new AbortController()
  const kill = setTimeout(() => ac.abort(), timeoutMs)

  let res
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: ac.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You compare challenger(B) vs maker(A) content for broad thematic fit in a Korean matchup app. ' +
              'Pass when B is in the same general field/category as A, even if specific subject, scene, wording, tone, angle, or sub-genre differ. ' +
              'Only score 0-25 when B is from a completely unrelated domain (e.g. A is food but B is pure fashion). ' +
              'Use attached images when present. Output JSON only.',
          },
          { role: 'user', content: parts },
        ],
      }),
    })
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new Error(`OpenAI timeout after ${timeoutMs}ms`)
    }
    throw e
  } finally {
    clearTimeout(kill)
  }

  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 200)}`)
  }

  const data = await res.json()
  const raw = data?.choices?.[0]?.message?.content
  if (!raw) throw new Error('OpenAI 응답 없음')
  const parsed = JSON.parse(raw)
  const similarity = Math.max(0, Math.min(100, Math.round(Number(parsed.similarity))))
  if (!Number.isFinite(similarity)) throw new Error('유사도 파싱 실패')
  return {
    similarity,
    reason_ko: typeof parsed.reason_ko === 'string' ? parsed.reason_ko : '',
  }
}

module.exports = {
  isHttpsMediaUrl,
  formatCategoryLabel,
  sanitizeCategoryLabel,
  minChallengeSimilarity,
  scoreChallengeSimilarity,
}
