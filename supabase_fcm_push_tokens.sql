-- ============================================================
-- FCM 디바이스 토큰 (Capacitor Push → Supabase 저장)
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

create table if not exists public.push_device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('android', 'ios', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists idx_push_device_tokens_user_id on public.push_device_tokens (user_id);
create index if not exists idx_push_device_tokens_updated on public.push_device_tokens (updated_at desc);

alter table public.push_device_tokens enable row level security;

drop policy if exists "push_tokens_select_own" on public.push_device_tokens;
create policy "push_tokens_select_own"
  on public.push_device_tokens for select
  using (auth.uid() = user_id);

drop policy if exists "push_tokens_insert_own" on public.push_device_tokens;
create policy "push_tokens_insert_own"
  on public.push_device_tokens for insert
  with check (auth.uid() = user_id);

drop policy if exists "push_tokens_update_own" on public.push_device_tokens;
create policy "push_tokens_update_own"
  on public.push_device_tokens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "push_tokens_delete_own" on public.push_device_tokens;
create policy "push_tokens_delete_own"
  on public.push_device_tokens for delete
  using (auth.uid() = user_id);

comment on table public.push_device_tokens is 'FCM/APNs용 기기 토큰. Netlify에서 service role로 조회·발송.';
