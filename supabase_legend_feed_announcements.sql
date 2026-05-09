-- 메인 피드 상단: 다이아몬드(팬덤) 달성 전설 강림 배너 (최근 10분 노출용 행)
-- 클라이언트에서 created_at 기준 10분 이내만 표시합니다.

CREATE TABLE IF NOT EXISTS public.legend_feed_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  nickname text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legend_feed_announcements_created_idx
  ON public.legend_feed_announcements (created_at DESC);

COMMENT ON TABLE public.legend_feed_announcements IS '다이아몬드 팬덤 등급 달성 시 메인 피드 배너(약 10분, 클라이언트는 최신순 최대 5건만 표시)';

ALTER TABLE public.legend_feed_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "legend_feed_announcements_select_all" ON public.legend_feed_announcements;
CREATE POLICY "legend_feed_announcements_select_all" ON public.legend_feed_announcements
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "legend_feed_announcements_insert_own" ON public.legend_feed_announcements;
CREATE POLICY "legend_feed_announcements_insert_own" ON public.legend_feed_announcements
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT ON public.legend_feed_announcements TO anon, authenticated;
GRANT INSERT ON public.legend_feed_announcements TO authenticated;

-- Realtime(선택): Supabase Dashboard → Database → Replication 에서
-- `legend_feed_announcements` INSERT 를 켜면 다른 탭에서도 즉시 반영됩니다.
