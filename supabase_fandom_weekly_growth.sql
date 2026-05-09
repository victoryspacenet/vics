-- =============================================
-- VICS — 팬덤 주간 증가율 RPC
-- 선행: supabase_fandom.sql (vcard_story_claps)
-- =============================================

-- 이번 주(최근 7일) / 지난 주(8~14일 전) Clap 수 집계 → 증가율 계산
CREATE OR REPLACE FUNCTION public.get_fandom_weekly_growth(p_owner uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'this_week',
      count(*) FILTER (WHERE created_at >= now() - interval '7 days'),
    'last_week',
      count(*) FILTER (
        WHERE created_at >= now() - interval '14 days'
          AND created_at <  now() - interval '7 days'
      )
  )
  FROM public.vcard_story_claps
  WHERE owner_user_id = p_owner
$$;

-- 본인 또는 익명 조회 허용 (공개 프로필 호환)
REVOKE ALL ON FUNCTION public.get_fandom_weekly_growth(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_fandom_weekly_growth(uuid) TO authenticated, anon;
