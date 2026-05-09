-- 도전자(B)가 이미 right_type / right_user_id 가 채워진 뒤에도
-- 오른쪽 콘텐츠만 다시 수정할 수 있도록 RLS 정책 추가
--
-- 기존 "Challenger completes open matchup" 은 using (right_type is null) 이라
-- 첫 도전 제출(비어 있음 → 채움)만 허용하고, 이후 수정은 막힙니다.
-- 이 파일은 그 다음 단계(도전자 본인의 수정)를 허용합니다.
--
-- 적용: Supabase 대시보드 → SQL Editor → 전체 실행
-- 또는 supabase db push / 로컬 마이그레이션 워크플로에 맞게 실행

drop policy if exists "Challenger updates own right side" on public.matchups;

create policy "Challenger updates own right side"
  on public.matchups
  for update
  to authenticated
  using (
    auth.uid() = right_user_id
    and right_user_id is not null
    and right_type is not null
  )
  with check (
    auth.uid() = right_user_id
    -- 작성자(A) 고정: user_id 는 DB에 이미 있는 값과 같아야 함 (바꿔치기 방지)
    and user_id = (select m.user_id from public.matchups m where m.id = matchups.id)
  );

comment on policy "Challenger updates own right side" on public.matchups is
  '도전자(B)가 본인이 올린 오른쪽 콘텐츠를 수정할 때. 첫 제출은 "Challenger completes open matchup" 정책이 담당.';
