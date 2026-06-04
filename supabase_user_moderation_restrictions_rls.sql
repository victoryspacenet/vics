-- =============================================
-- VICS — user_moderation_restrictions RLS 강화
-- 선행: public.profiles, public.admin_operators (supabase_admin_operators.sql),
--       public.user_moderation_restrictions 테이블 (supabase_operational_storage.sql)
--
-- 일반 유저: 본인 행만 SELECT
-- 운영자: admin_operators 에 등록·active 이메일과 profiles.email 이 일치하는 계정만 INSERT/DELETE
-- (VITE_ADMIN_EMAILS 전용 관리자는 DB에 해당 이메일이 admin_operators 에 있어야 제한 등록 가능)
-- =============================================

-- 기존 완전 개방 정책 제거
drop policy if exists "mod_restrictions_all" on public.user_moderation_restrictions;

-- 운영자 여부: 로그인 유저의 profiles.email 이 active 운영자 목록에 있는지
create or replace function public.is_staff_moderation_operator()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    (
      select exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and coalesce(trim(p.email), '') <> ''
          and lower(trim(p.email)) in (
            select lower(trim(ao.email))
            from public.admin_operators ao
            where ao.status = 'active'
              and coalesce(trim(ao.email), '') <> ''
          )
      )
    ),
    false
  );
$$;

comment on function public.is_staff_moderation_operator() is
  '제한/경고 등록용: admin_operators(active) 이메일과 현재 유저 profile 이메일 일치 시 true';

grant execute on function public.is_staff_moderation_operator() to authenticated;

-- 본인 조회만
create policy "mod_restrictions_select_own"
  on public.user_moderation_restrictions
  for select
  to authenticated
  using (subject_user_id = auth.uid()::text);

-- 운영자만 타인(또는 본인) 행 삽입
create policy "mod_restrictions_insert_staff"
  on public.user_moderation_restrictions
  for insert
  to authenticated
  with check (public.is_staff_moderation_operator());

-- 잘못된 행 정리 등 (선택)
create policy "mod_restrictions_delete_staff"
  on public.user_moderation_restrictions
  for delete
  to authenticated
  using (public.is_staff_moderation_operator());
