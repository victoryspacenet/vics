-- =============================================
-- VICS — 나의 랭킹 히스토리 (갤러리 카드)
-- Supabase SQL Editor에서 실행
-- =============================================

CREATE TABLE IF NOT EXISTS public.ranking_gallery_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  rank integer NOT NULL CHECK (rank >= 1),
  nickname text,
  points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  period text NOT NULL DEFAULT 'weekly' CHECK (period IN ('weekly', 'monthly', 'all')),
  theme_id text NOT NULL DEFAULT 'slate',
  matchup_tier_id text NOT NULL DEFAULT 'player' CHECK (matchup_tier_id IN ('player', 'star', 'master', 'vip', 'goat')),
  show_nickname boolean NOT NULL DEFAULT true,
  show_points boolean NOT NULL DEFAULT true,
  show_rank boolean NOT NULL DEFAULT true,
  thumbnail text,
  is_new boolean NOT NULL DEFAULT true,
  saved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ranking_gallery_thumbnail_len CHECK (thumbnail IS NULL OR char_length(thumbnail) <= 600000)
);

CREATE INDEX IF NOT EXISTS ranking_gallery_cards_user_saved_idx
  ON public.ranking_gallery_cards (user_id, saved_at DESC);

ALTER TABLE public.ranking_gallery_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ranking_gallery_cards_select_own" ON public.ranking_gallery_cards;
CREATE POLICY "ranking_gallery_cards_select_own" ON public.ranking_gallery_cards
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ranking_gallery_cards_insert_own" ON public.ranking_gallery_cards;
CREATE POLICY "ranking_gallery_cards_insert_own" ON public.ranking_gallery_cards
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ranking_gallery_cards_update_own" ON public.ranking_gallery_cards;
CREATE POLICY "ranking_gallery_cards_update_own" ON public.ranking_gallery_cards
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ranking_gallery_cards_delete_own" ON public.ranking_gallery_cards;
CREATE POLICY "ranking_gallery_cards_delete_own" ON public.ranking_gallery_cards
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.ranking_gallery_cards IS '랭킹 카드 에디터 저장 — 사용자당 최대 40장';

-- ── 사용자당 40장 유지 ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trim_ranking_gallery_cards_for_user ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.ranking_gallery_cards AS t
  WHERE t.user_id = NEW.user_id
    AND t.id NOT IN (
      SELECT s.id
      FROM public.ranking_gallery_cards AS s
      WHERE s.user_id = NEW.user_id
      ORDER BY s.saved_at DESC, s.created_at DESC
      LIMIT 40
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ranking_gallery_cards_trim ON public.ranking_gallery_cards;
CREATE TRIGGER ranking_gallery_cards_trim
  AFTER INSERT ON public.ranking_gallery_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.trim_ranking_gallery_cards_for_user();

-- 기존 테이블에 컬럼 추가 (이미 생성된 경우)
ALTER TABLE public.ranking_gallery_cards
  ADD COLUMN IF NOT EXISTS matchup_tier_id text NOT NULL DEFAULT 'player';

ALTER TABLE public.ranking_gallery_cards
  DROP CONSTRAINT IF EXISTS ranking_gallery_cards_matchup_tier_id_check;

ALTER TABLE public.ranking_gallery_cards
  ADD CONSTRAINT ranking_gallery_cards_matchup_tier_id_check
  CHECK (matchup_tier_id IN ('player', 'star', 'master', 'vip', 'goat'));
