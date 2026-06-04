-- Netlify Functions 분산 rate limit (투표 등) — Supabase SQL Editor 1회 실행
-- service_role 전용 RPC. anon/authenticated 직접 접근 불가.

CREATE TABLE IF NOT EXISTS public.api_rate_limit_buckets (
  bucket_key text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count int NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);

CREATE INDEX IF NOT EXISTS api_rate_limit_buckets_window_idx
  ON public.api_rate_limit_buckets (window_start);

ALTER TABLE public.api_rate_limit_buckets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_api_rate_limit(
  p_bucket_key text,
  p_window_seconds int DEFAULT 60,
  p_max_requests int DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_count int;
BEGIN
  IF p_bucket_key IS NULL OR length(trim(p_bucket_key)) = 0 THEN
    RETURN true;
  END IF;
  IF p_window_seconds IS NULL OR p_window_seconds < 1 THEN
    p_window_seconds := 60;
  END IF;
  IF p_max_requests IS NULL OR p_max_requests < 1 THEN
    p_max_requests := 60;
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.api_rate_limit_buckets (bucket_key, window_start, request_count)
  VALUES (p_bucket_key, v_window_start, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET request_count = api_rate_limit_buckets.request_count + 1
  RETURNING request_count INTO v_count;

  IF random() < 0.02 THEN
    DELETE FROM public.api_rate_limit_buckets
    WHERE window_start < now() - make_interval(hours => 2);
  END IF;

  RETURN v_count <= p_max_requests;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_api_rate_limit(text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit(text, int, int) TO service_role;
