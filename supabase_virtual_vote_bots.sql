-- =============================================================================
-- VICS — 가상 투표 봇 (시드 프로필 + 조회/투표 인플레)
-- Supabase SQL Editor에서 이 파일 전체를 1회 실행하세요.
-- 이미 적용된 DB에는 supabase_virtual_vote_bots_io_cap.sql 만 실행하세요 (시드 재실행 금지).
--
-- 동작
--   1) profiles.is_bot = true 인 더미 계정 100명 시드
--      (auth.users 필요 — profiles.id FK)
--      이메일: vote-bot-001@bots.victoryspace.internal … 로그인 불가에 가깝게 랜덤 암호
--   2) 매치업 등록 후 10분이 지난 건에 대해 run_virtual_vote_bots() 가
--      interval_minutes(기본 30분)마다, 한 틱에 max_view_matchups_per_run(기본 15)건만:
--      - 조회수(view_count) +2~12 (일괄 UPDATE)
--      - 그중 라이브 대결 max_vote_matchups_per_run(기본 8)건에만 사람 표가 1건 이상일 때
--        봇 1~4명이 실제 좌/우 비율대로 투표.
--        사람 표가 100:0 / 0:100이면 화면과 같이 90:10 / 10:90으로 나눔.
--        사람 표 없으면 조회수만.
--   3) Netlify scheduled function `virtual-vote-bots` 가 10분마다 RPC 호출
--      (조회/표는 RPC가 interval로 스킵, 텍스트 생성·도전은 매 틱의 10%)
--   4) 관전봇 텍스트 생성·도전은 run_virtual_bot_matchups(p_max_create, p_max_challenge)
--      이미지 생성·도전은 `virtual-bot-images` (10분, 5분 오프셋)가 사진 성공 후에만.
--
-- 경쟁 무결성
--   - 봇 투표는 화면 표 수(left/right/total_votes)와 승패 포인트 정산에 포함됩니다
--   - 작성자 알림·작성자 받은 표는 봇 투표에서 제외합니다
--   - 봇 매치업 생성·도전은 랭킹·Champion 포인트에 포함합니다 (자동 투표 Oracle 포인트는 제외)
--
-- 끄기: admin_settings key = virtual_vote_bots 의 {"enabled": false}
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────
-- 1. 컬럼
-- ─────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_bot IS
  'true: 가상 투표/조회·매치업 봇. 자동 투표 알림·받은 표·Oracle 포인트는 제외. 생성/도전 Champion·공개 랭킹에는 포함';

CREATE INDEX IF NOT EXISTS profiles_is_bot_idx
  ON public.profiles (id)
  WHERE is_bot = true;

ALTER TABLE public.matchups
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.matchups.view_count IS
  '조회수(봇 인플레 포함). 실제 유저 조회 집계와 별도로 운영될 수 있음';

INSERT INTO public.admin_settings (key, value)
VALUES ('virtual_vote_bots', '{"enabled": true, "interval_minutes": 30, "max_view_matchups_per_run": 15, "max_vote_matchups_per_run": 8}')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS matchups_virtual_vote_bots_idx
  ON public.matchups (created_at DESC)
  WHERE COALESCE(status, 'active') = 'active'
    AND COALESCE(is_demo, false) = false
    AND challenger_forfeit_at IS NULL;

-- ─────────────────────────────────────────────
-- 2. 사람 표만 세는 헬퍼 (봇 투표 비율 산정용)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.matchup_human_vote_counts(p_matchup_id uuid)
RETURNS TABLE(left_c integer, right_c integer, total_c integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (
      WHERE v.side = 'left' AND NOT COALESCE(p.is_bot, false)
    )::integer,
    COUNT(*) FILTER (
      WHERE v.side = 'right' AND NOT COALESCE(p.is_bot, false)
    )::integer,
    COUNT(*) FILTER (
      WHERE NOT COALESCE(p.is_bot, false)
    )::integer
  FROM public.votes v
  LEFT JOIN public.profiles p ON p.id = v.user_id
  WHERE v.matchup_id = p_matchup_id;
$$;

COMMENT ON FUNCTION public.matchup_human_vote_counts(uuid) IS
  '봇을 제외한 좌/우/총 투표 수 — 봇 투표 비율 산정용. 승패 정산은 matchups.left/right_votes';

CREATE OR REPLACE FUNCTION public.matchup_human_vote_count(p_matchup_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT total_c FROM public.matchup_human_vote_counts(p_matchup_id)), 0);
$$;

-- ─────────────────────────────────────────────
-- 3. 랭킹 노출 — 관전봇 포함, 로컬 테스트 메일만 제외
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

-- ─────────────────────────────────────────────
-- 4. 투표 알림·작성자 받은 표 — 봇 스킵
--    (데모 매치업 스킵은 기존 spotlight 정의와 동일)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_vote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id  uuid;
  v_matchup_title text;
  v_voter_nick  text;
  v_is_demo boolean;
  v_voter_bot boolean;
BEGIN
  SELECT m.user_id, m.title, COALESCE(m.is_demo, false)
  INTO v_creator_id, v_matchup_title, v_is_demo
  FROM public.matchups m
  WHERE m.id = NEW.matchup_id;

  IF v_is_demo THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(is_bot, false) INTO v_voter_bot
  FROM public.profiles WHERE id = NEW.user_id;

  IF COALESCE(v_voter_bot, false) THEN
    RETURN NEW;
  END IF;

  IF v_creator_id IS NULL OR v_creator_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT nickname INTO v_voter_nick
  FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.notifications
    (user_id, type, title, body, related_matchup_id)
  VALUES
    (
      v_creator_id,
      'vote',
      v_voter_nick || '님이 투표했어요',
      '"' || left(v_matchup_title, 30) || '"',
      NEW.matchup_id
    );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_creator_total_votes_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id uuid;
  v_is_demo boolean;
  v_voter_id uuid;
  v_voter_bot boolean;
BEGIN
  SELECT m.user_id, COALESCE(m.is_demo, false)
  INTO v_creator_id, v_is_demo
  FROM public.matchups m
  WHERE m.id = COALESCE(NEW.matchup_id, OLD.matchup_id);

  IF v_creator_id IS NULL OR v_is_demo THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_voter_id := COALESCE(NEW.user_id, OLD.user_id);
  SELECT COALESCE(is_bot, false) INTO v_voter_bot
  FROM public.profiles WHERE id = v_voter_id;

  IF COALESCE(v_voter_bot, false) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET total_votes_received = total_votes_received + 1, updated_at = now() WHERE id = v_creator_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET total_votes_received = GREATEST(0, total_votes_received - 1), updated_at = now() WHERE id = v_creator_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ─────────────────────────────────────────────
-- 5. 정산: 화면과 동일하게 봇 포함 표로 승패, 봇에게는 포인트 없음
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.matchup_is_ready_for_result_settlement(m public.matchups)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    m.right_type IS NOT NULL
    AND m.result_points_settled_at IS NULL
    AND NOT COALESCE(m.is_demo, false)
    AND (
      m.challenger_forfeit_at IS NOT NULL
      OR (
        GREATEST(
          COALESCE(m.total_votes, 0),
          COALESCE(m.left_votes, 0) + COALESCE(m.right_votes, 0)
        ) > 0
        AND m.expires_at IS NOT NULL
        AND m.expires_at <= now()
      )
    );
$$;

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

CREATE OR REPLACE FUNCTION public.backfill_missing_oracle_vote_settlements()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_winner text;
  v_pts integer;
  v_src text;
  v_has_season boolean;
  v_count integer := 0;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
  ) INTO v_has_season;

  FOR v_row IN
    SELECT
      m.id AS matchup_id,
      m.challenger_forfeit_at,
      m.left_votes,
      m.right_votes,
      v.user_id AS voter_id,
      v.side
    FROM public.votes v
    INNER JOIN public.matchups m ON m.id = v.matchup_id
    LEFT JOIN public.profiles bp ON bp.id = v.user_id
    WHERE m.right_type IS NOT NULL
      AND NOT COALESCE(m.is_demo, false)
      AND NOT COALESCE(bp.is_bot, false)
      AND GREATEST(
        COALESCE(m.total_votes, 0),
        COALESCE(m.left_votes, 0) + COALESCE(m.right_votes, 0)
      ) > 0
      AND (
        m.result_points_settled_at IS NOT NULL
        OR EXISTS (
          SELECT 1 FROM public.point_transactions pt
          WHERE pt.related_id = m.id
            AND pt.source IN ('creator_win', 'creator_lose', 'creator_draw')
            AND pt.reversed_at IS NULL
        )
        OR (m.expires_at IS NOT NULL AND m.expires_at <= now())
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.point_transactions pt
        WHERE pt.user_id = v.user_id
          AND pt.related_id = m.id
          AND pt.source IN ('voter_win', 'voter_lose', 'voter_draw')
          AND pt.reversed_at IS NULL
      )
  LOOP
    IF v_row.challenger_forfeit_at IS NOT NULL THEN
      v_winner := 'left';
    ELSIF COALESCE(v_row.left_votes, 0) = COALESCE(v_row.right_votes, 0) THEN
      v_winner := 'draw';
    ELSIF v_row.left_votes > v_row.right_votes THEN
      v_winner := 'left';
    ELSE
      v_winner := 'right';
    END IF;

    v_pts := CASE
      WHEN v_winner = 'draw' THEN 15
      WHEN v_row.side = v_winner THEN 25
      ELSE 5
    END;
    v_src := CASE
      WHEN v_winner = 'draw' THEN 'voter_draw'
      WHEN v_row.side = v_winner THEN 'voter_win'
      ELSE 'voter_lose'
    END;

    IF v_has_season THEN
      UPDATE public.profiles
      SET vote_total = vote_total + 1,
          vote_hits = vote_hits + CASE WHEN v_winner != 'draw' AND v_row.side = v_winner THEN 1 ELSE 0 END,
          oracle_points = oracle_points + v_pts,
          points = points + v_pts,
          season_vote_total = season_vote_total + 1,
          season_vote_hits = season_vote_hits + CASE WHEN v_winner != 'draw' AND v_row.side = v_winner THEN 1 ELSE 0 END,
          season_oracle_points = season_oracle_points + v_pts,
          season_points = season_points + v_pts,
          updated_at = now()
      WHERE id = v_row.voter_id;
    ELSE
      UPDATE public.profiles
      SET vote_total = vote_total + 1,
          vote_hits = vote_hits + CASE WHEN v_winner != 'draw' AND v_row.side = v_winner THEN 1 ELSE 0 END,
          oracle_points = oracle_points + v_pts,
          points = points + v_pts,
          updated_at = now()
      WHERE id = v_row.voter_id;
    END IF;

    PERFORM public.insert_point_transaction(v_row.voter_id, v_pts, v_src, v_row.matchup_id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ─────────────────────────────────────────────
-- 6. 봇 계정 시드 (auth.users + profiles)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.virtual_bot_pick_seed_nickname(p_i integer)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool text[];
  v_nick text;
BEGIN
  BEGIN
    v_pool := public.virtual_bot_nickname_pool();
    IF p_i IS NOT NULL AND p_i >= 1 AND p_i <= COALESCE(array_length(v_pool, 1), 0) THEN
      v_nick := v_pool[p_i];
    END IF;
  EXCEPTION WHEN undefined_function THEN
    v_nick := NULL;
  END;
  IF v_nick IS NULL OR length(trim(v_nick)) = 0 THEN
    v_nick := format('관전봇%s', lpad(GREATEST(1, COALESCE(p_i, 1))::text, 2, '0'));
  END IF;
  RETURN v_nick;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_virtual_vote_bots(p_count integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  i integer;
  v_email text;
  v_nick text;
  v_id uuid;
  v_created integer := 0;
  v_skipped integer := 0;
  v_failed integer := 0;
  v_has_anon boolean;
  v_has_identities boolean;
  v_ident_has_provider_id boolean;
BEGIN
  IF p_count IS NULL OR p_count < 1 THEN
    p_count := 100;
  END IF;
  IF p_count > 200 THEN
    p_count := 200;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'is_anonymous'
  ) INTO v_has_anon;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'identities'
  ) INTO v_has_identities;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'identities' AND column_name = 'provider_id'
  ) INTO v_ident_has_provider_id;

  FOR i IN 1..p_count LOOP
    v_email := format('vote-bot-%s@bots.victoryspace.internal', lpad(i::text, 3, '0'));
    v_nick := public.virtual_bot_pick_seed_nickname(i);

    IF EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(v_email)) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_id := gen_random_uuid();

    BEGIN
      IF v_has_anon THEN
        INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
          created_at, updated_at,
          confirmation_token, recovery_token, email_change_token_new, email_change,
          is_anonymous
        ) VALUES (
          '00000000-0000-0000-0000-000000000000',
          v_id,
          'authenticated',
          'authenticated',
          v_email,
          crypt(gen_random_uuid()::text, gen_salt('bf')),
          now(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('nickname', v_nick, 'is_bot', true),
          now(), now(),
          '', '', '', '',
          false
        );
      ELSE
        INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
          created_at, updated_at,
          confirmation_token, recovery_token, email_change_token_new, email_change
        ) VALUES (
          '00000000-0000-0000-0000-000000000000',
          v_id,
          'authenticated',
          'authenticated',
          v_email,
          crypt(gen_random_uuid()::text, gen_salt('bf')),
          now(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('nickname', v_nick, 'is_bot', true),
          now(), now(),
          '', '', '', ''
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'virtual vote bot auth insert failed %: %', v_email, SQLERRM;
      v_failed := v_failed + 1;
      CONTINUE;
    END;

    IF v_has_identities THEN
      BEGIN
        IF v_ident_has_provider_id THEN
          INSERT INTO auth.identities (
            id, user_id, provider_id, identity_data, provider,
            last_sign_in_at, created_at, updated_at
          ) VALUES (
            gen_random_uuid(),
            v_id,
            v_id::text,
            jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
            'email',
            now(), now(), now()
          );
        ELSE
          INSERT INTO auth.identities (
            id, user_id, identity_data, provider,
            last_sign_in_at, created_at, updated_at
          ) VALUES (
            gen_random_uuid(),
            v_id,
            jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
            'email',
            now(), now(), now()
          );
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'virtual vote bot identity insert failed %: %', v_email, SQLERRM;
      END;
    END IF;

    v_created := v_created + 1;
  END LOOP;

  UPDATE public.profiles p
  SET
    is_bot = true,
    points = 0,
    updated_at = now()
  WHERE p.id IN (
    SELECT u.id FROM auth.users u
    WHERE lower(u.email) LIKE '%@bots.victoryspace.internal'
  )
  OR lower(COALESCE(p.email, '')) LIKE '%@bots.victoryspace.internal';

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
  ) THEN
    UPDATE public.profiles SET season_points = 0 WHERE COALESCE(is_bot, false);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'signup_bonus_granted_at'
  ) THEN
    UPDATE public.profiles
    SET signup_bonus_granted_at = COALESCE(signup_bonus_granted_at, now())
    WHERE COALESCE(is_bot, false);
  END IF;

  RETURN jsonb_build_object(
    'created', v_created,
    'skipped_existing', v_skipped,
    'failed', v_failed,
    'target', p_count
  );
END;
$$;

COMMENT ON FUNCTION public.seed_virtual_vote_bots(integer) IS
  '가상 투표 봇 auth+프로필 시드. 이미 있으면 건너뜀.';

REVOKE ALL ON FUNCTION public.seed_virtual_vote_bots(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_virtual_vote_bots(integer) TO service_role;

SELECT public.seed_virtual_vote_bots(100) AS virtual_vote_bots_seed;

-- ─────────────────────────────────────────────
-- 7. 10분 주기 본체
-- ─────────────────────────────────────────────
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

REVOKE ALL ON FUNCTION public.run_virtual_vote_bots() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.matchup_human_vote_counts(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.matchup_human_vote_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_virtual_vote_bots() TO service_role;

-- ─────────────────────────────────────────────
-- 8. pg_cron (Supabase에서 확장 활성화한 경우 — 택일)
--    Netlify `virtual-vote-bots` 스케줄과 중복 실행되지 않게 하나만 쓰세요.
--    조회/표는 함수가 interval_minutes(기본 30분)로 스킵하므로 호출은 10분이어도 됩니다.
-- ─────────────────────────────────────────────
-- SELECT cron.unschedule('vics_virtual_vote_bots_10m');
-- SELECT cron.schedule(
--   'vics_virtual_vote_bots_10m',
--   '*/10 * * * *',
--   $$ SELECT public.run_virtual_vote_bots(); $$
-- );
