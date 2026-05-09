-- 매치업 피드 "배너 강조" — 포인트 차감 + feed_banner_highlight_until 설정 (SECURITY DEFINER)
-- Point Reward Center · Boost · 배너 강조 효과 (1,000 P)
-- 종료 시각: least(구매 시각 + 48시간, expires_at) — expires_at NULL이면 구매+48h만
-- Supabase SQL Editor에서 실행하세요.

ALTER TABLE public.matchups
  ADD COLUMN IF NOT EXISTS feed_banner_highlight_until timestamptz;

COMMENT ON COLUMN public.matchups.feed_banner_highlight_until IS
  '피드 카드 네온 강조 종료 시각(포인트 부스트). NULL이면 미적용.';

CREATE OR REPLACE FUNCTION public.purchase_matchup_banner_highlight(p_matchup_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cost integer := 1000;
  v_add interval := interval '48 hours';
  v_points integer;
  v_has_season boolean;
  v_matchup record;
  v_new_until timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '로그인이 필요해요');
  END IF;

  SELECT m.* INTO v_matchup
  FROM public.matchups m
  WHERE m.id = p_matchup_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '매치업을 찾을 수 없어요');
  END IF;

  IF v_matchup.user_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', '내가 만든 매치업만 선택할 수 있어요');
  END IF;

  IF v_matchup.status IS DISTINCT FROM 'active' OR v_matchup.right_type IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '활성 상태이고 양쪽이 모두 채워진 매치업만 적용할 수 있어요');
  END IF;

  IF v_matchup.feed_banner_highlight_until IS NOT NULL AND v_matchup.feed_banner_highlight_until > now() THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error',
      '이미 네온 부스트가 적용 중인 매치업이에요. 종료 후 다시 구매할 수 있어요.'
    );
  END IF;

  IF v_matchup.expires_at IS NOT NULL AND v_matchup.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', '투표가 종료된 매치업에는 적용할 수 없어요');
  END IF;

  v_new_until := least(
    now() + v_add,
    coalesce(v_matchup.expires_at, now() + v_add)
  );

  IF v_new_until <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', '남은 투표 시간이 없어 강조를 적용할 수 없어요');
  END IF;

  SELECT p.points INTO v_points
  FROM public.profiles p
  WHERE p.id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '프로필을 찾을 수 없어요');
  END IF;

  IF v_points < v_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', '포인트가 부족해요 (1,000 P 필요)');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'season_points'
  ) INTO v_has_season;

  IF v_has_season THEN
    UPDATE public.profiles
    SET
      points = points - v_cost,
      season_points = season_points - v_cost,
      updated_at = now()
    WHERE id = v_uid;
  ELSE
    UPDATE public.profiles
    SET points = points - v_cost, updated_at = now()
    WHERE id = v_uid;
  END IF;

  UPDATE public.matchups
  SET feed_banner_highlight_until = v_new_until, updated_at = now()
  WHERE id = p_matchup_id;

  RETURN jsonb_build_object(
    'ok', true,
    'ends_at', v_new_until,
    'points_spent', v_cost
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_matchup_banner_highlight(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_matchup_banner_highlight(uuid) TO authenticated;

COMMENT ON FUNCTION public.purchase_matchup_banner_highlight IS
  '배너 강조 부스트 — 1000P 차감, feed_banner_highlight_until = least(구매+48h, expires_at), 적용 중·투표 종료 후 구매 불가';
