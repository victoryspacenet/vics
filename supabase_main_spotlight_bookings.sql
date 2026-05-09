-- Point Reward Center — 메인 스포트라이트(6h·전역 최대 6슬롯·1계정 1슬롯) 노출 예약
-- 구매·포인트 차감은 supabase_main_spotlight_purchase_rpc.sql 의 RPC만 사용 (직접 INSERT 금지)
-- Supabase SQL Editor에서 실행하세요

CREATE TABLE IF NOT EXISTS public.main_spotlight_bookings (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  matchup_id uuid NOT NULL REFERENCES public.matchups(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT main_spotlight_valid_window CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS main_spotlight_bookings_matchup_id_idx ON public.main_spotlight_bookings(matchup_id);
CREATE INDEX IF NOT EXISTS main_spotlight_bookings_ends_at_idx ON public.main_spotlight_bookings(ends_at DESC);

ALTER TABLE public.main_spotlight_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Main spotlight bookings are viewable by everyone"
  ON public.main_spotlight_bookings FOR SELECT USING (true);

-- INSERT는 purchase_main_spotlight_1h RPC(Security definer)만 수행 — 클라이언트 insert 정책 없음

COMMENT ON TABLE public.main_spotlight_bookings IS '메인 스포트라이트 노출 예약 (포인트 리워드 구매 등)';
