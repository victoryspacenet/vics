-- =============================================================================
-- VICS — 관전봇 매치업 생성·도전 (봇 1명당 48시간에 생성 1 · 도전 1)
-- Supabase SQL Editor에서 `supabase_virtual_vote_bots.sql` 이후 1회 실행하세요.
--
-- 이어서 `supabase_virtual_bot_matchup_prompts.sql` (생성 주제)
--      `supabase_virtual_bot_challenge_prompts.sql` (도전 멘트) 을 실행하세요.
--
-- 동작
--   1) 운영 4카테고리(영원한 난제·패션·맛집·맛식)에서 주제 풀 선택
--   2) 생성은 텍스트로 넣은 뒤 스케줄 함수가 주제 이미지 첨부.
--      도전은 A측 형식에 맞춤(텍스트/이미지). 영상 매치업은 건너뜀. 회원 미디어 재사용 없음.
--   3) 도전 멘트는 생성 주제와 분리: 자랑+도발, 20대 초중반 관점·말투, 상대 제목 반영
--   4) 투표 기간 48시간 (생성 expires_at, 도전 시 현재 시각부터 다시 48시간)
--   5) 사람 NEW 매치업을 우선 도전하고, 없으면 다른 봇의 대기 매치업에 도전
--   6) Netlify `virtual-vote-bots`(10분)가 생성·도전 후 이미지 첨부
--   7) 생성·도전은 Champion 포인트·공개 랭킹에 포함 (자동 투표 Oracle 포인트는 제외)
--
-- 끄기: admin_settings key = virtual_bot_matchups 의 {"enabled": false}
-- 한 틱 한도: {"max_creates_per_run": 3, "max_challenges_per_run": 3}
-- =============================================================================

INSERT INTO public.admin_settings (key, value)
VALUES (
  'virtual_bot_matchups',
  '{"enabled": true, "interval_hours": 48, "max_creates_per_run": 3, "max_challenges_per_run": 3}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS matchups_open_challenge_idx
  ON public.matchups (created_at DESC)
  WHERE right_type IS NULL
    AND COALESCE(status, 'active') = 'active'
    AND COALESCE(is_demo, false) = false;

CREATE INDEX IF NOT EXISTS matchups_bot_created_at_idx
  ON public.matchups (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS matchups_bot_challenged_at_idx
  ON public.matchups (right_user_id, challenger_joined_at DESC);

-- ─────────────────────────────────────────────
-- 프롬프트 풀 (카테고리별 제목·설명·본문·태그)
-- 생성 시 전제: 오른쪽 도전자가 뭘 올릴지 모름.
--   제목 = 열린 경쟁 주제 / 설명 = 자기 자랑+도발 / 본문 = A측 한 방
-- 말투: 대한민국 20대 초중반 (현타, 이득, ㄹㅇ, 각, 나와봐)
-- 카테고리: 맛집=장소·지역·분위기·서비스 탐방 / 맛식=음식 맛·식감
--           영원한 난제=연애·라이프 (정치·종교·젠더 금지)
--           맛식=음식 맛·식감 + 건강식·식단
-- 주제 행은 supabase_virtual_bot_matchup_prompts.sql 에서 TRUNCATE 후 넣습니다.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.virtual_bot_matchup_prompts (
  id bigserial PRIMARY KEY,
  category_id text NOT NULL,
  title text NOT NULL,
  description text,
  body_text text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  image_prompt text
);

ALTER TABLE public.virtual_bot_matchup_prompts
  ADD COLUMN IF NOT EXISTS image_prompt text;

CREATE UNIQUE INDEX IF NOT EXISTS virtual_bot_matchup_prompts_cat_title_idx
  ON public.virtual_bot_matchup_prompts (category_id, title);

ALTER TABLE public.virtual_bot_matchup_prompts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.virtual_bot_challenge_prompts (
  id bigserial PRIMARY KEY,
  category_id text NOT NULL,
  description text NOT NULL,
  body_text text NOT NULL
);

CREATE INDEX IF NOT EXISTS virtual_bot_challenge_prompts_cat_idx
  ON public.virtual_bot_challenge_prompts (category_id);

ALTER TABLE public.virtual_bot_challenge_prompts ENABLE ROW LEVEL SECURITY;

-- 주제 풀(제목·설명·본문)은 supabase_virtual_bot_matchup_prompts.sql 에서 넣습니다.
-- 도전 멘트는 supabase_virtual_bot_challenge_prompts.sql 에서 넣습니다.
-- 이 파일을 재실행해도 프롬프트 행은 지우지 않습니다.

-- ─────────────────────────────────────────────
-- 공개 랭킹에 관전봇 포함 (테스트 메일만 제외)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rank_profile_eligible_for_board(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    INNER JOIN auth.users u ON u.id = p.id
    WHERE p.id = p_id
      AND (
        NULLIF(trim(COALESCE(u.email, '')), '') IS NULL
        OR (
          lower(trim(u.email)) NOT LIKE '%@example.com'
          AND lower(trim(u.email)) NOT LIKE '%@example.org'
          AND lower(trim(u.email)) NOT LIKE '%@test.com'
        )
      )
  );
$$;

COMMENT ON FUNCTION public.rank_profile_eligible_for_board(uuid) IS
  '랭킹/Goat 노출 가능 프로필: auth 연동 + 예시·테스트 메일 제외. 관전봇 포함.';

-- ─────────────────────────────────────────────
-- 매치업 생성 시 total_matchups — 봇 포함, 데모만 제외
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.award_points_on_matchup_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.is_demo, false) THEN
    RETURN NEW;
  END IF;

  UPDATE public.profiles
  SET
    total_matchups = total_matchups + 1,
    updated_at = now()
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.award_points_on_matchup_create() IS
  '매치업 INSERT 시 total_matchups만 증가. 데모만 제외(봇 생성 포함). 포인트는 결과 정산 시.';

-- 정산: 봇 생성자/도전자도 Champion 포인트 지급. 자동 투표 Oracle 포인트는 사람만.
CREATE OR REPLACE FUNCTION public.settle_matchup_result_points(p_matchup_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.matchups;
  v_winner text;
  v_has_votes boolean;
  v_creator_pts integer;
  v_creator_source text;
  v_has_season boolean;
  v_rec record;
  v_creator_rec record;
  v_left integer;
  v_right integer;
  v_total integer;
BEGIN
  SELECT * INTO m FROM public.matchups WHERE id = p_matchup_id FOR UPDATE;
  IF NOT FOUND OR NOT public.matchup_is_ready_for_result_settlement(m) THEN
    RETURN false;
  END IF;

  v_left := COALESCE(m.left_votes, 0);
  v_right := COALESCE(m.right_votes, 0);
  v_total := GREATEST(COALESCE(m.total_votes, 0), v_left + v_right);

  IF m.challenger_forfeit_at IS NOT NULL THEN
    v_winner := 'left';
  ELSIF v_left = v_right THEN
    v_winner := 'draw';
  ELSIF v_left > v_right THEN
    v_winner := 'left';
  ELSE
    v_winner := 'right';
  END IF;

  v_has_votes := v_total > 0 OR m.challenger_forfeit_at IS NOT NULL;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
  ) INTO v_has_season;

  IF v_has_votes THEN
    FOR v_creator_rec IN
      SELECT uid, creator_side
      FROM (
        SELECT m.user_id AS uid, 'left'::text AS creator_side
        UNION ALL
        SELECT m.right_user_id, 'right'::text
        WHERE m.right_user_id IS NOT NULL
      ) sides
      WHERE uid IS NOT NULL
    LOOP
      v_creator_pts := CASE
        WHEN v_winner = 'draw' THEN 30
        WHEN v_winner = v_creator_rec.creator_side THEN 50
        ELSE 10
      END;
      v_creator_source := CASE
        WHEN v_winner = 'draw' THEN 'creator_draw'
        WHEN v_winner = v_creator_rec.creator_side THEN 'creator_win'
        ELSE 'creator_lose'
      END;

      IF NOT EXISTS (
        SELECT 1 FROM public.point_transactions pt
        WHERE pt.user_id = v_creator_rec.uid
          AND pt.related_id = m.id
          AND pt.source IN ('creator_win', 'creator_lose', 'creator_draw')
          AND pt.reversed_at IS NULL
      ) THEN
        IF v_winner = v_creator_rec.creator_side THEN
          IF v_has_season THEN
            UPDATE public.profiles
            SET creator_wins = creator_wins + 1,
                creator_win_streak = creator_win_streak + 1,
                creator_best_streak = GREATEST(creator_best_streak, creator_win_streak + 1),
                season_creator_wins = season_creator_wins + 1,
                champion_points = champion_points + v_creator_pts,
                season_champion_points = season_champion_points + v_creator_pts,
                points = points + v_creator_pts,
                season_points = season_points + v_creator_pts,
                updated_at = now()
            WHERE id = v_creator_rec.uid;
          ELSE
            UPDATE public.profiles
            SET creator_wins = creator_wins + 1,
                creator_win_streak = creator_win_streak + 1,
                creator_best_streak = GREATEST(creator_best_streak, creator_win_streak + 1),
                champion_points = champion_points + v_creator_pts,
                points = points + v_creator_pts,
                updated_at = now()
            WHERE id = v_creator_rec.uid;
          END IF;
        ELSIF v_winner = 'draw' THEN
          IF v_has_season THEN
            UPDATE public.profiles
            SET champion_points = champion_points + v_creator_pts,
                season_champion_points = season_champion_points + v_creator_pts,
                points = points + v_creator_pts,
                season_points = season_points + v_creator_pts,
                updated_at = now()
            WHERE id = v_creator_rec.uid;
          ELSE
            UPDATE public.profiles
            SET champion_points = champion_points + v_creator_pts,
                points = points + v_creator_pts,
                updated_at = now()
            WHERE id = v_creator_rec.uid;
          END IF;
        ELSE
          IF v_has_season THEN
            UPDATE public.profiles
            SET creator_win_streak = 0,
                champion_points = champion_points + v_creator_pts,
                season_champion_points = season_champion_points + v_creator_pts,
                points = points + v_creator_pts,
                season_points = season_points + v_creator_pts,
                updated_at = now()
            WHERE id = v_creator_rec.uid;
          ELSE
            UPDATE public.profiles
            SET creator_win_streak = 0,
                champion_points = champion_points + v_creator_pts,
                points = points + v_creator_pts,
                updated_at = now()
            WHERE id = v_creator_rec.uid;
          END IF;
        END IF;
        PERFORM public.insert_point_transaction(v_creator_rec.uid, v_creator_pts, v_creator_source, m.id);
      END IF;
    END LOOP;
  END IF;

  IF v_has_votes THEN
    FOR v_rec IN
      SELECT v.user_id, v.side,
        CASE
          WHEN v_winner = 'draw' THEN 15
          WHEN v.side = v_winner THEN 25
          ELSE 5
        END AS pts,
        CASE
          WHEN v_winner = 'draw' THEN 'voter_draw'
          WHEN v.side = v_winner THEN 'voter_win'
          ELSE 'voter_lose'
        END AS src
      FROM public.votes v
      LEFT JOIN public.profiles bp ON bp.id = v.user_id
      WHERE v.matchup_id = m.id
        AND NOT COALESCE(bp.is_bot, false)
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.point_transactions pt
        WHERE pt.user_id = v_rec.user_id
          AND pt.related_id = m.id
          AND pt.source IN ('voter_win', 'voter_lose', 'voter_draw')
          AND pt.reversed_at IS NULL
      ) THEN
        CONTINUE;
      END IF;

      IF v_has_season THEN
        UPDATE public.profiles
        SET vote_total = vote_total + 1,
            vote_hits = vote_hits + CASE WHEN v_winner != 'draw' AND v_rec.side = v_winner THEN 1 ELSE 0 END,
            oracle_points = oracle_points + v_rec.pts,
            points = points + v_rec.pts,
            season_vote_total = season_vote_total + 1,
            season_vote_hits = season_vote_hits + CASE WHEN v_winner != 'draw' AND v_rec.side = v_winner THEN 1 ELSE 0 END,
            season_oracle_points = season_oracle_points + v_rec.pts,
            season_points = season_points + v_rec.pts,
            updated_at = now()
        WHERE id = v_rec.user_id;
      ELSE
        UPDATE public.profiles
        SET vote_total = vote_total + 1,
            vote_hits = vote_hits + CASE WHEN v_winner != 'draw' AND v_rec.side = v_winner THEN 1 ELSE 0 END,
            oracle_points = oracle_points + v_rec.pts,
            points = points + v_rec.pts,
            updated_at = now()
        WHERE id = v_rec.user_id;
      END IF;
      PERFORM public.insert_point_transaction(v_rec.user_id, v_rec.pts, v_rec.src, m.id);
    END LOOP;
  END IF;

  UPDATE public.matchups
  SET result_points_settled_at = now(),
      updated_at = now()
  WHERE id = m.id;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.settle_matchup_result_points(uuid) IS
  '매치업 1건 승/패/무 포인트 정산 — 봇 포함 표로 승자. Champion은 사람+봇 생성/도전, Oracle은 사람만.';
CREATE OR REPLACE FUNCTION public.bot_random_category_id()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
BEGIN
  SELECT x.id INTO v_id
  FROM (
    SELECT jsonb_array_elements(c.data->'activeCategories')->>'id' AS id
    FROM public.category_admin_config c
    WHERE c.id = 'default'
  ) x
  WHERE x.id IS NOT NULL AND length(trim(x.id)) > 0
  ORDER BY random()
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  SELECT p.category_id INTO v_id
  FROM public.virtual_bot_matchup_prompts p
  ORDER BY random()
  LIMIT 1;

  RETURN COALESCE(v_id, 'eternal_quest');
END;
$$;

CREATE OR REPLACE FUNCTION public.bot_pick_prompt(p_category text)
RETURNS public.virtual_bot_matchup_prompts
LANGUAGE plpgsql
STABLE
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
      WHERE m.title = p.title
        AND m.created_at > now() - interval '21 days'
        AND COALESCE(m.is_demo, false) = false
    )
  ORDER BY random()
  LIMIT 1;

  IF FOUND THEN
    RETURN v_row;
  END IF;

  SELECT * INTO v_row
  FROM public.virtual_bot_matchup_prompts p
  WHERE p.category_id = p_category
  ORDER BY random()
  LIMIT 1;

  IF FOUND THEN
    RETURN v_row;
  END IF;

  SELECT * INTO v_row
  FROM public.virtual_bot_matchup_prompts p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.matchups m
    WHERE m.title = p.title
      AND m.created_at > now() - interval '21 days'
      AND COALESCE(m.is_demo, false) = false
  )
  ORDER BY random()
  LIMIT 1;

  IF FOUND THEN
    RETURN v_row;
  END IF;

  SELECT * INTO v_row
  FROM public.virtual_bot_matchup_prompts
  ORDER BY random()
  LIMIT 1;

  RETURN v_row;
END;
$$;

-- 운영 활성 카테고리 id(예: cat_wpxy=맛집) → 주제 풀 키(eternal_quest/fashion/맛집/맛식)
-- 맛집=장소·탐방, 맛식=음식 맛, 영원한 난제=연애·라이프(정치·종교·젠더 금지)
CREATE OR REPLACE FUNCTION public.bot_admin_category_prompt_key(p_admin_id text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label text;
  v_slug text;
  v_blob text;
BEGIN
  IF p_admin_id IS NULL OR length(trim(p_admin_id)) = 0 THEN
    RETURN NULL;
  END IF;

  IF trim(p_admin_id) IN ('eternal_quest', 'fashion', '맛집', '맛식') THEN
    RETURN trim(p_admin_id);
  END IF;

  SELECT x.label, x.slug INTO v_label, v_slug
  FROM (
    SELECT e->>'id' AS id, e->>'label' AS label, e->>'slug' AS slug
    FROM public.category_admin_config c,
         jsonb_array_elements(COALESCE(c.data->'activeCategories', '[]'::jsonb)) e
    WHERE c.id = 'default'
  ) x
  WHERE x.id = trim(p_admin_id)
  LIMIT 1;

  v_blob := lower(trim(both FROM concat_ws(' ', p_admin_id, v_label, v_slug)));

  IF v_blob ~ '영원한' OR v_blob LIKE '%eternal%' THEN
    RETURN 'eternal_quest';
  END IF;
  IF v_blob ~ '패션' OR v_blob LIKE '%fashion%' THEN
    RETURN 'fashion';
  END IF;
  IF v_blob ~ '맛식' THEN
    RETURN '맛식';
  END IF;
  IF v_blob ~ '맛집' THEN
    RETURN '맛집';
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.bot_pick_challenge_copy(p_category text, p_title text)
RETURNS TABLE(description text, body_text text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_title text;
  v_desc text;
  v_body text;
BEGIN
  v_key := COALESCE(public.bot_admin_category_prompt_key(p_category), p_category, 'eternal_quest');
  v_title := NULLIF(left(btrim(regexp_replace(COALESCE(p_title, ''), '\s+', ' ', 'g')), 28), '');
  IF v_title IS NULL THEN
    v_title := '이 주제';
  END IF;

  SELECT
    left(replace(p.description, '{title}', v_title), 200),
    left(p.body_text, 200)
  INTO v_desc, v_body
  FROM public.virtual_bot_challenge_prompts p
  WHERE p.category_id = v_key
  ORDER BY random()
  LIMIT 1;

  IF v_desc IS NULL THEN
    SELECT
      left(replace(p.description, '{title}', v_title), 200),
      left(p.body_text, 200)
    INTO v_desc, v_body
    FROM public.virtual_bot_challenge_prompts p
    ORDER BY random()
    LIMIT 1;
  END IF;

  IF v_desc IS NULL THEN
    v_desc := left(
      '「' || v_title || '」 봤는데 난 반대가 실전임. 듣기 좋은 말은 인스타용이고 평일엔 내 쪽이 이득. 표로 와봐.',
      200
    );
    v_body := '그 논리 3일이면 현타임. 난 시간·멘탈 지키는 쪽이 맞음.';
  END IF;

  RETURN QUERY SELECT v_desc, v_body;
END;
$$;

-- ─────────────────────────────────────────────
-- 본체: 도전 우선(대기 NEW 해소) → 생성
-- 도전은 A측 형식에 맞춤(텍스트·이미지). 영상은 건너뜀. 회원 사진·영상은 쓰지 않는다.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.run_virtual_bot_matchups()
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
  v_left_type text;
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
  v_max_create := GREATEST(0, LEAST(20, COALESCE((v_cfg->>'max_creates_per_run')::integer, 3)));
  v_max_challenge := GREATEST(0, LEAST(20, COALESCE((v_cfg->>'max_challenges_per_run')::integer, 3)));

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'matchups' AND column_name = 'right_description'
  ) INTO v_has_right_desc;

  -- 1) 도전
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
    SELECT m.id, m.category, m.title, COALESCE(m.left_type, 'text') AS left_type
    INTO v_target
    FROM public.matchups m
    LEFT JOIN public.profiles owner ON owner.id = m.user_id
    WHERE COALESCE(m.status, 'active') = 'active'
      AND m.right_type IS NULL
      AND COALESCE(m.is_demo, false) = false
      AND m.challenger_forfeit_at IS NULL
      AND m.user_id IS DISTINCT FROM v_bot.id
      AND COALESCE(m.left_type, 'text') IN ('text', 'image')
    ORDER BY
      CASE WHEN COALESCE(owner.is_bot, false) THEN 1 ELSE 0 END,
      random()
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
    v_left_type := COALESCE(v_target.left_type, 'text');
    IF v_left_type = 'image' THEN
      v_right_type := 'image';
      v_right_text := NULL;
    ELSE
      v_right_type := 'text';
      v_right_text := v_chal_body;
    END IF;

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

  -- 2) 생성 (도전자 대기 NEW)
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

    -- 생성은 텍스트로 넣고, 스케줄 함수가 주제 이미지를 붙인다. 회원 미디어는 쓰지 않는다.
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

  RETURN jsonb_build_object(
    'ok', true,
    'created', v_created,
    'created_ids', to_jsonb(COALESCE(v_created_ids, ARRAY[]::uuid[])),
    'challenged', v_challenged,
    'challenged_ids', to_jsonb(COALESCE(v_challenged_ids, ARRAY[]::uuid[])),
    'skipped_create', v_skipped_create,
    'skipped_challenge', v_skipped_challenge,
    'interval_hours', EXTRACT(epoch FROM v_interval) / 3600
  );
END;
$$;

COMMENT ON FUNCTION public.run_virtual_bot_matchups() IS
  '관전봇 1명당 48시간에 매치업 1개 생성 + 1개 도전. 도전은 A측 텍스트/이미지 형식에 맞춤(영상은 건너뜀). 이미지는 스케줄 함수가 생성. 회원 미디어 재사용 없음.';

DROP FUNCTION IF EXISTS public.bot_pick_random_media(text, text, text);
DROP FUNCTION IF EXISTS public.bot_resolve_content_side(text, text, text, text);

REVOKE ALL ON FUNCTION public.run_virtual_bot_matchups() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bot_random_category_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bot_admin_category_prompt_key(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bot_pick_prompt(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bot_pick_challenge_copy(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bot_admin_category_prompt_key(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bot_pick_prompt(text) TO service_role;

GRANT EXECUTE ON FUNCTION public.run_virtual_bot_matchups() TO service_role;
GRANT EXECUTE ON FUNCTION public.bot_random_category_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.bot_pick_prompt(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bot_pick_challenge_copy(text, text) TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.virtual_bot_challenge_prompts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.virtual_bot_matchup_prompts TO service_role;

-- ─────────────────────────────────────────────
-- 도전 완료(is_complete=true) 매치업도 조회수 인플레 대상
-- (사람·봇 ChallengeDrawer 모두 is_complete 를 true 로 남김)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.run_virtual_vote_bots()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled text;
  v_matchup record;
  v_bot record;
  v_side text;
  v_votes_added integer := 0;
  v_views_added integer := 0;
  v_matchups_touched integer := 0;
  v_n integer;
  v_view_delta integer;
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

  SELECT value->>'enabled' INTO v_enabled
  FROM public.admin_settings
  WHERE key = 'virtual_vote_bots';

  IF lower(COALESCE(v_enabled, 'true')) IN ('false', '0', 'off', 'no') THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'disabled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE COALESCE(is_bot, false) LIMIT 1) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_bot_profiles');
  END IF;

  FOR v_matchup IN
    SELECT m.id, m.right_type, m.expires_at
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
  LOOP
    v_matchups_touched := v_matchups_touched + 1;
    v_view_delta := 2 + floor(random() * 11)::integer;

    UPDATE public.matchups
    SET view_count = COALESCE(view_count, 0) + v_view_delta,
        updated_at = now()
    WHERE id = v_matchup.id;

    v_views_added := v_views_added + v_view_delta;

    IF v_matchup.right_type IS NULL THEN
      CONTINUE;
    END IF;
    IF v_matchup.expires_at IS NOT NULL AND v_matchup.expires_at <= now() THEN
      CONTINUE;
    END IF;

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

  RETURN jsonb_build_object(
    'ok', true,
    'matchups_touched', v_matchups_touched,
    'votes_added', v_votes_added,
    'views_added', v_views_added
  );
END;
$$;
