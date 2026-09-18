-- =============================================================================
-- VICS — 관전봇이 같은 게시물(제목·본문)을 다시 올리지 않음
-- 선행: supabase_virtual_bot_matchups.sql
-- 이 파일만 실행하면 됩니다. 전체 matchups 파일 재실행 금지.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.bot_pick_prompt(p_category text)
RETURNS public.virtual_bot_matchup_prompts
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.virtual_bot_matchup_prompts;
BEGIN
  SELECT * INTO v_row
  FROM public.virtual_bot_matchup_prompts p
  WHERE p.category_id = p_category
    AND NOT EXISTS (
      SELECT 1 FROM public.matchups m
      WHERE COALESCE(m.is_demo, false) = false
        AND (
          m.title = p.title
          OR (
            NULLIF(trim(COALESCE(p.body_text, '')), '') IS NOT NULL
            AND m.left_text IS NOT NULL
            AND m.left_text = p.body_text
          )
        )
        AND m.created_at > now() - interval '28 days'
    )
  ORDER BY random()
  LIMIT 1;

  IF FOUND THEN
    RETURN v_row;
  END IF;

  SELECT * INTO v_row
  FROM public.virtual_bot_matchup_prompts p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.matchups m
    WHERE COALESCE(m.is_demo, false) = false
      AND (
        m.title = p.title
        OR (
          NULLIF(trim(COALESCE(p.body_text, '')), '') IS NOT NULL
          AND m.left_text IS NOT NULL
          AND m.left_text = p.body_text
        )
      )
      AND m.created_at > now() - interval '28 days'
  )
  ORDER BY random()
  LIMIT 1;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.bot_pick_prompt(text) IS
  '관전봇 생성 주제. 28일 안에 같은 제목·본문이 있으면 고르지 않음. 없으면 빈 행(생성 생략).';

REVOKE ALL ON FUNCTION public.bot_pick_prompt(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bot_pick_prompt(text) FROM anon;
REVOKE ALL ON FUNCTION public.bot_pick_prompt(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.bot_pick_prompt(text) TO service_role;
