-- 오른쪽(도전) 측 작성자 → profiles.nickname 조인용
-- 앱: ChallengeDrawer 완료 시 right_user_id = auth.uid() 설정
-- 조회: .select('..., right_profiles:right_user_id(nickname, ...)')

alter table public.matchups
  add column if not exists right_user_id uuid references public.profiles(id) on delete set null;

create index if not exists matchups_right_user_id_idx on public.matchups(right_user_id);

comment on column public.matchups.right_user_id is 'RIGHT 측 콘텐츠를 제출한 프로필 id (도전자). LEFT 작성자는 user_id.';

-- 도전자가 오른쪽이 비어 있을 때만 해당 필드들로 완료 업데이트 가능 (소유자 정책과 OR)
drop policy if exists "Challenger completes open matchup" on public.matchups;
create policy "Challenger completes open matchup"
  on public.matchups
  for update
  to authenticated
  using (right_type is null)
  with check (
    right_type is not null
    and right_user_id = (select auth.uid())
  );
