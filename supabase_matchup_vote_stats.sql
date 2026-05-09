-- 투표 통계 열람권 — 매치업 작성자 전용, 800P 1회(매치업당) / 집계는 RPC로만
-- Supabase SQL Editor에서 실행하세요.

CREATE TABLE IF NOT EXISTS public.matchup_vote_stats_unlocks (
  matchup_id uuid NOT NULL REFERENCES public.matchups (id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (matchup_id)
);

COMMENT ON TABLE public.matchup_vote_stats_unlocks IS
  '포인트로 구매한 투표 통계(성별·연령대) 열람 — 매치업당 1회';

ALTER TABLE public.matchup_vote_stats_unlocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Matchup creator can read vote stats unlock" ON public.matchup_vote_stats_unlocks;

CREATE POLICY "Matchup creator can read vote stats unlock"
  ON public.matchup_vote_stats_unlocks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matchups m
      WHERE m.id = matchup_id AND m.user_id = auth.uid()
    )
  );

-- ── 구매 RPC ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.purchase_matchup_vote_stats_unlock(p_matchup_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cost integer := 800;
  v_points integer;
  v_has_season boolean;
  v_matchup record;
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
    RETURN jsonb_build_object('ok', false, 'error', '내가 만든 매치업만 열람권을 구매할 수 있어요');
  END IF;

  IF v_matchup.status IS DISTINCT FROM 'active' OR v_matchup.right_type IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '활성 상태이고 양쪽이 모두 채워진 매치업만 구매할 수 있어요');
  END IF;

  IF v_matchup.expires_at IS NULL OR v_matchup.expires_at > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', '투표가 종료된 매치업만 열람권을 구매할 수 있어요');
  END IF;

  IF EXISTS (SELECT 1 FROM public.matchup_vote_stats_unlocks u WHERE u.matchup_id = p_matchup_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', '이미 투표 통계 열람권을 구매한 매치업이에요');
  END IF;

  SELECT p.points INTO v_points
  FROM public.profiles p
  WHERE p.id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '프로필을 찾을 수 없어요');
  END IF;

  IF v_points < v_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', '포인트가 부족해요 (800 P 필요)');
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

  INSERT INTO public.matchup_vote_stats_unlocks (matchup_id)
  VALUES (p_matchup_id);

  RETURN jsonb_build_object('ok', true, 'points_spent', v_cost);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', '이미 투표 통계 열람권을 구매한 매치업이에요');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_matchup_vote_stats_unlock(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_matchup_vote_stats_unlock(uuid) TO authenticated;

COMMENT ON FUNCTION public.purchase_matchup_vote_stats_unlock IS
  '투표 통계 열람권 — 800P, 매치업당 1회, 작성자만, 투표 마감(expires_at) 이후만';

-- ── 집계 조회 RPC (개인별 투표 행 미노출) ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_matchup_vote_stats(p_matchup_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_left_label text;
  v_right_label text;
  v_by_gender jsonb;
  v_by_age jsonb;
  v_total bigint;
  v_left bigint;
  v_right bigint;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '로그인이 필요해요');
  END IF;

  SELECT m.user_id, m.left_label, m.right_label
  INTO v_owner, v_left_label, v_right_label
  FROM public.matchups m
  WHERE m.id = p_matchup_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '매치업을 찾을 수 없어요');
  END IF;

  IF v_owner IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', '작성자만 투표 통계를 볼 수 있어요');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.matchup_vote_stats_unlocks u WHERE u.matchup_id = p_matchup_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', '투표 통계 열람권이 필요해요');
  END IF;

  SELECT count(*)::bigint INTO v_total FROM public.votes v WHERE v.matchup_id = p_matchup_id;
  SELECT count(*)::bigint INTO v_left FROM public.votes v WHERE v.matchup_id = p_matchup_id AND v.side = 'left';
  SELECT count(*)::bigint INTO v_right FROM public.votes v WHERE v.matchup_id = p_matchup_id AND v.side = 'right';

  SELECT coalesce(jsonb_object_agg(glabel, gstats), '{}'::jsonb)
  INTO v_by_gender
  FROM (
    SELECT
      CASE coalesce(trim(p.gender), '')
        WHEN 'male' THEN '남성'
        WHEN 'female' THEN '여성'
        WHEN 'other' THEN '기타'
        ELSE '미입력'
      END AS glabel,
      jsonb_build_object(
        'left', count(*) FILTER (WHERE v.side = 'left'),
        'right', count(*) FILTER (WHERE v.side = 'right')
      ) AS gstats
    FROM public.votes v
    INNER JOIN public.profiles p ON p.id = v.user_id
    WHERE v.matchup_id = p_matchup_id
    GROUP BY 1
  ) g;

  SELECT coalesce(jsonb_object_agg(alabel, astats), '{}'::jsonb)
  INTO v_by_age
  FROM (
    SELECT
      CASE
        WHEN p.birthdate IS NULL THEN '미입력'
        WHEN date_part('year', age(current_date, p.birthdate::date)) < 10 THEN '10대 미만'
        WHEN date_part('year', age(current_date, p.birthdate::date)) < 20 THEN '10대'
        WHEN date_part('year', age(current_date, p.birthdate::date)) < 30 THEN '20대'
        WHEN date_part('year', age(current_date, p.birthdate::date)) < 40 THEN '30대'
        WHEN date_part('year', age(current_date, p.birthdate::date)) < 50 THEN '40대'
        WHEN date_part('year', age(current_date, p.birthdate::date)) < 60 THEN '50대'
        ELSE '60대 이상'
      END AS alabel,
      jsonb_build_object(
        'left', count(*) FILTER (WHERE v.side = 'left'),
        'right', count(*) FILTER (WHERE v.side = 'right')
      ) AS astats
    FROM public.votes v
    INNER JOIN public.profiles p ON p.id = v.user_id
    WHERE v.matchup_id = p_matchup_id
    GROUP BY 1
  ) a;

  RETURN jsonb_build_object(
    'ok', true,
    'total', v_total,
    'left_total', v_left,
    'right_total', v_right,
    'left_label', coalesce(nullif(trim(v_left_label), ''), 'A'),
    'right_label', coalesce(nullif(trim(v_right_label), ''), 'B'),
    'by_gender', coalesce(v_by_gender, '{}'::jsonb),
    'by_age', coalesce(v_by_age, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_matchup_vote_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_matchup_vote_stats(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_matchup_vote_stats IS
  '투표 통계 집계(JSON) — 열람권 구매 작성자만, 성별·연령대별 좌/우 표';
