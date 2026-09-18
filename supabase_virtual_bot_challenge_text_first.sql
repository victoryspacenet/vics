-- 관전봇: 텍스트 생성·도전만 RPC에서 처리. 한도는 Netlify가 넘김 (전체 10% 텍스트).
-- 이미지 생성·도전은 사진 전용 스케줄이 OpenAI 성공 후에만.
-- 전체 supabase_virtual_bot_matchups.sql 재실행 금지. 이 파일만 실행.

DROP FUNCTION IF EXISTS public.run_virtual_bot_matchups();
DROP FUNCTION IF EXISTS public.run_virtual_bot_matchups(integer, integer);

CREATE OR REPLACE FUNCTION public.run_virtual_bot_matchups(
  p_max_create integer DEFAULT NULL,
  p_max_challenge integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg jsonb;
  v_enabled text;
  v_interval interval;
  v_max_create integer;
  v_max_challenge integer;
  v_bot record;
  v_target record;
  v_prompt public.virtual_bot_matchup_prompts;
  v_category text;
  v_created integer := 0;
  v_challenged integer := 0;
  v_skipped_create integer := 0;
  v_skipped_challenge integer := 0;
  v_updated integer;
  v_has_right_desc boolean;
  v_created_ids uuid[] := ARRAY[]::uuid[];
  v_new_id uuid;
  v_prompt_key text;
  v_chal_desc text;
  v_chal_body text;
  v_right_type text;
  v_right_text text;
  v_challenged_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  PERFORM pg_advisory_xact_lock(829104573302);

  SELECT value INTO v_cfg
  FROM public.admin_settings
  WHERE key = 'virtual_bot_matchups';

  v_enabled := COALESCE(v_cfg->>'enabled', 'true');
  IF lower(v_enabled) IN ('false', '0', 'off', 'no') THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'disabled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE COALESCE(is_bot, false) LIMIT 1) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_bot_profiles');
  END IF;

  v_interval := make_interval(hours => GREATEST(1, COALESCE((v_cfg->>'interval_hours')::integer, 48)));
  -- JS가 넘긴 값이 텍스트 10% 한도. 인자 없으면 텍스트 생성·도전을 하지 않는다(이미지 스케줄이 담당).
  v_max_create := GREATEST(0, LEAST(20, COALESCE(p_max_create, 0)));
  v_max_challenge := GREATEST(0, LEAST(20, COALESCE(p_max_challenge, 0)));

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'matchups' AND column_name = 'right_description'
  ) INTO v_has_right_desc;

  -- 1) 텍스트 NEW 도전 (사람/봇 구분 없음)
  IF v_max_challenge > 0 THEN
  FOR v_bot IN
    SELECT p.id, COALESCE(NULLIF(trim(p.nickname), ''), 'B') AS nickname
    FROM public.profiles p
    WHERE COALESCE(p.is_bot, false)
      AND NOT EXISTS (
        SELECT 1
        FROM public.matchups m
        WHERE m.right_user_id = p.id
          AND COALESCE(m.challenger_joined_at, m.updated_at) > now() - v_interval
      )
    ORDER BY random()
    LIMIT v_max_challenge
  LOOP
    SELECT m.id, m.category, m.title
    INTO v_target
    FROM public.matchups m
    WHERE COALESCE(m.status, 'active') = 'active'
      AND m.right_type IS NULL
      AND COALESCE(m.is_demo, false) = false
      AND m.challenger_forfeit_at IS NULL
      AND m.user_id IS DISTINCT FROM v_bot.id
      AND COALESCE(m.left_type, 'text') = 'text'
      AND m.id <> ALL(v_challenged_ids)
    ORDER BY random()
    LIMIT 1;

    IF NOT FOUND THEN
      v_skipped_challenge := v_skipped_challenge + 1;
      CONTINUE;
    END IF;

    v_category := COALESCE(NULLIF(v_target.category, ''), public.bot_random_category_id());
    SELECT c.description, c.body_text
    INTO v_chal_desc, v_chal_body
    FROM public.bot_pick_challenge_copy(v_category, v_target.title) c;
    IF v_chal_body IS NULL AND v_chal_desc IS NULL THEN
      v_skipped_challenge := v_skipped_challenge + 1;
      CONTINUE;
    END IF;

    v_chal_body := COALESCE(v_chal_body, '난 이쪽이 실전임. 표로 와봐.');
    v_right_type := 'text';
    v_right_text := v_chal_body;

    BEGIN
      IF v_has_right_desc THEN
        UPDATE public.matchups
        SET
          right_description = v_chal_desc,
          right_type = v_right_type,
          right_url = NULL,
          right_text = v_right_text,
          right_thumbnail_url = NULL,
          right_label = v_bot.nickname,
          right_user_id = v_bot.id,
          is_complete = true,
          challenger_joined_at = now(),
          expires_at = now() + interval '48 hours',
          updated_at = now()
        WHERE id = v_target.id
          AND right_type IS NULL;
      ELSE
        UPDATE public.matchups
        SET
          right_type = v_right_type,
          right_url = NULL,
          right_text = v_right_text,
          right_thumbnail_url = NULL,
          right_label = v_bot.nickname,
          right_user_id = v_bot.id,
          is_complete = true,
          challenger_joined_at = now(),
          expires_at = now() + interval '48 hours',
          updated_at = now()
        WHERE id = v_target.id
          AND right_type IS NULL;
      END IF;
      GET DIAGNOSTICS v_updated = ROW_COUNT;
      IF v_updated > 0 THEN
        v_challenged := v_challenged + 1;
        v_challenged_ids := array_append(v_challenged_ids, v_target.id);
      ELSE
        v_skipped_challenge := v_skipped_challenge + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_skipped_challenge := v_skipped_challenge + 1;
    END;
  END LOOP;
  END IF;

  -- 2) 텍스트 생성. 이미지 생성은 Netlify가 사진 성공 후에만.
  IF v_max_create > 0 THEN
  FOR v_bot IN
    SELECT p.id, COALESCE(NULLIF(trim(p.nickname), ''), 'A') AS nickname
    FROM public.profiles p
    WHERE COALESCE(p.is_bot, false)
      AND NOT EXISTS (
        SELECT 1
        FROM public.matchups m
        WHERE m.user_id = p.id
          AND m.created_at > now() - v_interval
      )
    ORDER BY random()
    LIMIT v_max_create
  LOOP
    v_category := public.bot_random_category_id();
    v_prompt_key := public.bot_admin_category_prompt_key(v_category);
    IF v_prompt_key IS NULL THEN
      v_skipped_create := v_skipped_create + 1;
      CONTINUE;
    END IF;
    v_prompt := public.bot_pick_prompt(v_prompt_key);
    IF v_prompt.id IS NULL THEN
      v_skipped_create := v_skipped_create + 1;
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.matchups m
      WHERE COALESCE(m.is_demo, false) = false
        AND m.created_at > now() - interval '28 days'
        AND (
          m.title = v_prompt.title
          OR (
            NULLIF(trim(COALESCE(v_prompt.body_text, '')), '') IS NOT NULL
            AND m.left_text IS NOT NULL
            AND m.left_text = v_prompt.body_text
          )
        )
    ) THEN
      v_skipped_create := v_skipped_create + 1;
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO public.matchups (
        user_id,
        title,
        description,
        left_type,
        left_url,
        left_text,
        left_thumbnail_url,
        left_label,
        right_type,
        tags,
        category,
        expires_at,
        status,
        is_complete
      ) VALUES (
        v_bot.id,
        v_prompt.title,
        v_prompt.description,
        'text',
        NULL,
        v_prompt.body_text,
        NULL,
        v_bot.nickname,
        NULL,
        CASE WHEN v_prompt.tags IS NULL OR cardinality(v_prompt.tags) = 0 THEN NULL ELSE v_prompt.tags END,
        v_category,
        now() + interval '48 hours',
        'active',
        false
      )
      RETURNING id INTO v_new_id;
      v_created := v_created + 1;
      IF v_new_id IS NOT NULL THEN
        v_created_ids := array_append(v_created_ids, v_new_id);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_skipped_create := v_skipped_create + 1;
    END;
  END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'created', v_created,
    'created_ids', to_jsonb(COALESCE(v_created_ids, ARRAY[]::uuid[])),
    'challenged', v_challenged,
    'challenged_ids', to_jsonb(COALESCE(v_challenged_ids, ARRAY[]::uuid[])),
    'skipped_create', v_skipped_create,
    'skipped_challenge', v_skipped_challenge,
    'interval_hours', EXTRACT(epoch FROM v_interval) / 3600,
    'max_creates_per_run', v_max_create,
    'max_challenges_per_run', v_max_challenge
  );
END;
$$;

COMMENT ON FUNCTION public.run_virtual_bot_matchups(integer, integer) IS
  '관전봇 텍스트 생성·도전만. 한도는 p_max_* (전체의 10%). 이미지 생성·도전은 사진 전용 스케줄이 성공 후에만. 사람/봇 대기 구분 없음. 영상 건너뜀.';

REVOKE ALL ON FUNCTION public.run_virtual_bot_matchups(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_virtual_bot_matchups(integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.run_virtual_bot_matchups(integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.run_virtual_bot_matchups(integer, integer) TO service_role;
