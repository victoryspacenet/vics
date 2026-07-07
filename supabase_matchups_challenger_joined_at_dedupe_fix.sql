-- 매치업 관리 페이지 "최종매치업등록일" 중복 표시 수정
--
-- 배경: challenger_joined_at 백필(supabase_matchups_challenger_joined_at.sql) 실행 당시,
-- matchups 테이블의 BEFORE UPDATE 트리거(update_matchups_updated_at)가 updated_at을
-- 무조건 현재 시각으로 덮어써서, 여러 매치업이 정확히 같은 challenger_joined_at 값을
-- 갖게 됐습니다(실제로는 서로 다른 시각에 도전 완료된 매치업들인데 같은 값으로 뭉침).
--
-- 이 SQL은 2건 이상이 정확히 동일한 challenger_joined_at을 공유하는(=자연 발생 확률이
-- 사실상 0인) 값을 백필 아티팩트로 간주해 NULL로 되돌립니다.
-- NULL이 되면 화면에서는 다음 우선순위 폴백(challenger_joined_at → updated_at → created_at)에
-- 따라 매치업별로 구분되는 created_at이 대신 표시됩니다.
--
-- 주의: 실제 도전 완료 시각 자체는 그 당시 기록되지 않아 복구할 수 없습니다.
-- 이 SQL 실행 이후 새로 도전 완료되는 매치업은 ChallengeDrawer에서 정확한 시각을
-- 직접 저장하므로 이 문제가 재발하지 않습니다.

WITH dupes AS (
  SELECT challenger_joined_at
  FROM public.matchups
  WHERE challenger_joined_at IS NOT NULL
  GROUP BY challenger_joined_at
  HAVING count(*) > 1
)
UPDATE public.matchups m
SET challenger_joined_at = NULL
FROM dupes d
WHERE m.challenger_joined_at = d.challenger_joined_at;

-- 확인용: 실행 후 중복이 남아있지 않은지 체크
-- SELECT challenger_joined_at, count(*)
-- FROM public.matchups
-- WHERE challenger_joined_at IS NOT NULL
-- GROUP BY challenger_joined_at
-- HAVING count(*) > 1;
