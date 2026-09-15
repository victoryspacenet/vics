-- =============================================================================
-- 가상 투표 봇 Disk IO 절감 (1회)
-- 조회/표 인플레는 30분마다, 한 틱에 매치업 소수만 갱신.
-- 텍스트 생성·도전은 virtual-vote-bots, 이미지 생성·도전은 virtual-bot-images.
-- 전체 supabase_virtual_vote_bots.sql 은 시드가 있어 재실행하지 마세요.
-- =============================================================================

UPDATE public.admin_settings
SET value = COALESCE(value, '{}'::jsonb)
  || CASE WHEN value ? 'interval_minutes' THEN '{}'::jsonb ELSE '{"interval_minutes": 30}'::jsonb END
  || CASE WHEN value ? 'max_view_matchups_per_run' THEN '{}'::jsonb ELSE '{"max_view_matchups_per_run": 15}'::jsonb END
  || CASE WHEN value ? 'max_vote_matchups_per_run' THEN '{}'::jsonb ELSE '{"max_vote_matchups_per_run": 8}'::jsonb END
WHERE key = 'virtual_vote_bots';

CREATE OR REPLACE FUNCTION public.run_virtual_vote_bots()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg jsonb;
  v_enabled text;
  v_interval_min integer;
  v_max_views integer;
  v_max_votes integer;
  v_last timestamptz;
  v_ids uuid[];
  v_matchup record;
  v_bot record;
  v_side text;
  v_votes_added integer := 0;
  v_views_added integer := 0;
  v_matchups_touched integer := 0;
  v_n integer;
  v_bot_vote_count integer;
  v_inserted integer;
  v_human record;
  v_left_n integer;
  v_left_remain integer;
  v_right_remain integer;
  v_left_share numeric;
  v_bot_left integer;
  v_desired_left integer;
BEGIN
  PERFORM pg_advisory_xact_lock(829104573301);

  SELECT value INTO v_cfg
  FROM public.admin_settings
  WHERE key = 'virtual_vote_bots';

  v_enabled := COALESCE(v_cfg->>'enabled', 'true');
  IF lower(v_enabled) IN ('false', '0', 'off', 'no') THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'disabled');
  END IF;

  v_interval_min := GREATEST(10, LEAST(180, COALESCE((v_cfg->>'interval_minutes')::integer, 30)));
  v_max_views := GREATEST(1, LEAST(40, COALESCE((v_cfg->>'max_view_matchups_per_run')::integer, 15)));
  v_max_votes := GREATEST(0, LEAST(v_max_views, COALESCE((v_cfg->>'max_vote_matchups_per_run')::integer, 8)));

  BEGIN
    v_last := (v_cfg->>'last_run_at')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    v_last := NULL;
  END;

  IF v_last IS NOT NULL AND v_last > now() - (v_interval_min * interval '1 minute') THEN
    RETURN jsonb_build_object(
      'ok', true,
      'skipped', 'interval',
      'interval_minutes', v_interval_min
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE COALESCE(is_bot, false) LIMIT 1) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_bot_profiles');
  END IF;

  SELECT COALESCE(array_agg(s.id), ARRAY[]::uuid[])
  INTO v_ids
  FROM (
    SELECT m.id
    FROM public.matchups m
    WHERE COALESCE(m.status, 'active') = 'active'
      AND COALESCE(m.is_demo, false) = false
      AND m.created_at <= now() - interval '10 minutes'
      AND m.created_at > now() - interval '14 days'
      AND COALESCE(m.view_count, 0) < 2500
      AND m.challenger_forfeit_at IS NULL
      AND (
        m.right_type IS NULL
        OR m.expires_at IS NULL
        OR m.expires_at > now()
      )
    ORDER BY
      CASE
        WHEN m.right_type IS NOT NULL AND (m.expires_at IS NULL OR m.expires_at > now()) THEN 0
        ELSE 1
      END,
      random()
    LIMIT v_max_views
  ) s;

  v_matchups_touched := COALESCE(cardinality(v_ids), 0);

  IF v_matchups_touched > 0 THEN
    WITH picked AS (
      SELECT t.id, (2 + floor(random() * 11)::integer) AS d
      FROM unnest(v_ids) AS t(id)
    ),
    upd AS (
      UPDATE public.matchups m
      SET
        view_count = COALESCE(m.view_count, 0) + p.d,
        updated_at = now()
      FROM picked p
      WHERE m.id = p.id
      RETURNING p.d
    )
    SELECT COALESCE(SUM(d), 0)::integer INTO v_views_added FROM upd;
  END IF;

  IF v_max_votes > 0 AND v_matchups_touched > 0 THEN
    FOR v_matchup IN
      SELECT m.id, m.right_type, m.expires_at
      FROM public.matchups m
      WHERE m.id = ANY(v_ids)
        AND m.right_type IS NOT NULL
        AND (m.expires_at IS NULL OR m.expires_at > now())
      ORDER BY random()
      LIMIT v_max_votes
    LOOP
      SELECT
        count(*)::integer,
        count(*) FILTER (WHERE v.side = 'left')::integer
      INTO v_bot_vote_count, v_bot_left
      FROM public.votes v
      JOIN public.profiles p ON p.id = v.user_id
      WHERE v.matchup_id = v_matchup.id
        AND COALESCE(p.is_bot, false);

      IF v_bot_vote_count >= 32 THEN
        CONTINUE;
      END IF;

      v_n := 1 + floor(random() * 4)::integer;
      IF v_bot_vote_count + v_n > 32 THEN
        v_n := GREATEST(0, 32 - v_bot_vote_count);
      END IF;
      IF v_n <= 0 THEN
        CONTINUE;
      END IF;

      SELECT * INTO v_human FROM public.matchup_human_vote_counts(v_matchup.id);
      IF COALESCE(v_human.total_c, 0) <= 0 THEN
        CONTINUE;
      END IF;

      IF v_human.left_c = 0 THEN
        v_left_share := 0.1;
      ELSIF v_human.right_c = 0 THEN
        v_left_share := 0.9;
      ELSE
        v_left_share := v_human.left_c::numeric / v_human.total_c;
      END IF;

      v_desired_left := ROUND((COALESCE(v_bot_vote_count, 0) + v_n) * v_left_share)::integer;
      v_left_n := v_desired_left - COALESCE(v_bot_left, 0);
      IF v_left_n < 0 THEN
        v_left_n := 0;
      END IF;
      IF v_left_n > v_n THEN
        v_left_n := v_n;
      END IF;
      v_left_remain := v_left_n;
      v_right_remain := v_n - v_left_n;

      FOR v_bot IN
        SELECT p.id
        FROM public.profiles p
        WHERE COALESCE(p.is_bot, false)
          AND NOT EXISTS (
            SELECT 1 FROM public.votes v
            WHERE v.user_id = p.id AND v.matchup_id = v_matchup.id
          )
        ORDER BY random()
        LIMIT v_n
      LOOP
        IF v_left_remain > 0 AND v_right_remain > 0 THEN
          IF random() < (v_left_remain::numeric / (v_left_remain + v_right_remain)) THEN
            v_side := 'left';
            v_left_remain := v_left_remain - 1;
          ELSE
            v_side := 'right';
            v_right_remain := v_right_remain - 1;
          END IF;
        ELSIF v_left_remain > 0 THEN
          v_side := 'left';
          v_left_remain := v_left_remain - 1;
        ELSE
          v_side := 'right';
          v_right_remain := v_right_remain - 1;
        END IF;

        BEGIN
          INSERT INTO public.votes (user_id, matchup_id, side)
          VALUES (v_bot.id, v_matchup.id, v_side);
          GET DIAGNOSTICS v_inserted = ROW_COUNT;
          v_votes_added := v_votes_added + v_inserted;
        EXCEPTION WHEN unique_violation THEN
          NULL;
        END;
      END LOOP;
    END LOOP;
  END IF;

  UPDATE public.admin_settings
  SET value = COALESCE(value, '{}'::jsonb)
    || jsonb_build_object('last_run_at', now())
  WHERE key = 'virtual_vote_bots';

  RETURN jsonb_build_object(
    'ok', true,
    'matchups_touched', v_matchups_touched,
    'votes_added', v_votes_added,
    'views_added', v_views_added,
    'interval_minutes', v_interval_min,
    'max_view_matchups_per_run', v_max_views,
    'max_vote_matchups_per_run', v_max_votes
  );
END;
$$;

COMMENT ON FUNCTION public.run_virtual_vote_bots() IS
  '조회/표 인플레는 interval_minutes(기본 30분)마다, 한 틱에 max_view_matchups_per_run(기본 15)건만 일괄 갱신. 사람 표 비율대로 봇 투표(100:0은 90:10).';

CREATE INDEX IF NOT EXISTS matchups_virtual_vote_bots_idx
  ON public.matchups (created_at DESC)
  WHERE COALESCE(status, 'active') = 'active'
    AND COALESCE(is_demo, false) = false
    AND challenger_forfeit_at IS NULL;
