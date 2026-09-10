-- =============================================================================
-- 시즌 1 시작일: 2026-09-10 00:00 KST (관전봇 참여 시점)
-- 종료: 시작 + 4개월
-- 실제 회원 포인트는 유지. 운영 QA 계정 2명만 포인트 초기화.
--   스몰 라인업 · 글로벌
-- =============================================================================

INSERT INTO public.seasons (number, start_at, end_at)
VALUES (
  1,
  timestamptz '2026-09-10 00:00:00+09',
  timestamptz '2026-09-10 00:00:00+09' + interval '4 months'
)
ON CONFLICT (number) DO UPDATE
SET
  start_at = EXCLUDED.start_at,
  end_at = EXCLUDED.end_at;

-- 거래 내역을 지우지 않으면 정산 백필이 포인트를 다시 채움
DELETE FROM public.point_transactions pt
USING public.profiles p
WHERE pt.user_id = p.id
  AND trim(p.nickname) IN ('스몰 라인업', '글로벌');

UPDATE public.profiles
SET
  points = 100,
  champion_points = 0,
  oracle_points = 0,
  season_points = 0,
  season_champion_points = 0,
  season_oracle_points = 0,
  updated_at = now()
WHERE trim(nickname) IN ('스몰 라인업', '글로벌');

SELECT number, start_at, end_at
FROM public.seasons
WHERE number = 1;

SELECT id, nickname, points, champion_points, oracle_points,
       season_points, season_champion_points, season_oracle_points
FROM public.profiles
WHERE trim(nickname) IN ('스몰 라인업', '글로벌');
