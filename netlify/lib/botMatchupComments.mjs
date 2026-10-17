/**
 * 관전봇 매치업 댓글.
 * 봇 한 명당 48시간에 댓글 하나. 본인 글(왼쪽·오른쪽)에는 쓰지 않는다.
 * 내용은 그 매치업의 단어가 들어가고, 물어보는 문장은 올리지 않는다.
 */
const INTERVAL_MS = 48 * 3600 * 1000
const MAX_PER_RUN = 2
const BOT_ATTEMPTS = 4
const WRITE_TRIES = 2
const OPENAI_TIMEOUT_MS = 7_000
const COMMENT_MIN = 16
const COMMENT_MAX = 90
const STOP_WORDS = new Set([
  '매치업', '이거', '그거', '나는', '내가', '우리', '진짜', '정말', '그냥', '생각', '사람',
  '오늘', '이게', '하는', '하면', '있어', '없어', '같아', '같은', '이거', '저기',
])

function openaiKey() {
  return String(process.env.OPENAI_API_KEY || '').trim()
}

function chatModel() {
  return String(process.env.OPENAI_BOT_CHALLENGE_MODEL || process.env.OPENAI_SIMILARITY_MODEL || 'gpt-4o-mini').trim()
}

function isFatalOpenAiError(err) {
  return /incorrect api key|invalid api key|invalid_api_key|openai 401/i.test(String(err?.message || err || ''))
}

function shuffle(list) {
  const arr = [...list]
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function clipChars(value, max) {
  return [...String(value || '').replace(/\s+/g, ' ').trim()].slice(0, max).join('')
}

export function isAskingComment(text) {
  const s = String(text || '').replace(/\s+/g, ' ').trim()
  if (!s) return true
  if (/[?？]/.test(s)) return true
  if (/(어때|어떻게|어떨|뭐야|뭔데|뭘까|무엇|궁금해|알려\s*줘|알려줘|설명해|어느\s*쪽|어느쪽|할까|할까요|인가요|일까|을까|ㄹ까)/.test(s)) {
    return true
  }
  if (/(?:나요|가요|까요|냐|까)\s*$/.test(s)) return true
  return false
}

export function matchupNeedles(matchup) {
  const tags = Array.isArray(matchup?.tags) ? matchup.tags.join(' ') : ''
  const blob = [
    matchup?.title,
    matchup?.description,
    matchup?.left_text,
    matchup?.right_text,
    matchup?.left_label,
    matchup?.right_label,
    tags,
  ].join(' ')
  const words = blob.match(/[가-힣A-Za-z0-9]{2,}/g) || []
  const stems = words.map((word) => word.replace(/(?:으로|에서|에게|한테|까지|부터|처럼|은|는|이|가|을|를|과|와|도|만|의|에)$/u, ''))
  return [...new Set(stems.filter((word) => !STOP_WORDS.has(word) && word.length >= 2))].slice(0, 48)
}

export function mentionsMatchup(comment, needles) {
  const text = String(comment || '')
  return (needles || []).some((word) => word && text.includes(word))
}

function matchupBrief(matchup) {
  const side = (label, body) => {
    const a = String(label || '').trim()
    const b = String(body || '').trim()
    if (a && b) return `${a}: ${b}`
    return a || b || ''
  }
  return [
    `제목: ${String(matchup?.title || '').trim() || '(없음)'}`,
    `설명: ${String(matchup?.description || '').trim() || '(없음)'}`,
    `A: ${side(matchup?.left_label, matchup?.left_text) || '(없음)'}`,
    `B: ${side(matchup?.right_label, matchup?.right_text) || '(아직 없음)'}`,
  ].join('\n')
}

const WRITER_SYSTEM =
  'You write one short spectator comment on a Korean 1:1 matchup. ' +
  'Voice: a Korean in their early-to-mid 20s, casual 반말, a firm opinion or reaction. ' +
  'Use at least one concrete word that already appears in the title, description, or side text. ' +
  'Never ask a question. No question marks. Do not ask which side is better, what others think, or for an explanation. ' +
  'Do not write as the author. No emoji, no hashtags, no insults, no profanity. ' +
  'Length 20 to 80 Korean characters. ' +
  'If there is no topic to react to, return {"skip":true,"reason_ko":"..."}. ' +
  'Otherwise return JSON only: {"skip":false,"comment":"..."}.'

async function chatJson({ system, userText, timeoutMs }) {
  const key = openaiKey()
  if (!key) return null
  const ac = new AbortController()
  const kill = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: ac.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: chatModel(),
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userText },
        ],
      }),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      throw new Error(`OpenAI ${res.status}: ${t.slice(0, 180)}`)
    }
    const data = await res.json()
    const raw = data?.choices?.[0]?.message?.content
    if (!raw) throw new Error('OpenAI 응답 없음')
    return JSON.parse(raw)
  } finally {
    clearTimeout(kill)
  }
}

async function botsWhoCommentedSince(supabase, botIds, since) {
  const busy = new Set()
  for (let i = 0; i < botIds.length; i += 25) {
    const slice = botIds.slice(i, i + 25)
    let from = 0
    for (;;) {
      const { data, error } = await supabase
        .from('comments')
        .select('user_id')
        .in('user_id', slice)
        .gte('created_at', since)
        .range(from, from + 999)
      if (error) throw error
      for (const row of data || []) {
        if (row.user_id) busy.add(row.user_id)
      }
      if (!data || data.length < 1000) break
      from += 1000
    }
  }
  return busy
}

async function commentedMatchupIds(supabase, botId) {
  const ids = new Set()
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('comments')
      .select('matchup_id')
      .eq('user_id', botId)
      .range(from, from + 499)
    if (error) throw error
    for (const row of data || []) {
      if (row.matchup_id) ids.add(row.matchup_id)
    }
    if (!data || data.length < 500) break
    from += 500
  }
  return ids
}

async function candidateMatchups(supabase) {
  const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString()
  const { data, error } = await supabase
    .from('matchups')
    .select('id, title, description, left_text, left_label, right_text, right_label, tags, user_id, right_user_id, comments_count, challenger_forfeit_at')
    .eq('status', 'active')
    .not('is_demo', 'eq', true)
    .is('challenger_forfeit_at', null)
    .gte('created_at', since)
    .order('comments_count', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(80)
  if (error) throw error
  return data || []
}

function eligibleMatchups(matchups, botId, already, usedThisRun) {
  const rows = (matchups || []).filter((row) => {
    if (!row?.id || usedThisRun.has(row.id) || already.has(row.id)) return false
    if (row.user_id === botId || row.right_user_id === botId) return false
    return matchupNeedles(row).length > 0
  })
  rows.sort((a, b) => (a.comments_count || 0) - (b.comments_count || 0) || Math.random() - 0.5)
  return rows
}

async function writeComment(matchup, extra) {
  const needles = matchupNeedles(matchup)
  const hint = extra ? `\n다시 써라. ${extra}` : ''
  const parsed = await chatJson({
    system: WRITER_SYSTEM,
    userText: `${matchupBrief(matchup)}\n반드시 이 단어 중 하나를 문장 안에 넣어라: ${needles.slice(0, 12).join(', ')}${hint}`,
    timeoutMs: OPENAI_TIMEOUT_MS,
  })
  if (!parsed) return { ok: false, reason: 'no_openai_key' }
  if (parsed.skip) return { ok: false, reason: 'skipped_topic' }
  const comment = clipChars(parsed.comment, COMMENT_MAX)
  if ([...comment].length < COMMENT_MIN) return { ok: false, reason: 'too_short' }
  if (isAskingComment(comment)) return { ok: false, reason: 'question' }
  if (!mentionsMatchup(comment, needles)) return { ok: false, reason: 'unrelated' }
  return { ok: true, comment }
}

async function commentAsBot(supabase, bot, matchups, usedThisRun, started, budgetMs) {
  const already = await commentedMatchupIds(supabase, bot.id)
  const queue = eligibleMatchups(matchups, bot.id, already, usedThisRun)
  const matchup = queue[0]
  if (!matchup) return { posted: false, reason: 'no_matchup' }

  let lastReason = 'no_comment'
  let draft = null
  for (let attempt = 0; attempt < WRITE_TRIES; attempt += 1) {
    if (Date.now() - started > budgetMs) return { posted: false, reason: 'time_budget' }
    try {
      draft = await writeComment(
        matchup,
        attempt === 0 ? '' : '물음표와 질문 없이, 위 단어가 들어간 의견만.',
      )
    } catch (error) {
      if (isFatalOpenAiError(error)) return { posted: false, fatal: true, reason: 'openai_auth' }
      lastReason = error?.message || 'openai_error'
      continue
    }
    if (draft?.ok) break
    lastReason = draft?.reason || 'rejected'
    if (draft?.reason === 'no_openai_key') return { posted: false, reason: 'no_openai_key' }
  }
  if (!draft?.ok) return { posted: false, reason: lastReason }

  const { error } = await supabase.from('comments').insert({
    user_id: bot.id,
    matchup_id: matchup.id,
    content: draft.comment,
    parent_id: null,
  })
  if (error) return { posted: false, reason: error.message || 'insert_failed' }
  usedThisRun.add(matchup.id)
  return { posted: true, matchupId: matchup.id, comment: draft.comment }
}

export async function postBotMatchupComments(supabase, opts = {}) {
  if (!openaiKey()) return { attempted: 0, posted: 0, skipped: 'no_openai_key' }
  const started = opts.started || Date.now()
  const budgetMs = Number(opts.budgetMs) > 0 ? Number(opts.budgetMs) : 22_000

  const { data: bots, error: botErr } = await supabase.from('profiles').select('id').eq('is_bot', true)
  if (botErr) throw botErr
  const all = bots || []
  if (!all.length) return { attempted: 0, posted: 0, skipped: 'no_bots' }

  const since = new Date(Date.now() - INTERVAL_MS).toISOString()
  const busy = await botsWhoCommentedSince(supabase, all.map((bot) => bot.id), since)
  const eligible = shuffle(all.filter((bot) => bot?.id && !busy.has(bot.id)))
  if (!eligible.length) return { attempted: 0, posted: 0, skipped: 'interval' }

  const matchups = await candidateMatchups(supabase)
  const usedThisRun = new Set()
  let attempted = 0
  let posted = 0
  const notes = []

  for (const bot of eligible.slice(0, BOT_ATTEMPTS)) {
    if (posted >= MAX_PER_RUN) break
    if (Date.now() - started > budgetMs) {
      notes.push('time_budget')
      break
    }
    attempted += 1
    const result = await commentAsBot(supabase, bot, matchups, usedThisRun, started, budgetMs)
    if (result.posted) {
      posted += 1
      notes.push('posted')
    } else {
      notes.push(result.reason || 'skip')
    }
    if (result.fatal || result.reason === 'no_openai_key') break
  }

  return { attempted, posted, eligible: eligible.length, notes: notes.slice(0, 8) }
}
