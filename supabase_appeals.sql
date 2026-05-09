-- =============================================
-- VICS Platform — 이의 신청(appeals) 테이블
-- =============================================
-- Supabase SQL Editor 또는 마이그레이션으로 실행하세요.

-- ── 이의 신청 메인 테이블 ─────────────────────────
create table if not exists public.appeals (
  id                  uuid default uuid_generate_v4() primary key,
  receipt_id          text unique not null,
  status              text not null default 'pending'
                        check (status in ('pending', 'completed')),

  -- 신청자 정보
  nickname            text not null,
  user_id             text not null,

  -- 제재 원인
  sanction_type       text,
  sanction_type_label text,
  sanction_date       text,
  violation_reason    text,
  original_content    text,
  original_type       text,

  -- 소명 내용
  appeal_title        text,
  appeal_content      text,
  attachments         jsonb not null default '[]',

  -- 검토 결과 (관리자 처리 후 채워짐)
  decision            text check (decision in ('reject', 'approve', 'mitigate')),
  reply_to_user       text,
  reduced_days        text,
  sanction_end_at     timestamptz,
  notified_at         timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- updated_at 자동 갱신 (notices와 동일 함수 재사용)
drop trigger if exists appeals_set_updated_at on public.appeals;
create trigger appeals_set_updated_at
  before update on public.appeals
  for each row execute procedure public.set_updated_at();

-- ── 추가 이의제기(팔로업) 테이블 ──────────────────
create table if not exists public.appeal_follow_ups (
  id          uuid default uuid_generate_v4() primary key,
  receipt_id  text not null,
  content     text not null,
  role        text not null default 'user',
  created_at  timestamptz not null default now()
);

-- ── RLS ───────────────────────────────────────────
alter table public.appeals enable row level security;
alter table public.appeal_follow_ups enable row level security;

-- appeals: 누구나 읽기, 인증된 사용자 쓰기
create policy "appeals_select_public"
  on public.appeals for select using (true);

create policy "appeals_insert_auth"
  on public.appeals for insert
  with check (auth.role() = 'authenticated');

create policy "appeals_update_auth"
  on public.appeals for update
  using (auth.role() = 'authenticated');

-- appeal_follow_ups: 누구나 읽기, 인증된 사용자 쓰기/삭제
create policy "follow_ups_select_public"
  on public.appeal_follow_ups for select using (true);

create policy "follow_ups_insert_auth"
  on public.appeal_follow_ups for insert
  with check (auth.role() = 'authenticated');

create policy "follow_ups_delete_auth"
  on public.appeal_follow_ups for delete
  using (auth.role() = 'authenticated');

-- ── 인덱스 ────────────────────────────────────────
create index if not exists appeals_receipt_id_idx   on public.appeals (receipt_id);
create index if not exists appeals_status_idx        on public.appeals (status);
create index if not exists appeals_created_at_idx    on public.appeals (created_at desc);
create index if not exists follow_ups_receipt_id_idx on public.appeal_follow_ups (receipt_id);
