-- =============================================
-- VICS Platform — admin_operators 테이블
-- 운영자 계정 관리 (웹/앱 동기화)
-- =============================================

create table if not exists public.admin_operators (
  id              text        primary key,
  name            text        not null,
  department      text        not null default '',
  email           text        not null default '',
  status          text        not null default 'active' check (status in ('active', 'suspended')),
  last_access     text        not null default '미접속',
  last_access_ip  text        not null default '-',
  otp_enabled     boolean     not null default false,
  permission      text        not null default 'Editor',
  granular        jsonb       not null default '{}',
  is_seed         boolean     not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- updated_at 자동 갱신 트리거
create or replace function update_admin_operators_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_admin_operators_updated_at on public.admin_operators;
create trigger trg_admin_operators_updated_at
  before update on public.admin_operators
  for each row execute function update_admin_operators_updated_at();

-- RLS
alter table public.admin_operators enable row level security;

drop policy if exists "admin_operators_select" on public.admin_operators;
create policy "admin_operators_select" on public.admin_operators
  for select using (true);

drop policy if exists "admin_operators_insert" on public.admin_operators;
create policy "admin_operators_insert" on public.admin_operators
  for insert with check (true);

drop policy if exists "admin_operators_update" on public.admin_operators;
create policy "admin_operators_update" on public.admin_operators
  for update using (true);

drop policy if exists "admin_operators_delete" on public.admin_operators;
create policy "admin_operators_delete" on public.admin_operators
  for delete using (true);

-- 인덱스
create index if not exists idx_admin_operators_status on public.admin_operators(status);
create index if not exists idx_admin_operators_permission on public.admin_operators(permission);

-- 시드(목) 운영자 12건은 더 이상 삽입하지 않음.
-- 기존 DB 정리: supabase_delete_admin_operators_seed.sql 실행
