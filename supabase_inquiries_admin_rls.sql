-- ============================================================
-- VICS — inquiries 관리자 조회/처리 RLS
-- 목적:
-- - 유저는 본인 문의만 조회/작성
-- - 운영자(admin_operators active 이메일)만 전체 문의 조회/상태 업데이트
-- ============================================================

-- 0) 전제: public.admin_operators, public.profiles.email 존재

-- 1) helper: 운영자 판별 (profiles.email ↔ admin_operators.email)
create or replace function public.is_active_admin_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.admin_operators ao
      on lower(trim(ao.email)) = lower(trim(p.email))
    where p.id = auth.uid()
      and ao.status = 'active'
      and ao.is_seed = false
  );
$$;

revoke all on function public.is_active_admin_operator() from public;
grant execute on function public.is_active_admin_operator() to anon, authenticated;

comment on function public.is_active_admin_operator() is
  '현재 세션 유저가 admin_operators(active, non-seed)인지 판별';

-- 2) inquiries RLS 정책 정리
alter table public.inquiries enable row level security;

-- (과거 실수로 전체 허용 정책이 있었다면 제거)
drop policy if exists "inquiries_admin_all" on public.inquiries;

drop policy if exists "inquiries_user_select" on public.inquiries;
create policy "inquiries_user_select" on public.inquiries
  for select
  using (auth.uid() = user_id);

drop policy if exists "inquiries_user_insert" on public.inquiries;
create policy "inquiries_user_insert" on public.inquiries
  for insert
  with check (auth.uid() = user_id);

-- 운영자: 전체 문의 조회/업데이트(상태 처리)
drop policy if exists "inquiries_admin_select" on public.inquiries;
create policy "inquiries_admin_select" on public.inquiries
  for select
  using (public.is_active_admin_operator());

drop policy if exists "inquiries_admin_update" on public.inquiries;
create policy "inquiries_admin_update" on public.inquiries
  for update
  using (public.is_active_admin_operator());

-- 삭제는 기본적으로 유저 본인만(운영자 삭제 필요 시 별도 정책으로 추가)

