/**
 * 관전봇 도전 정리 — 회원 미디어를 가져다 쓴 봇 도전을 걷어낸다.
 * 도전글 본문은 botChallengeWriter.mjs 가 매치업마다 새로 쓴다.
 */

function isBotGeneratedMediaUrl(url) {
  return String(url || '').includes('/bot/')
}

/**
 * 도전을 내리기 전에 그 대결의 표를 지운다.
 * 마감된 글은 표를 지우는 동안 정산이 돌 수 있어서, 먼저 마감을 미래로 밀어 둔다.
 * 표 행을 지우면 DB 트리거가 left/right/total 을 같이 줄인다.
 */
export async function resetMatchupVotes(supabase, matchupId) {
  const now = new Date().toISOString()
  const { error: guardErr } = await supabase
    .from('matchups')
    .update({
      expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      challenger_forfeit_at: null,
      updated_at: now,
    })
    .eq('id', matchupId)
  if (guardErr) throw new Error(guardErr.message)

  const { error } = await supabase.from('votes').delete().eq('matchup_id', matchupId)
  if (error) throw new Error(error.message)
}

const CLEARED_CHALLENGE_VOTES = {
  left_votes: 0,
  right_votes: 0,
  total_votes: 0,
  result_points_settled_at: null,
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
      if (isBotGeneratedMediaUrl(row.right_url)) continue
      await resetMatchupVotes(supabase, row.id)
      const { error } = await supabase
        .from('matchups')
        .update({
          right_type: null,
          right_url: null,
          right_thumbnail_url: null,
          right_text: null,
          right_description: null,
          right_label: null,
          right_user_id: null,
          is_complete: false,
          challenger_joined_at: null,
          ...CLEARED_CHALLENGE_VOTES,
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
