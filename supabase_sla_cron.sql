-- =============================================
-- VICS Platform — SLA 초과 문의 리마인드
-- 관리자 알림 (admin_notifications) + 주기 실행
--
-- 실행 방법 (택일 또는 병행):
--   A) Netlify: 배포 시 `sla-inquiry-reminders` 스케줄 함수가 매시간 RPC 호출
--      → Supabase에 SUPABASE_SERVICE_ROLE_KEY 설정, 아래 GRANT 필요
--   B) Supabase pg_cron: Database → Extensions → pg_cron 활성화 후 하단 주석 해제
--
-- Supabase SQL Editor에서 실행하세요 (이미 적용된 객체는 CREATE OR REPLACE / IF NOT EXISTS로 안전)
-- =============================================
-- ─────────────────────────────────────────────
-- 1. 관리자 알림 테이블 (admin_notifications)
-- ─────────────────────────────────────────────
create table if not exists public.admin_notifications (
  id          bigint      generated always as identity primary key,
  type        text        not null default 'sla',        -- 'sla' | 'system'
  title       text        not null,
  body        text        not null default '',
  is_read     boolean     not null default false,
  related_id  text,                                       -- inquiry id
  created_at  timestamptz not null default now()
);

alter table public.admin_notifications enable row level security;

drop policy if exists "admin_notif_select" on public.admin_notifications;
create policy "admin_notif_select" on public.admin_notifications for select using (true);

drop policy if exists "admin_notif_insert" on public.admin_notifications;
create policy "admin_notif_insert" on public.admin_notifications for insert with check (true);

drop policy if exists "admin_notif_update" on public.admin_notifications;
create policy "admin_notif_update" on public.admin_notifications for update using (true);

drop policy if exists "admin_notif_delete" on public.admin_notifications;
create policy "admin_notif_delete" on public.admin_notifications for delete using (true);

create or replace function public.get_sla_hours()
returns integer
language plpgsql
stable
as $$
declare
  v_val text;
begin
  select (value->>'hours')
  into v_val
  from public.admin_settings
  where key = 'sla';

  return coalesce(nullif(trim(v_val), '')::integer, 12);
end;
$$;

-- ─────────────────────────────────────────────
-- 3. SLA 초과 문의 탐지 + admin_notifications 삽입
--    - 설정 센터 admin_settings.key = 'sla' 의 hours 사용
--    - 미처리: status = pending 이고 수동 답변(inquiry_replies.reply_type = 'manual')이 없음
--      (자동응대만 있는 문의도 SLA 대상 — 운영자 수동 답변 전까지)
--    - 동일 문의당 달력일 1회만 SLA 알림 (중복 방지)
-- ─────────────────────────────────────────────
create or replace function public.check_sla_and_notify()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hours  integer;
  v_cutoff timestamptz;
  v_rec    record;
  v_exists boolean;
begin
  v_hours  := get_sla_hours();
  v_cutoff := now() - (v_hours || ' hours')::interval;

  for v_rec in
    select i.id, i.title, i.created_at
    from public.inquiries i
    where i.status = 'pending'
      and i.created_at <= v_cutoff
      and not exists (
        select 1 from public.inquiry_replies r
        where r.inquiry_id = i.id and r.reply_type = 'manual'
      )
  loop
    select exists(
      select 1 from public.admin_notifications
      where related_id = v_rec.id::text
        and type = 'sla'
        and created_at >= current_date
    ) into v_exists;

    if not v_exists then
      insert into public.admin_notifications (type, title, body, related_id)
      values (
        'sla',
        'SLA 초과 미처리 문의',
        '"' || left(coalesce(v_rec.title, ''), 40) || '" — ' || v_hours || '시간 이상 미처리',
        v_rec.id::text
      );
    end if;
  end loop;
end;
$$;

-- RPC는 service_role만 호출 (Netlify 등 백엔드)
revoke all on function public.get_sla_hours() from public;
revoke all on function public.check_sla_and_notify() from public;
grant execute on function public.check_sla_and_notify() to service_role;

-- ─────────────────────────────────────────────
-- 4. pg_cron (Supabase에서 확장 활성화한 경우)
--    이미 등록됐다면 cron.unschedule('sla_check_hourly') 후 재등록
-- ─────────────────────────────────────────────
-- select cron.schedule(
--   'sla_check_hourly',
--   '0 * * * *',
--   $$ select public.check_sla_and_notify(); $$
-- );
-- ─────────────────────────────────────────────
-- 5. admin_settings 에 SLA 키 추가 (없을 경우)
-- ─────────────────────────────────────────────
insert into public.admin_settings (key, value)
values ('sla', '{"hours": 12}')
on conflict (key) do nothing;
