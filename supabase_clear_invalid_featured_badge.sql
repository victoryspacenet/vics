-- Star(⭐) 미만 QA 계정 — 잘못 남은 대표 배지 초기화
-- (대표 배지는 Star 이상 + 배지 획득 조건 충족 시에만 표시·설정 가능)
UPDATE public.profiles
SET
  featured_badge = NULL,
  updated_at = now()
WHERE trim(nickname) IN ('스몰 라인업', '멋쟁이해병')
  AND featured_badge IS NOT NULL;
