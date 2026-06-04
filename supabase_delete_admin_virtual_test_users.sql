-- 관리자 테스트용 가상 유저 4명 — profiles·연관 데이터 정리 (선택 실행)
-- Supabase SQL Editor에서 1회 실행. 닉네임은 필요 시 수정.
-- 주의: auth.users 삭제는 대시보드 Authentication 또는 Admin API로 별도 처리할 수 있습니다.

-- 대상 닉네임
--   수부타이, 랜디, 레젭, 빅스

DO $$
DECLARE
  target_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO target_ids
  FROM public.profiles
  WHERE trim(nickname) IN ('수부타이', '랜디', '레젭', '빅스');

  IF target_ids IS NULL OR array_length(target_ids, 1) IS NULL THEN
    RAISE NOTICE '삭제 대상 프로필 없음';
    RETURN;
  END IF;

  RAISE NOTICE '대상 % 명', array_length(target_ids, 1);

  -- FK 순서: 자식 → profiles (auth.users CASCADE는 프로젝트 설정에 따름)
  DELETE FROM public.matchup_reports
  WHERE reporter_id = ANY(target_ids);

  DELETE FROM public.votes
  WHERE user_id = ANY(target_ids);

  DELETE FROM public.matchups
  WHERE user_id = ANY(target_ids) OR right_user_id = ANY(target_ids);

  DELETE FROM public.profiles
  WHERE id = ANY(target_ids);
END $$;

SELECT id, nickname, email
FROM public.profiles
WHERE trim(nickname) IN ('수부타이', '랜디', '레젭', '빅스');
