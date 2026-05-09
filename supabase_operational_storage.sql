-- ============================================================
-- VICS — 운영 데이터 브라우저 저장소 제거용 (Supabase 전용)
-- Supabase SQL Editor에서 한 번 실행하세요.
-- 기존: notifications.type CHECK, inquiries, notices 등이 있다고 가정합니다.
-- ============================================================

-- ── 1) notifications: 타입 확장 + 메타 컬럼 ──────────────────
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'vote', 'comment', 'like', 'match_complete', 'ranking',
    'notice', 'content_deletion', 'restriction_lift', 'appeal_result'
  ));

alter table public.notifications add column if not exists related_notice_id uuid;
alter table public.notifications add column if not exists payload jsonb not null default '{}'::jsonb;

-- ── 2) 공지 푸시 브로드캐스트 (전 프로필에 알림 1건씩) ───────
create or replace function public.broadcast_notice_push(p_notice_id uuid, p_title text, p_body text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare n bigint;
begin
  insert into public.notifications (user_id, type, title, body, related_notice_id, is_read, payload)
  select p.id, 'notice', p_title, p_body, p_notice_id, false, '{}'::jsonb
  from public.profiles p;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.broadcast_notice_push(uuid, text, text) to anon, authenticated;

-- ── 3) 단일 사용자 알림 ─────────────────────────────────────
create or replace function public.create_user_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_payload jsonb default '{}'::jsonb,
  p_related_notice_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare nid uuid;
begin
  insert into public.notifications (user_id, type, title, body, related_matchup_id, is_read, payload, related_notice_id)
  values (p_user_id, p_type, p_title, p_body, null, false, coalesce(p_payload, '{}'::jsonb), p_related_notice_id)
  returning id into nid;
  return nid;
end;
$$;

grant execute on function public.create_user_notification(uuid, text, text, text, jsonb, uuid) to anon, authenticated;

-- ── 4) 팝업 공지 (문서 전체 JSON) ───────────────────────────
create table if not exists public.popup_notices (
  id text primary key,
  doc jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_popup_notices_updated on public.popup_notices (updated_at desc);

alter table public.popup_notices enable row level security;
drop policy if exists "popup_notices_all" on public.popup_notices;
create policy "popup_notices_all" on public.popup_notices for all using (true) with check (true);

-- ── 5) 팝업 "오늘 하루 보지 않기" (사용자별) ────────────────
create table if not exists public.popup_notice_snoozes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  popup_id text not null,
  snooze_until timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, popup_id)
);

alter table public.popup_notice_snoozes enable row level security;
drop policy if exists "popup_snoozes_own" on public.popup_notice_snoozes;
create policy "popup_snoozes_select_own" on public.popup_notice_snoozes for select using (auth.uid() = user_id);
create policy "popup_snoozes_insert_own" on public.popup_notice_snoozes for insert with check (auth.uid() = user_id);
create policy "popup_snoozes_update_own" on public.popup_notice_snoozes for update using (auth.uid() = user_id);
create policy "popup_snoozes_delete_own" on public.popup_notice_snoozes for delete using (auth.uid() = user_id);

-- ── 6) 콘텐츠 삭제 안내 (사용자별) ───────────────────────────
create table if not exists public.content_deletion_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  doc jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_content_deletion_user on public.content_deletion_notices (user_id, created_at desc);

alter table public.content_deletion_notices enable row level security;
drop policy if exists "content_deletion_select_own" on public.content_deletion_notices;
create policy "content_deletion_select_own" on public.content_deletion_notices for select using (auth.uid() = user_id);
drop policy if exists "content_deletion_insert_any" on public.content_deletion_notices;
create policy "content_deletion_insert_any" on public.content_deletion_notices for insert with check (true);
drop policy if exists "content_deletion_update_own" on public.content_deletion_notices;
create policy "content_deletion_update_own" on public.content_deletion_notices for update using (auth.uid() = user_id);

-- ── 7) 문의 답변 만족도 ─────────────────────────────────────
create table if not exists public.inquiry_satisfaction (
  user_id uuid not null references public.profiles(id) on delete cascade,
  inquiry_key text not null,
  value text not null check (value in ('good', 'bad')),
  created_at timestamptz not null default now(),
  primary key (user_id, inquiry_key)
);

alter table public.inquiry_satisfaction enable row level security;
drop policy if exists "inquiry_sat_select_own" on public.inquiry_satisfaction;
create policy "inquiry_sat_select_own" on public.inquiry_satisfaction for select using (auth.uid() = user_id);
drop policy if exists "inquiry_sat_upsert_own" on public.inquiry_satisfaction;
create policy "inquiry_sat_insert_own" on public.inquiry_satisfaction for insert with check (auth.uid() = user_id);
drop policy if exists "inquiry_sat_update_own" on public.inquiry_satisfaction;
create policy "inquiry_sat_update_own" on public.inquiry_satisfaction for update using (auth.uid() = user_id);

-- ── 8) FAQ 피드백 이벤트 (통계는 집계 쿼리) ─────────────────
create table if not exists public.faq_feedback_events (
  id uuid primary key default gen_random_uuid(),
  faq_id text not null,
  user_id uuid references public.profiles(id) on delete set null,
  vote text not null check (vote in ('helpful', 'not_helpful')),
  created_at timestamptz not null default now()
);

create index if not exists idx_faq_feedback_faq on public.faq_feedback_events (faq_id);

alter table public.faq_feedback_events enable row level security;
drop policy if exists "faq_feedback_insert" on public.faq_feedback_events;
drop policy if exists "faq_feedback_select_all" on public.faq_feedback_events;
create policy "faq_feedback_insert" on public.faq_feedback_events for insert with check (true);
create policy "faq_feedback_select_all" on public.faq_feedback_events for select using (true);

-- ── 9) 문의 답변 템플릿 (관리자) ────────────────────────────
create table if not exists public.inquiry_reply_templates (
  id text primary key,
  name text not null,
  body text not null,
  updated_at timestamptz not null default now()
);

alter table public.inquiry_reply_templates enable row level security;
drop policy if exists "inquiry_templates_all" on public.inquiry_reply_templates;
create policy "inquiry_templates_all" on public.inquiry_reply_templates for all using (true) with check (true);

-- ── 10) 경고 / 이용 제한 이력 (subject: uuid 문자열 또는 mock id) ──
create table if not exists public.user_moderation_warnings (
  id uuid primary key default gen_random_uuid(),
  subject_user_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_mod_warnings_subject on public.user_moderation_warnings (subject_user_id, created_at desc);

alter table public.user_moderation_warnings enable row level security;
drop policy if exists "mod_warnings_all" on public.user_moderation_warnings;
create policy "mod_warnings_all" on public.user_moderation_warnings for all using (true) with check (true);

create table if not exists public.user_moderation_restrictions (
  id uuid primary key default gen_random_uuid(),
  subject_user_id text not null,
  types text[] not null default '{}',
  ends_at_ms bigint not null,
  date_label text,
  created_at timestamptz not null default now()
);

create index if not exists idx_mod_restrict_subject on public.user_moderation_restrictions (subject_user_id, ends_at_ms desc);

alter table public.user_moderation_restrictions enable row level security;
drop policy if exists "mod_restrictions_all" on public.user_moderation_restrictions;
create policy "mod_restrictions_all" on public.user_moderation_restrictions for all using (true) with check (true);

-- ── 11) Welcome back / 제한 해제 UI ack ─────────────────────
create table if not exists public.user_welcome_back_acks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  ends_at_ms bigint not null,
  acknowledged_at timestamptz not null default now(),
  primary key (user_id, ends_at_ms)
);

alter table public.user_welcome_back_acks enable row level security;
drop policy if exists "welcome_ack_own" on public.user_welcome_back_acks;
create policy "welcome_ack_select_own" on public.user_welcome_back_acks for select using (auth.uid() = user_id);
create policy "welcome_ack_insert_own" on public.user_welcome_back_acks for insert with check (auth.uid() = user_id);

-- 제한 해제 푸시 중복 방지 (사용자·종료시각)
create table if not exists public.restriction_lift_push_sent (
  user_id uuid not null references public.profiles(id) on delete cascade,
  ends_at_ms bigint not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, ends_at_ms)
);

alter table public.restriction_lift_push_sent enable row level security;
drop policy if exists "lift_push_sent_own" on public.restriction_lift_push_sent;
create policy "lift_push_sent_select_own" on public.restriction_lift_push_sent for select using (auth.uid() = user_id);
create policy "lift_push_sent_insert_own" on public.restriction_lift_push_sent for insert with check (auth.uid() = user_id);

-- ── 12) 관리자 UI용 JSON blob (mock 유저/매치업 목록 덮어쓰기) ─
create table if not exists public.admin_ui_config (
  key text primary key,
  value jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.admin_ui_config enable row level security;
drop policy if exists "admin_ui_config_all" on public.admin_ui_config;
create policy "admin_ui_config_all" on public.admin_ui_config for all using (true) with check (true);

-- ── 13) 문의: 본인 삭제 (로컬 백업 제거 후 목록 정리용) ─────
drop policy if exists "inquiries_user_delete" on public.inquiries;
create policy "inquiries_user_delete" on public.inquiries for delete using (auth.uid() = user_id);
