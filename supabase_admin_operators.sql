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

-- =============================================
-- 시드 데이터 (기존 mock 운영자 계정)
-- =============================================
insert into public.admin_operators
  (id, name, department, email, status, last_access, last_access_ip, otp_enabled, permission, granular, is_seed)
values
  ('admin_01',    '김운영', '운영팀',   'kim@vsmatch.com',   'active',    '2026.02.13 14:02', '211.XXX.XXX.5',  true,  'Master',    '{"matchups":{"r":true,"w":true,"d":true,"e":true},"users":{"r":true,"w":true,"d":true,"e":true},"inquiry":{"r":true,"w":true,"d":true,"e":true}}', true),
  ('contents_2',  '이관리', '콘텐츠팀', 'lee@vsmatch.com',   'active',    '2026.02.12 18:30', '211.XXX.XXX.12', true,  'Editor',    '{"matchups":{"r":true,"w":true,"d":false,"e":false},"users":{"r":true,"w":true,"d":false,"e":false},"inquiry":{"r":true,"w":true,"d":false,"e":false}}', true),
  ('cs_team_a',   '박상담', 'CS팀',     'park@vsmatch.com',  'active',    '2026.02.10 09:15', '211.XXX.XXX.8',  false, 'CS_Viewer', '{"matchups":{"r":true,"w":false,"d":false,"e":false},"users":{"r":true,"w":false,"d":false,"e":false},"inquiry":{"r":true,"w":true,"d":false,"e":false}}', true),
  ('dev_test',    '최개발', '개발팀',   'choi@vsmatch.com',  'suspended', '2025.12.30 11:00', '211.XXX.XXX.3',  true,  'Master',    '{"matchups":{"r":true,"w":true,"d":true,"e":true},"users":{"r":true,"w":true,"d":true,"e":true},"inquiry":{"r":true,"w":true,"d":true,"e":true}}', true),
  ('admin_02',    '강수석', '운영팀',   'kang@vsmatch.com',  'active',    '2026.02.13 09:30', '211.XXX.XXX.5',  true,  'Editor',    '{"matchups":{"r":true,"w":true,"d":false,"e":false},"users":{"r":true,"w":true,"d":false,"e":false},"inquiry":{"r":true,"w":true,"d":false,"e":false}}', true),
  ('marketing_1', '정홍보', '마케팅팀', 'jung@vsmatch.com',  'active',    '2026.02.13 16:20', '211.XXX.XXX.9',  false, 'Editor',    '{"matchups":{"r":true,"w":true,"d":false,"e":false},"users":{"r":true,"w":true,"d":false,"e":false},"inquiry":{"r":true,"w":true,"d":false,"e":false}}', true),
  ('ops_team_1',  '한운영', '운영팀',   'han@vsmatch.com',   'active',    '2026.02.11 10:00', '211.XXX.XXX.7',  true,  'Editor',    '{"matchups":{"r":true,"w":true,"d":false,"e":false},"users":{"r":true,"w":true,"d":false,"e":false},"inquiry":{"r":true,"w":true,"d":false,"e":false}}', true),
  ('cs_team_b',   '조상담', 'CS팀',     'jo@vsmatch.com',    'active',    '2026.02.09 15:45', '211.XXX.XXX.4',  false, 'CS_Viewer', '{"matchups":{"r":true,"w":false,"d":false,"e":false},"users":{"r":true,"w":false,"d":false,"e":false},"inquiry":{"r":true,"w":true,"d":false,"e":false}}', true),
  ('design_1',    '윤디자인','콘텐츠팀','yoon@vsmatch.com',  'active',    '2026.02.12 14:20', '211.XXX.XXX.6',  false, 'Editor',    '{"matchups":{"r":true,"w":true,"d":false,"e":false},"users":{"r":true,"w":true,"d":false,"e":false},"inquiry":{"r":true,"w":true,"d":false,"e":false}}', true),
  ('data_1',      '송데이터','개발팀',  'song@vsmatch.com',  'active',    '2026.02.08 11:00', '211.XXX.XXX.2',  true,  'CS_Viewer', '{"matchups":{"r":true,"w":false,"d":false,"e":false},"users":{"r":true,"w":false,"d":false,"e":false},"inquiry":{"r":true,"w":true,"d":false,"e":false}}', true),
  ('temp_worker', '임계약', 'CS팀',     'lim@vsmatch.com',   'active',    '2025.11.01 09:00', '211.XXX.XXX.1',  false, 'CS_Viewer', '{"matchups":{"r":true,"w":false,"d":false,"e":false},"users":{"r":true,"w":false,"d":false,"e":false},"inquiry":{"r":true,"w":true,"d":false,"e":false}}', true),
  ('legacy_admin','구관리', '운영팀',   'gu@vsmatch.com',    'suspended', '2025.10.15 16:00', '211.XXX.XXX.0',  false, 'Editor',    '{"matchups":{"r":true,"w":true,"d":false,"e":false},"users":{"r":true,"w":true,"d":false,"e":false},"inquiry":{"r":true,"w":true,"d":false,"e":false}}', true)
on conflict (id) do nothing;
