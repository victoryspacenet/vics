-- =============================================
-- VICS - 포인트 소멸 정책
-- Supabase SQL Editor에서 실행하세요
--
-- 적용 순서: supabase_points_system_v2.sql 이후
-- 포인트 소멸: 활성 유저 4개월, 비활성 유저 3개월 (마지막 로그인 기준)
-- =============================================

-- ─────────────────────────────────────────────
-- 1. 포인트 거래 내역 테이블 (획득일 추적용)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.point_transactions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  source text NOT NULL CHECK (source IN (
    'attendance', 'vote', 'matchup_create',
    'creator_win', 'creator_lose', 'creator_draw',
    'voter_win', 'voter_lose', 'voter_draw'
  )),
  related_id uuid,
  earned_at timestamptz NOT NULL DEFAULT now(),
  expired_at timestamptz,
  reversed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS point_transactions_user_earned_idx
  ON public.point_transactions(user_id, earned_at DESC)
  WHERE expired_at IS NULL AND reversed_at IS NULL;

CREATE INDEX IF NOT EXISTS point_transactions_vote_idx
  ON public.point_transactions(user_id, source, related_id)
  WHERE source = 'vote';

CREATE INDEX IF NOT EXISTS point_transactions_related_idx
  ON public.point_transactions(related_id, source)
  WHERE reversed_at IS NULL;

ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own point_transactions"
  ON public.point_transactions FOR SELECT USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 2. 포인트 거래 삽입 헬퍼
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.insert_point_transaction(
  p_user_id uuid,
  p_amount integer,
  p_source text,
  p_related_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO point_transactions (user_id, amount, source, related_id)
  VALUES (p_user_id, p_amount, p_source, p_related_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ─────────────────────────────────────────────
-- 3. 출석 체크 - 거래 내역 추가
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_attendance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_exists boolean;
  v_consecutive integer := 1;
  v_base integer := 10;
  v_bonus integer := 0;
  v_total integer;
  v_has_season boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '로그인이 필요해요');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM attendances WHERE user_id = v_user_id AND checked_at = v_today
  ) INTO v_exists;

  IF v_exists THEN
    RETURN jsonb_build_object('ok', false, 'error', '오늘 이미 출석했어요', 'points', 0);
  END IF;

  INSERT INTO attendances (user_id, checked_at)
  VALUES (v_user_id, v_today);

  FOR i IN 1..365 LOOP
    IF NOT EXISTS (SELECT 1 FROM attendances WHERE user_id = v_user_id AND checked_at = v_today - i) THEN
      EXIT;
    END IF;
    v_consecutive := v_consecutive + 1;
  END LOOP;

  IF v_consecutive >= 7 AND (v_consecutive % 7) = 0 THEN
    v_bonus := 70;
  END IF;
  v_total := v_base + v_bonus;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
  ) INTO v_has_season;

  IF v_has_season THEN
    UPDATE profiles
    SET points = points + v_total, season_points = season_points + v_total, updated_at = now()
    WHERE id = v_user_id;
  ELSE
    UPDATE profiles
    SET points = points + v_total, updated_at = now()
    WHERE id = v_user_id;
  END IF;

  PERFORM insert_point_transaction(v_user_id, v_total, 'attendance', NULL);

  RETURN jsonb_build_object(
    'ok', true,
    'points', v_total,
    'base', v_base,
    'bonus', v_bonus,
    'consecutive', v_consecutive
  );
END;
$$;

-- ─────────────────────────────────────────────
-- 4. 매치업 생성 - 거래 내역 추가
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION award_points_on_matchup_create()
RETURNS TRIGGER AS $$
DECLARE
  v_has_season boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
  ) INTO v_has_season;

  IF v_has_season THEN
    UPDATE public.profiles
    SET points = points + 30, total_matchups = total_matchups + 1,
        season_points = season_points + 30, updated_at = now()
    WHERE id = NEW.user_id;
  ELSE
    UPDATE public.profiles
    SET points = points + 30, total_matchups = total_matchups + 1, updated_at = now()
    WHERE id = NEW.user_id;
  END IF;

  PERFORM insert_point_transaction(NEW.user_id, 30, 'matchup_create', NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────
-- 5. 투표 - 거래 내역 추가, DELETE 시 reversed_at 설정
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION award_points_on_vote()
RETURNS TRIGGER AS $$
DECLARE
  v_has_season boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
  ) INTO v_has_season;

  IF TG_OP = 'INSERT' THEN
    IF v_has_season THEN
      UPDATE public.profiles
      SET points = points + 20, season_points = season_points + 20, updated_at = now()
      WHERE id = NEW.user_id;
    ELSE
      UPDATE public.profiles
      SET points = points + 20, updated_at = now()
      WHERE id = NEW.user_id;
    END IF;
    PERFORM insert_point_transaction(NEW.user_id, 20, 'vote', NEW.id);

  ELSIF TG_OP = 'DELETE' THEN
    -- reversed_at이 이미 설정된 경우(매치업 삭제로 선반영) 포인트 중복 차감 방지
    IF EXISTS (
      SELECT 1 FROM public.point_transactions
      WHERE user_id = OLD.user_id AND source = 'vote' AND related_id = OLD.id AND reversed_at IS NULL
    ) THEN
      UPDATE public.point_transactions
      SET reversed_at = now()
      WHERE user_id = OLD.user_id AND source = 'vote' AND related_id = OLD.id AND reversed_at IS NULL;

      IF v_has_season THEN
        UPDATE public.profiles
        SET points = GREATEST(0, points - 20), season_points = GREATEST(0, season_points - 20), updated_at = now()
        WHERE id = OLD.user_id;
      ELSE
        UPDATE public.profiles
        SET points = GREATEST(0, points - 20), updated_at = now()
        WHERE id = OLD.user_id;
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────
-- 6. 매치업 완료 - Creator/Voter 거래 내역 추가
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_dual_ranking_on_matchup_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_winner text;
  v_creator_id uuid;
  v_has_votes boolean;
  v_creator_pts integer;
  v_creator_source text;
  v_has_season boolean;
  v_rec record;
BEGIN
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

    -- A. Creator
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

    -- B. Voter
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────
-- 7. 포인트 소멸 함수 (cron에서 일 1회 호출)
--    활성 유저: 마지막 로그인 3개월 이내 → 4개월 후 소멸
--    비활성 유저: 마지막 로그인 3개월 초과 → 3개월 후 소멸
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.expire_points()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_count integer := 0;
  v_rec record;
  v_expire_months integer;
  v_cutoff timestamptz;
  v_has_season boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
  ) INTO v_has_season;

  FOR v_rec IN
    SELECT pt.id, pt.user_id, pt.amount, pt.earned_at,
      COALESCE(au.last_sign_in_at, p.created_at) AS last_active
    FROM point_transactions pt
    JOIN profiles p ON p.id = pt.user_id
    LEFT JOIN auth.users au ON au.id = pt.user_id
    WHERE pt.expired_at IS NULL AND pt.reversed_at IS NULL
  LOOP
    -- 비활성: 마지막 로그인 3개월 초과
    IF v_rec.last_active IS NULL OR v_rec.last_active < (now() - interval '3 months') THEN
      v_expire_months := 3;
    ELSE
      v_expire_months := 4;
    END IF;

    v_cutoff := v_rec.earned_at + (v_expire_months || ' months')::interval;

    IF v_cutoff < now() THEN
      UPDATE point_transactions SET expired_at = now() WHERE id = v_rec.id;

      IF v_has_season THEN
        UPDATE profiles
        SET points = GREATEST(0, points - v_rec.amount),
            season_points = GREATEST(0, season_points - v_rec.amount),
            updated_at = now()
        WHERE id = v_rec.user_id;
      ELSE
        UPDATE profiles
        SET points = GREATEST(0, points - v_rec.amount),
            updated_at = now()
        WHERE id = v_rec.user_id;
      END IF;

      v_expired_count := v_expired_count + 1;
    END IF;
  END LOOP;

  RETURN v_expired_count;
END;
$$;

-- ─────────────────────────────────────────────
-- 8. 매치업 삭제 시 포인트 무효화 (부적절한 게시물 삭제 등)
--    Creator: matchup_create(30P) + creator_win/lose/draw
--    Voter:   vote(20P)는 투표 CASCADE 삭제 시 자동 반영, voter_win/lose/draw
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION invalidate_points_on_matchup_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_rec record;
  v_has_season boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
  ) INTO v_has_season;

  -- 1) Creator: matchup_create (30P)
  FOR v_rec IN
    SELECT id, user_id, amount FROM point_transactions
    WHERE source = 'matchup_create' AND related_id = OLD.id AND reversed_at IS NULL
  LOOP
    UPDATE point_transactions SET reversed_at = now() WHERE id = v_rec.id;
    IF v_has_season THEN
      UPDATE profiles
      SET points = GREATEST(0, points - v_rec.amount),
          season_points = GREATEST(0, season_points - v_rec.amount),
          total_matchups = GREATEST(0, total_matchups - 1),
          updated_at = now()
      WHERE id = v_rec.user_id;
    ELSE
      UPDATE profiles
      SET points = GREATEST(0, points - v_rec.amount),
          total_matchups = GREATEST(0, total_matchups - 1),
          updated_at = now()
      WHERE id = v_rec.user_id;
    END IF;
  END LOOP;

  -- 2) Creator: creator_win/lose/draw 결과 포인트 (creator_win일 때만 creator_wins 차감)
  FOR v_rec IN
    SELECT id, user_id, amount, source FROM point_transactions
    WHERE source IN ('creator_win', 'creator_lose', 'creator_draw')
      AND related_id = OLD.id AND reversed_at IS NULL
  LOOP
    UPDATE point_transactions SET reversed_at = now() WHERE id = v_rec.id;
    IF v_has_season THEN
      UPDATE profiles
      SET points = GREATEST(0, points - v_rec.amount),
          season_points = GREATEST(0, season_points - v_rec.amount),
          creator_wins = GREATEST(0, creator_wins - CASE WHEN v_rec.source = 'creator_win' THEN 1 ELSE 0 END),
          season_creator_wins = GREATEST(0, season_creator_wins - CASE WHEN v_rec.source = 'creator_win' THEN 1 ELSE 0 END),
          updated_at = now()
      WHERE id = v_rec.user_id;
    ELSE
      UPDATE profiles
      SET points = GREATEST(0, points - v_rec.amount),
          creator_wins = GREATEST(0, creator_wins - CASE WHEN v_rec.source = 'creator_win' THEN 1 ELSE 0 END),
          updated_at = now()
      WHERE id = v_rec.user_id;
    END IF;
  END LOOP;

  -- 3) Voter: voter_win/lose/draw 결과 포인트 (vote 20P는 CASCADE 시 vote 트리거가 처리)
  FOR v_rec IN
    SELECT id, user_id, amount FROM point_transactions
    WHERE source IN ('voter_win', 'voter_lose', 'voter_draw')
      AND related_id = OLD.id AND reversed_at IS NULL
  LOOP
    UPDATE point_transactions SET reversed_at = now() WHERE id = v_rec.id;
    IF v_has_season THEN
      UPDATE profiles
      SET points = GREATEST(0, points - v_rec.amount),
          season_points = GREATEST(0, season_points - v_rec.amount),
          vote_total = GREATEST(0, vote_total - 1),
          season_vote_total = GREATEST(0, season_vote_total - 1),
          vote_hits = GREATEST(0, vote_hits - CASE WHEN v_rec.source = 'voter_win' THEN 1 ELSE 0 END),
          season_vote_hits = GREATEST(0, season_vote_hits - CASE WHEN v_rec.source = 'voter_win' THEN 1 ELSE 0 END),
          oracle_points = GREATEST(0, oracle_points - v_rec.amount),
          season_oracle_points = GREATEST(0, season_oracle_points - v_rec.amount),
          updated_at = now()
      WHERE id = v_rec.user_id;
    ELSE
      UPDATE profiles
      SET points = GREATEST(0, points - v_rec.amount),
          vote_total = GREATEST(0, vote_total - 1),
          vote_hits = GREATEST(0, vote_hits - CASE WHEN v_rec.source = 'voter_win' THEN 1 ELSE 0 END),
          oracle_points = GREATEST(0, oracle_points - v_rec.amount),
          updated_at = now()
      WHERE id = v_rec.user_id;
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_matchup_delete_invalidate_points ON public.matchups;
CREATE TRIGGER on_matchup_delete_invalidate_points
  BEFORE DELETE ON public.matchups
  FOR EACH ROW EXECUTE FUNCTION invalidate_points_on_matchup_delete();

-- ─────────────────────────────────────────────
-- 9. 기존 포인트 백필 (선택)
--    적용 시점 이전 포인트는 거래 내역 없음 → 소멸 대상 아님
--    신규 적립분부터 소멸 적용
-- ─────────────────────────────────────────────
-- 기존 데이터는 point_transactions에 없으므로 expire_points()가 건드리지 않음.
-- (백필 생략 - 기존 포인트는 영구 유지, 신규 포인트만 소멸 적용)

-- ─────────────────────────────────────────────
-- 10. Supabase Cron 설정 (Dashboard > Database > Extensions > pg_cron)
--    또는 Supabase Edge Function / 외부 cron에서 호출
-- ─────────────────────────────────────────────
-- SELECT cron.schedule('expire-points-daily', '0 2 * * *', 'SELECT expire_points()');
-- (매일 새벽 2시 KST = UTC 17:00)
