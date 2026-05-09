-- =============================================
-- 운영자: 90일 미접속 자동 정지 + 보안 로그
-- (기존 supabase_admin_operators.sql 적용 후 실행)
-- =============================================

-- 1) 마지막 접속 시각 (미접속 계정은 NULL → created_at 기준으로 90일 판단)
alter table public.admin_operators
  add column if not exists last_access_at timestamptz;

-- 기존 데이터 백필 (이미 값이 있으면 유지)
update public.admin_operators
set last_access_at = timestamptz '2025-11-01 00:00:00+09'
where id = 'temp_worker' and last_access_at is null;

update public.admin_operators
set last_access_at = null
where last_access = '미접속';

-- 시드 등: 접속 이력 문자열만 있고 시각이 없으면 최근 접속으로 간주(일괄 정지 방지)
update public.admin_operators
set last_access_at = now() - interval '7 days'
where last_access_at is null
  and coalesce(last_access, '') <> '미접속';

-- 2) 보안 로그
create table if not exists public.admin_operator_security_log (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  action                text not null,
  target_operator_id    text,
  target_operator_name  text,
  actor_label           text not null default '',
  detail                jsonb not null default '{}'::jsonb
);

create index if not exists idx_admin_operator_security_log_created
  on public.admin_operator_security_log (created_at desc);

alter table public.admin_operator_security_log enable row level security;

drop policy if exists "admin_operator_security_log_select" on public.admin_operator_security_log;
create policy "admin_operator_security_log_select" on public.admin_operator_security_log
  for select using (true);

drop policy if exists "admin_operator_security_log_insert" on public.admin_operator_security_log;
create policy "admin_operator_security_log_insert" on public.admin_operator_security_log
  for insert with check (true);

-- 3) 90일 미접속 활성 계정 정지 + 로그
create or replace function public.suspend_operators_idle_90d()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select id, name
    from public.admin_operators
    where status = 'active'
      and coalesce(last_access_at, created_at) < (now() - interval '90 days')
  loop
    insert into public.admin_operator_security_log (
      action, target_operator_id, target_operator_name, actor_label, detail
    ) values (
      'auto_suspend_idle',
      r.id,
      r.name,
      '시스템(90일 미접속)',
      jsonb_build_object('policy', 'idle_90d')
    );
    update public.admin_operators
    set status = 'suspended'
    where id = r.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

grant execute on function public.suspend_operators_idle_90d() to anon;
grant execute on function public.suspend_operators_idle_90d() to authenticated;
grant execute on function public.suspend_operators_idle_90d() to service_role;

-- (선택) 프로덕션에서는 pg_cron 등으로 매일 `select public.suspend_operators_idle_90d();` 를 호출해
-- 관리자가 목록을 열지 않아도 90일 정지가 적용되게 할 수 있어요.
