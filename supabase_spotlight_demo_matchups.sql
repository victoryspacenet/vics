-- 메인 스포트라이트 폴백: 고정 UUID 데모 매치업 + is_demo 플래그
-- Supabase SQL Editor에서 실행하세요.
--
-- 전제
--   - `public.profiles`에 최소 1명(첫 가입자) — 시드의 `user_id`로 사용
--   - `insert_point_transaction` 함수 존재 (포인트 마이그레이션 적용 DB)
-- 권장: `supabase_points_no_immediate_vote_or_create.sql` 적용 후 실행 (본 파일의
--       `award_points_on_matchup_create`가 그 정의와 맞춤)

-- ── 1. 컬럼 ─────────────────────────────────────────────────────────
ALTER TABLE public.matchups
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.matchups.is_demo IS 'true: 스포트라이트 데모 등 — 투표는 저장하되 포인트·랭킹·작성자 투표수 알림에서 제외';

-- ── 2. 트리거 함수 — 데모일 때 부가 효과 스킵 ───────────────────────

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
BEGIN
  SELECT m.user_id, m.title, COALESCE(m.is_demo, false)
  INTO v_creator_id, v_matchup_title, v_is_demo
  FROM public.matchups m
  WHERE m.id = NEW.matchup_id;

  IF v_is_demo THEN
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
BEGIN
  SELECT m.user_id, COALESCE(m.is_demo, false)
  INTO v_creator_id, v_is_demo
  FROM public.matchups m
  WHERE m.id = COALESCE(NEW.matchup_id, OLD.matchup_id);

  IF v_creator_id IS NULL OR v_is_demo THEN
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

-- 즉시 생성 포인트 없음 버전과 동일 + 데모 매치업은 total_matchups 증가도 생략
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

CREATE OR REPLACE FUNCTION public.update_dual_ranking_on_matchup_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_winner text;
  v_creator_id uuid;
  v_has_votes boolean;
  v_creator_pts integer;
  v_creator_source text;
  v_has_season boolean;
  v_rec record;
BEGIN
  IF COALESCE(NEW.is_demo, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.right_type IS NOT NULL AND (OLD.right_type IS NULL OR OLD.right_type IS DISTINCT FROM NEW.right_type) THEN
    v_creator_id := NEW.user_id;
    v_has_votes := (COALESCE(NEW.total_votes, 0) > 0);

    IF NEW.left_votes = NEW.right_votes THEN v_winner := 'draw';
    ELSIF NEW.left_votes > NEW.right_votes THEN v_winner := 'left';
    ELSE v_winner := 'right'; END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
    ) INTO v_has_season;

    IF v_has_votes AND v_creator_id IS NOT NULL THEN
      v_creator_pts := CASE
        WHEN v_winner = 'draw' THEN 30
        WHEN v_winner = 'left' THEN 50
        ELSE 10
      END;
      v_creator_source := CASE
        WHEN v_winner = 'draw' THEN 'creator_draw'
        WHEN v_winner = 'left' THEN 'creator_win'
        ELSE 'creator_lose'
      END;

      IF v_winner != 'draw' THEN
        IF v_has_season THEN
          UPDATE public.profiles
          SET creator_wins = creator_wins + 1,
              creator_win_streak = creator_win_streak + 1,
              creator_best_streak = GREATEST(creator_best_streak, creator_win_streak + 1),
              season_creator_wins = season_creator_wins + 1,
              points = points + v_creator_pts,
              season_points = season_points + v_creator_pts,
              updated_at = now()
          WHERE id = v_creator_id;
        ELSE
          UPDATE public.profiles
          SET creator_wins = creator_wins + 1,
              creator_win_streak = creator_win_streak + 1,
              creator_best_streak = GREATEST(creator_best_streak, creator_win_streak + 1),
              points = points + v_creator_pts,
              updated_at = now()
          WHERE id = v_creator_id;
        END IF;
      ELSE
        IF v_has_season THEN
          UPDATE public.profiles
          SET points = points + v_creator_pts, season_points = season_points + v_creator_pts, updated_at = now()
          WHERE id = v_creator_id;
        ELSE
          UPDATE public.profiles
          SET points = points + v_creator_pts, updated_at = now()
          WHERE id = v_creator_id;
        END IF;
      END IF;
      PERFORM insert_point_transaction(v_creator_id, v_creator_pts, v_creator_source, NEW.id);
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
        WHERE v.matchup_id = NEW.id
      LOOP
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
        PERFORM insert_point_transaction(v_rec.user_id, v_rec.pts, v_rec.src, NEW.id);
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ── 3. 고정 데모 매치업 2건 (id는 src/lib/spotlightDemo.js 와 동일) ───

DO $$
DECLARE
  seed_user_id uuid;
BEGIN
  SELECT id INTO seed_user_id FROM public.profiles ORDER BY created_at ASC LIMIT 1;
  IF seed_user_id IS NULL THEN
    RAISE EXCEPTION 'spotlight_demo: profiles에 사용자가 없습니다. 가입 후 다시 실행하세요.';
  END IF;

  INSERT INTO public.matchups (
    id, user_id, title, description,
    left_type, left_url, left_text, left_thumbnail_url, left_label,
    right_type, right_url, right_text, right_thumbnail_url, right_label, right_user_id,
    left_votes, right_votes, total_votes,
    status, category, tags, expires_at, is_demo, created_at
  ) VALUES (
    '00000001-0001-4000-8000-000000000101',
    seed_user_id,
    '지드래그니 vs 뷔톤, 진정한 패션 아이콘은?',
    '메인 스포트라이트 폴백 데모(포인트·랭킹 제외)',
    'video', null, null, null, '지드래그니',
    'video', null, null, null, '뷔톤', null,
    0, 0, 0,
    'active', 'spotlight_demo', ARRAY['spotlight_demo']::text[], now() + interval '10 years', true, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    left_type = EXCLUDED.left_type,
    left_url = EXCLUDED.left_url,
    left_text = EXCLUDED.left_text,
    left_thumbnail_url = EXCLUDED.left_thumbnail_url,
    left_label = EXCLUDED.left_label,
    right_type = EXCLUDED.right_type,
    right_url = EXCLUDED.right_url,
    right_text = EXCLUDED.right_text,
    right_thumbnail_url = EXCLUDED.right_thumbnail_url,
    right_label = EXCLUDED.right_label,
    is_demo = true,
    tags = EXCLUDED.tags,
    category = EXCLUDED.category,
    expires_at = EXCLUDED.expires_at,
    updated_at = now();

  INSERT INTO public.matchups (
    id, user_id, title, description,
    left_type, left_url, left_text, left_thumbnail_url, left_label,
    right_type, right_url, right_text, right_thumbnail_url, right_label, right_user_id,
    left_votes, right_votes, total_votes,
    status, category, tags, expires_at, is_demo, created_at
  ) VALUES (
    '00000002-0002-4000-8000-000000000102',
    seed_user_id,
    'LP vs 스트리밍, 감성 음악 감상은?',
    '메인 스포트라이트 폴백 데모(포인트·랭킹 제외)',
    'image', '/images/demo/wide.svg', null, '/images/demo/wide.svg', 'LP',
    'image', '/images/demo/skinny.svg', null, '/images/demo/skinny.svg', '스트리밍', null,
    0, 0, 0,
    'active', 'spotlight_demo', ARRAY['spotlight_demo']::text[], now() + interval '10 years', true, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    left_type = EXCLUDED.left_type,
    left_url = EXCLUDED.left_url,
    left_text = EXCLUDED.left_text,
    left_thumbnail_url = EXCLUDED.left_thumbnail_url,
    left_label = EXCLUDED.left_label,
    right_type = EXCLUDED.right_type,
    right_url = EXCLUDED.right_url,
    right_text = EXCLUDED.right_text,
    right_thumbnail_url = EXCLUDED.right_thumbnail_url,
    right_label = EXCLUDED.right_label,
    is_demo = true,
    tags = EXCLUDED.tags,
    category = EXCLUDED.category,
    expires_at = EXCLUDED.expires_at,
    updated_at = now();
END $$;
