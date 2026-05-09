-- 관리자 활성 카테고리 설정 (앱·웹·기기 간 동일 목록)
-- Supabase SQL Editor에서 실행 후, 웹 관리자에서 카테고리를 한 번 저장하면 원격에 반영됩니다.

create table if not exists public.category_admin_config (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.category_admin_config enable row level security;

-- 읽기: 비로그인 포함 전체 (피드·매치업 생성 등에서 동일 목록 필요)
create policy "category_admin_config_select"
  on public.category_admin_config for select
  using (true);

-- 쓰기: 로그인 사용자만 (관리자가 브라우저에서 저장할 때)
create policy "category_admin_config_insert"
  on public.category_admin_config for insert
  with check (auth.role() = 'authenticated');

create policy "category_admin_config_update"
  on public.category_admin_config for update
  using (auth.role() = 'authenticated');
