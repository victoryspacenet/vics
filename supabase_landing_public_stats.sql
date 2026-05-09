-- 랜딩 페이지 공개 지표 (anon 집계용)
-- 배포 후 Supabase SQL 에디터에서 실행하세요.

create or replace function public.get_landing_public_stats()
returns table (
  matchup_count bigint,
  vote_count bigint,
  voter_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::bigint from public.matchups where status in ('active', 'closed')),
    (select count(*)::bigint from public.votes),
    (select coalesce(count(distinct user_id), 0)::bigint from public.votes);
$$;

revoke all on function public.get_landing_public_stats() from public;
grant execute on function public.get_landing_public_stats() to anon, authenticated;
