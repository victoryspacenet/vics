/**
 * 관전봇 도전 멘트 — 자랑+도발, 20대 초중반 관점·말투.
 * 생성 주제 풀과 분리. {title} 자리에 상대 매치업 제목을 넣는다.
 * description ≤200, body_text ≤200.
 */

const TITLE_MAX = 28
const DESC_MAX = 200
const BODY_MAX = 200

/** @type {Record<string, { description: string, body_text: string }[]>} */
export const BOT_CHALLENGE_COPY = {
  eternal_quest: [
    {
      description:
        '「{title}」 봤는데 난 반대가 실전임. 듣기 좋은 말은 인스타용이고 평일엔 내 쪽이 이득. 표로 와봐.',
      body_text: '그 논리 3일이면 현타임. 난 시간·멘탈 지키는 쪽이 맞음.',
    },
    {
      description:
        '난 감정으로 지면 다음 주가 숙제된다고 봄. 「{title}」 쪽은 예쁘긴 한데 20대 스케줄이랑 안 맞음. 반박?',
      body_text: '예쁜 가치관이 평일까지 가면 번아웃임. 컷이 자존감임.',
    },
    {
      description:
        '「{title}」 열어보니 성실함으로 불안 포장한 각임. 난 밀도 있는 선택이 이득. 아직 집착파 나와봐.',
      body_text: '횟수·인증은 썸을 숙제로 만듦. 온도가 남는 쪽이 이김.',
    },
    {
      description:
        '난 비교하는 순간이 멘탈 세금이라고 봄. 「{title}」 논리 들었는데 난 끄는 쪽이 생존임. 표로 증명해봐.',
      body_text: '인스타 하이라이트랑 내 평일 비교하면 현타 확정. 끄는 게 이득임.',
    },
    {
      description:
        '「{title}」 그 쪽은 로맨스 영화고 난 실전임. 20대엔 통장이랑 시간이 먼저. 반박할 사람?',
      body_text: '감정 빚 남기는 선택이 제일 비쌈. 난 경계가 매너임.',
    },
    {
      description:
        '난 완벽한 루틴보다 무너져도 다시 켜는 게 갓생이라고 봄. 「{title}」 쪽은 한 방에 끝내려다 번아웃임. 나와봐.',
      body_text: '연속 집착이 실패임. 내일 알람만 다시 켜도 이득.',
    },
    {
      description:
        '「{title}」 봤는데 자랑용 독립·자랑용 연애가 보임. 난 선택지 남기는 게 전략임. 아직 체면파 들어와.',
      body_text: '억지 썸·무리한 자취가 자존감이 아님. 남는 쪽이 이김.',
    },
    {
      description:
        '난 톡 온도가 사람 온도라고 봄. 「{title}」 쪽 논리 인정은 하는데 눈치 게임은 시간 도둑임. 표로 와봐.',
      body_text: '한 줄이 매너 최저선임. 밀당은 20대 체력 낭비임.',
    },
  ],
  fashion: [
    {
      description:
        '「{title}」 봤는데 난 핏이 로고보다 이득임. 브랜드 자랑은 가까운 사람만 앎. 표로 와봐.',
      body_text: '어깨 핏이 맞으면 저렴해도 비싸 보임. 로고만 믿으면 사이즈에서 들킴.',
    },
    {
      description:
        '난 미니멀 옷장이 아침 결정장애 없앤다고 봄. 「{title}」 쪽은 옷이 숙제된 각임. 반박?',
      body_text: '입는 횟수 많은 옷이 진짜 내 스타일임. 유행 다 사면 코디가 숙제됨.',
    },
    {
      description:
        '「{title}」 그 룩 예쁘긴 한데 난 동선이 코디임. 발 아프면 표정부터 죽음. 나와봐.',
      body_text: '편해야 표정이 남음. 예쁜 신발에 절뚝이면 코디가 다 죽음.',
    },
    {
      description:
        '난 중고·렌탈이 옷장 포화 안 만드는 길이라고 봄. 「{title}」 쪽은 새거 자랑이 먼저임. 표로 증명해봐.',
      body_text: '한 철 행사용은 내 거라야 한다는 집착이 예산 무너뜨림.',
    },
    {
      description:
        '「{title}」 봤는데 난 검정이 실패 확률 낮은 유니폼이라고 봄. 컬러 강요는 취향 간섭임. 반박?',
      body_text: '검정은 무난함이 아니라 선택 비용 절감임. 포인트는 가방·신발로.',
    },
    {
      description:
        '난 오운완 룩이 움직임 최적화라고 봄. 「{title}」 쪽 꾸안꾸 눈치는 극혐. 표로 와봐.',
      body_text: '짐 동선이면 그게 정직한 코디임. 갈아입는 시간이 아깝다.',
    },
    {
      description:
        '「{title}」 지금 사도 됨? 난 무지출 한 달 하고 사는 게 충동 방어임. 마케팅에 진 사람 나와봐.',
      body_text: '지금 아니면 못 산다는 말이 함정임. 할부로 자존감 사면 다음 달 현타.',
    },
    {
      description:
        '난 모자부터가 컨디션 조절이라고 봄. 「{title}」 쪽은 매일 화보를 강요함. 20대도 쉴 날이 있음. 반박?',
      body_text: '모자는 대충이 아니라 페이스 관리임. 맨얼굴 필수는 아님.',
    },
  ],
  맛집: [
    {
      description:
        '「{title}」 핫플 자랑 봤는데 난 골목·자리·서비스가 탐방 실력임. 줄만 길면 그 집 급 아님. 표로 와봐.',
      body_text: '웨이팅은 기대값임. 자리 안내가 차면 탐방 실패임.',
    },
    {
      description:
        '난 창가·혼밥석 있는 집이 그 동네를 한 번 더 가게 한다고 봄. 「{title}」 쪽은 인증샷 탐방임. 반박?',
      body_text: '자리 설계가 탐방 인프라임. 둘이 오라는 눈치면 그 골목 안 감.',
    },
    {
      description:
        '「{title}」 서울 핫플만 탐방이라는 각 보임. 난 지방·시장 골목이 기억에 남음. 나와봐.',
      body_text: '지방 집은 서비스가 덜 바쁨. 그 동네 공기까지 메뉴임.',
    },
    {
      description:
        '난 직원 친절이 재방문 이유라고 봄. 「{title}」 쪽은 맛만 보면 된다는 논리. 표로 증명해봐.',
      body_text: '서비스는 덤이 아님. 기분 상하면 그 골목 전체가 식음.',
    },
    {
      description:
        '「{title}」 포장 빠른 집 자랑인데 난 매장 온도가 탐방임. 창구만 있으면 배달이랑 같음. 반박?',
      body_text: '테이블에 앉아야 그 집 공기가 남음. 자리값이 탐방임.',
    },
    {
      description:
        '난 24시·퇴근 루트 집이 그 지역 생존 맛집이라고 봄. 「{title}」 쪽 감성집은 동선이 끊김. 표로 와봐.',
      body_text: '닫힌 골목은 탐방이 아님. 새벽에 문 연 집이 인프라임.',
    },
    {
      description:
        '「{title}」 콘센트 전쟁 얘기면 그 카페가 다 같아짐. 난 창가 빛이 그 집임. 나와봐.',
      body_text: '카페 탐방은 그 자리의 빛임. 충전기만 보면 집 구분이 없음.',
    },
    {
      description:
        '난 불판·속도 맞춰주는 집이 회식 탐방 1순위임. 「{title}」 쪽은 메뉴만 두꺼우면 된다는 각. 반박?',
      body_text: '고깃집은 불이 서비스임. 직원 동선이 그 집 급을 보여줌.',
    },
  ],
  맛식: [
    {
      description:
        '「{title}」 그 맛 인정하는데 난 식감이 한 입을 이긴다고 봄. 자극만 세면 중간에 질림. 표로 와봐.',
      body_text: '간·온도·씹는 맛이 여운임. 한 방 자극은 다음 끼가 생각남.',
    },
    {
      description:
        '난 찍먹이 소스 컨트롤이라고 봄. 「{title}」 쪽 부먹 논리는 마지막이 흐물해짐. 반박?',
      body_text: '찍먹은 취향이 아니라 식감 관리임. 중간부터 다른 음식 되면 손해.',
    },
    {
      description:
        '「{title}」 단짠만 진리라는 각이면 입이 심심해짐. 난 매운맛 볼륨이 한 끼 리셋임. 나와봐.',
      body_text: '매운맛은 성격이 아니라 맛의 볼륨임. 순한 맛만 고르면 혀가 잠.',
    },
    {
      description:
        '난 국물 농도가 맛의 전부라고 봄. 「{title}」 쪽 건더기파 논리 가져와. 표로 증명해봐.',
      body_text: '국물은 간이 아니라 여운임. 싱거우면 한 술이 안 넘어감.',
    },
    {
      description:
        '「{title}」 건강식은 심심하다는 말 들었음. 난 간이 맞으면 닭가슴살도 한 끼 맛임. 반박?',
      body_text: '식단은 형벌이 아니라 간·식감 문제임. 건조하면 다음 끼가 폭식임.',
    },
    {
      description:
        '난 단백질 매끼가 한 입 밀도라고 봄. 「{title}」 쪽 탄수 폭주는 한 시간 뒤 또 배고픔. 표로 와봐.',
      body_text: '단백질은 숙제가 아니라 포만임. 없으면 야식이 기본값이 됨.',
    },
    {
      description:
        '「{title}」 흰쌀·자극만 진리면 혀가 지침. 난 현미·샐러드 식감이 한 술을 더 가게 함. 나와봐.',
      body_text: '건강식은 심심함이 아니라 씹는 맛임. 자극만 세면 중간에 질림.',
    },
    {
      description:
        '난 제로가 단맛 볼륨 조절이라고 봄. 「{title}」 쪽 당 폭주 한 잔이 다음 끼를 망침. 반박?',
      body_text: '제로는 속임수가 아니라 후식 방어임. 혀만 달래면 폭식이 줄어듦.',
    },
  ],
}

const FALLBACK = BOT_CHALLENGE_COPY.eternal_quest[0]

export function mapBotChallengeCategoryKey(raw) {
  const blob = String(raw || '').trim().toLowerCase()
  if (!blob) return 'eternal_quest'
  if (blob === 'eternal_quest' || blob === 'fashion' || blob === '맛집' || blob === '맛식') return blob
  if (blob.includes('eternal') || blob.includes('영원한')) return 'eternal_quest'
  if (blob.includes('fashion') || blob.includes('패션')) return 'fashion'
  if (blob.includes('맛식') || blob.includes('food_taste')) return '맛식'
  if (blob.includes('맛집') || blob.includes('food_place') || blob.includes('food_gourmet')) return '맛집'
  return 'eternal_quest'
}

function clipTitle(title) {
  const t = String(title || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return '이 주제'
  return [...t].slice(0, TITLE_MAX).join('')
}

function clipChars(s, max) {
  return [...String(s || '')].slice(0, max).join('')
}

export function composeBotChallengeCopy({ category, title } = {}) {
  const key = mapBotChallengeCategoryKey(category)
  const pool = BOT_CHALLENGE_COPY[key] || BOT_CHALLENGE_COPY.eternal_quest
  const row = pool[Math.floor(Math.random() * pool.length)] || FALLBACK
  const filled = row.description.replaceAll('{title}', clipTitle(title))
  return {
    description: clipChars(filled, DESC_MAX),
    bodyText: clipChars(row.body_text, BODY_MAX),
  }
}

function isBotGeneratedMediaUrl(url) {
  return String(url || '').includes('/bot/')
}

/**
 * 회원 사진·영상을 가져다 쓴 봇 도전만 걷어낸다.
 * 봇이 새로 만든 `/bot/` 이미지와, A측 이미지 형식 도전은 텍스트로 바꾸지 않는다.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function stripBorrowedBotChallengeMedia(supabase) {
  const { data: bots, error: botErr } = await supabase.from('profiles').select('id').eq('is_bot', true)
  if (botErr) throw botErr
  const botIds = (bots || []).map((b) => b.id).filter(Boolean)
  if (!botIds.length) return { attempted: 0, updated: 0 }

  const rows = []
  const chunk = 80
  for (let i = 0; i < botIds.length; i += chunk) {
    const part = botIds.slice(i, i + chunk)
    const { data, error } = await supabase
      .from('matchups')
      .select('id, left_type, right_type, right_url, right_text, right_description')
      .in('right_user_id', part)
      .in('right_type', ['image', 'video'])
    if (error) {
      const { data: fallback, error: fallbackErr } = await supabase
        .from('matchups')
        .select('id, left_type, right_type, right_url, right_text')
        .in('right_user_id', part)
        .in('right_type', ['image', 'video'])
      if (fallbackErr) throw fallbackErr
      rows.push(...(fallback || []))
    } else {
      rows.push(...(data || []))
    }
  }

  let updated = 0
  const errors = []
  for (const row of rows) {
    if (isBotGeneratedMediaUrl(row.right_url)) continue
    if (row.left_type === 'video') continue
    if (row.left_type === 'image' && row.right_type === 'image') {
      if (!row.right_url) continue
      const { error } = await supabase
        .from('matchups')
        .update({
          right_url: null,
          right_thumbnail_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
      if (error) errors.push(error.message)
      else updated += 1
      continue
    }
    const body = String(row.right_text || row.right_description || '난 이쪽이 실전임. 표로 와봐.').trim()
    const { error } = await supabase
      .from('matchups')
      .update({
        right_type: 'text',
        right_url: null,
        right_thumbnail_url: null,
        right_text: body.slice(0, 200),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    if (error) errors.push(error.message)
    else updated += 1
  }

  return {
    attempted: rows.length,
    updated,
    ...(errors.length ? { errors: errors.slice(0, 5) } : {}),
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[] | null | undefined} [challengedIds] null/undefined 이면 최근 12분 봇 도전을 찾아 보정
 */
export async function applyBotChallengeCopy(supabase, challengedIds) {
  let ids
  if (challengedIds == null) {
    const since = new Date(Date.now() - 12 * 60 * 1000).toISOString()
    const { data: recent, error } = await supabase
      .from('matchups')
      .select('id, right_user_id')
      .not('right_user_id', 'is', null)
      .gte('challenger_joined_at', since)
      .eq('is_demo', false)
    if (error) throw error
    const userIds = [...new Set((recent || []).map((r) => r.right_user_id).filter(Boolean))]
    if (!userIds.length) return { attempted: 0, updated: 0, skipped: 'none' }
    const { data: bots, error: botErr } = await supabase.from('profiles').select('id').in('id', userIds).eq('is_bot', true)
    if (botErr) throw botErr
    const botSet = new Set((bots || []).map((b) => b.id))
    ids = (recent || []).filter((r) => botSet.has(r.right_user_id)).map((r) => r.id)
  } else {
    ids = challengedIds.map((id) => String(id || '').trim()).filter(Boolean)
  }

  if (!ids.length) return { attempted: 0, updated: 0, skipped: 'none' }

  let updated = 0
  const errors = []
  for (const id of ids) {
    const { data: row, error: readErr } = await supabase
      .from('matchups')
      .select('id, title, category, left_type, right_type')
      .eq('id', id)
      .maybeSingle()
    if (readErr || !row) {
      errors.push(readErr?.message || 'missing')
      continue
    }
    const copy = composeBotChallengeCopy({ category: row.category, title: row.title })
    const patch = {
      right_description: copy.description,
      updated_at: new Date().toISOString(),
    }
    if (row.left_type === 'image') {
      patch.right_type = 'image'
      patch.right_text = null
    } else {
      patch.right_type = 'text'
      patch.right_text = copy.bodyText
      patch.right_url = null
      patch.right_thumbnail_url = null
    }
    const { error: upErr } = await supabase.from('matchups').update(patch).eq('id', id)
    if (upErr) errors.push(upErr.message)
    else updated += 1
  }

  return {
    attempted: ids.length,
    updated,
    ...(errors.length ? { errors: errors.slice(0, 5) } : {}),
  }
}
