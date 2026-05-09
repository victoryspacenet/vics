-- =============================================
-- VICS Platform — admin_settings 테이블
-- 어드민 전역 설정 (웹/앱 동기화)
-- =============================================

create table if not exists public.admin_settings (
  key        text        primary key,
  value      jsonb       not null default '{}',
  updated_at timestamptz not null default now()
);

-- updated_at 자동 갱신 트리거
create or replace function update_admin_settings_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_admin_settings_updated_at on public.admin_settings;
create trigger trg_admin_settings_updated_at
  before update on public.admin_settings
  for each row execute function update_admin_settings_updated_at();

-- RLS
alter table public.admin_settings enable row level security;

drop policy if exists "admin_settings_select" on public.admin_settings;
create policy "admin_settings_select" on public.admin_settings
  for select using (true);

drop policy if exists "admin_settings_insert" on public.admin_settings;
create policy "admin_settings_insert" on public.admin_settings
  for insert with check (true);

drop policy if exists "admin_settings_update" on public.admin_settings;
create policy "admin_settings_update" on public.admin_settings
  for update using (true);

drop policy if exists "admin_settings_delete" on public.admin_settings;
create policy "admin_settings_delete" on public.admin_settings
  for delete using (true);

-- =============================================
-- 시드 데이터 (2FA 기본값)
-- =============================================
insert into public.admin_settings (key, value)
values ('2fa', '{"enabled": false, "method": "totp"}')
on conflict (key) do nothing;
