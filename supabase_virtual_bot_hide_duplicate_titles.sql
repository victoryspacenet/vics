-- =============================================================================
-- VICS — 관전봇 중복 제목 게시물 정리 (1회)
-- 같은 제목의 봇 게시물은 하나만 남기고 status='closed'(비공개)로 돌린다.
-- 남길 글: 실제 유저 도전 → 실제 유저 표 많은 글 → 전체 표 많은 글 → 가장 먼저 올린 글.
-- 실제 유저가 도전했거나 투표한 글은 숨기지 않는다.
-- 정산 트리거는 right_type 변경에만 반응하므로 포인트는 움직이지 않는다.
-- Supabase SQL Editor에서 이 파일 전체를 실행하세요. 여러 번 실행해도 안전합니다.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.virtual_bot_hidden_duplicates (
  matchup_id uuid PRIMARY KEY REFERENCES public.matchups(id) ON DELETE CASCADE,
  title text,
  prev_status text,
  kept_matchup_id uuid,
  hidden_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.virtual_bot_hidden_duplicates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.virtual_bot_hidden_duplicates FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.virtual_bot_hidden_duplicates TO service_role;

WITH bots AS (
  SELECT id FROM public.profiles WHERE COALESCE(is_bot, false)
),
cand AS (
  SELECT
    m.id,
    btrim(m.title) AS t,
    m.created_at,
    COALESCE(m.total_votes, 0) AS total_votes,
    COALESCE(m.status, 'active') AS status,
    (m.right_user_id IS NOT NULL AND m.right_user_id NOT IN (SELECT id FROM bots)) AS human_challenger,
    (
      SELECT count(*)
      FROM public.votes v
      WHERE v.matchup_id = m.id
        AND v.user_id NOT IN (SELECT id FROM bots)
    ) AS human_votes
  FROM public.matchups m
  WHERE m.user_id IN (SELECT id FROM bots)
    AND COALESCE(m.status, 'active') = 'active'
    AND COALESCE(m.is_demo, false) = false
    AND NULLIF(btrim(m.title), '') IS NOT NULL
),
ranked AS (
  SELECT
    c.*,
    row_number() OVER (
      PARTITION BY c.t
      ORDER BY c.human_challenger DESC, c.human_votes DESC, c.total_votes DESC, c.created_at ASC
    ) AS rn,
    first_value(c.id) OVER (
      PARTITION BY c.t
      ORDER BY c.human_challenger DESC, c.human_votes DESC, c.total_votes DESC, c.created_at ASC
    ) AS kept_id
  FROM cand c
),
targets AS (
  SELECT id, t, status, kept_id
  FROM ranked
  WHERE rn > 1
    AND NOT human_challenger
    AND human_votes = 0
),
hidden AS (
  UPDATE public.matchups m
  SET status = 'closed', updated_at = now()
  FROM targets tg
  WHERE m.id = tg.id
  RETURNING m.id, tg.t, tg.status, tg.kept_id
)
INSERT INTO public.virtual_bot_hidden_duplicates (matchup_id, title, prev_status, kept_matchup_id)
SELECT id, t, status, kept_id FROM hidden
ON CONFLICT (matchup_id) DO NOTHING;

-- 결과 확인: 숨긴 건수와 아직 2건 이상 공개 중인 제목(유저 활동이 있어 남긴 글)
SELECT
  (SELECT count(*) FROM public.virtual_bot_hidden_duplicates) AS hidden_total,
  (
    SELECT count(*) FROM (
      SELECT btrim(m.title)
      FROM public.matchups m
      JOIN public.profiles p ON p.id = m.user_id AND COALESCE(p.is_bot, false)
      WHERE COALESCE(m.status, 'active') = 'active'
        AND COALESCE(m.is_demo, false) = false
      GROUP BY btrim(m.title)
      HAVING count(*) > 1
    ) d
  ) AS titles_still_duplicated;

-- 되돌리기 (필요할 때만 주석 해제)
-- UPDATE public.matchups m
-- SET status = h.prev_status, updated_at = now()
-- FROM public.virtual_bot_hidden_duplicates h
-- WHERE m.id = h.matchup_id;
-- DELETE FROM public.virtual_bot_hidden_duplicates;
