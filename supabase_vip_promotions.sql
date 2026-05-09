-- =============================================
-- VICS - Vip 전광판 (하루 1회 매치업 홍보)
-- Supabase SQL Editor에서 실행하세요
-- =============================================

CREATE TABLE IF NOT EXISTS public.vip_promotions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  matchup_id uuid REFERENCES public.matchups(id) ON DELETE CASCADE NOT NULL,
  promoted_at date DEFAULT (CURRENT_DATE) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, promoted_at)
);

CREATE INDEX IF NOT EXISTS vip_promotions_promoted_at_idx ON public.vip_promotions(promoted_at DESC);
CREATE INDEX IF NOT EXISTS vip_promotions_user_id_idx ON public.vip_promotions(user_id);

ALTER TABLE public.vip_promotions ENABLE ROW LEVEL SECURITY;

-- 모든 사용자 조회 가능
CREATE POLICY "Vip promotions are viewable by everyone"
  ON public.vip_promotions FOR SELECT USING (true);

-- 인증된 사용자만 자신의 홍보 등록 (Vip 여부는 앱에서 검증)
CREATE POLICY "Users can insert own vip promotion"
  ON public.vip_promotions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own vip promotion"
  ON public.vip_promotions FOR DELETE USING (auth.uid() = user_id);
