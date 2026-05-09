-- =============================================
-- VICS Platform — admin_permission_groups 테이블
-- 권한 그룹 설정 (웹/앱 동기화)
-- =============================================

create table if not exists public.admin_permission_groups (
  id            text        primary key,
  name          text        not null,
  icon          text        not null default '📋',
  description   text        not null default '',
  last_modified text        not null default '',
  is_system     boolean     not null default false,
  permissions   jsonb       not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- updated_at 자동 갱신 트리거
create or replace function update_admin_permission_groups_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  new.last_modified = to_char(now(), 'YYYY.MM.DD');
  return new;
end;
$$;

drop trigger if exists trg_admin_permission_groups_updated_at on public.admin_permission_groups;
create trigger trg_admin_permission_groups_updated_at
  before update on public.admin_permission_groups
  for each row execute function update_admin_permission_groups_updated_at();

-- RLS
alter table public.admin_permission_groups enable row level security;

drop policy if exists "admin_pg_select" on public.admin_permission_groups;
create policy "admin_pg_select" on public.admin_permission_groups
  for select using (true);

drop policy if exists "admin_pg_insert" on public.admin_permission_groups;
create policy "admin_pg_insert" on public.admin_permission_groups
  for insert with check (true);

drop policy if exists "admin_pg_update" on public.admin_permission_groups;
create policy "admin_pg_update" on public.admin_permission_groups
  for update using (true);

drop policy if exists "admin_pg_delete" on public.admin_permission_groups;
create policy "admin_pg_delete" on public.admin_permission_groups
  for delete using (true);

-- =============================================
-- 시드 데이터 (기본 권한 그룹)
-- =============================================
insert into public.admin_permission_groups
  (id, name, icon, description, last_modified, is_system, permissions)
values
  ('master',    'Master',    '👑', '전체 메뉴 제어권',     '2025.10.01', true,  '{"dashboard":{"r":true,"w":false,"d":false,"e":false},"matchups":{"r":true,"w":true,"d":true,"e":true},"users":{"r":true,"w":true,"d":true,"e":true},"settings":{"r":true,"w":true,"d":true,"e":true}}'),
  ('editor',    'Editor',    '✍️', '콘텐츠 관리 및 제재', '2026.01.20', false, '{"dashboard":{"r":true,"w":false,"d":false,"e":false},"matchups":{"r":true,"w":true,"d":true,"e":true},"users":{"r":true,"w":true,"d":false,"e":false},"settings":{"r":false,"w":false,"d":false,"e":false}}'),
  ('cs_viewer', 'CS_Viewer', '🎧', '유저 문의 대응 전용', '2026.02.10', false, '{"dashboard":{"r":true,"w":false,"d":false,"e":false},"matchups":{"r":true,"w":false,"d":false,"e":false},"users":{"r":true,"w":false,"d":false,"e":false},"settings":{"r":false,"w":false,"d":false,"e":false}}')
on conflict (id) do nothing;
