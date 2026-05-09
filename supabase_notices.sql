-- =============================================
-- VICS Platform — 공지사항(notices) 테이블
-- =============================================
-- Supabase SQL Editor 또는 마이그레이션으로 실행하세요.

create table if not exists public.notices (
  id            uuid default uuid_generate_v4() primary key,
  category      text not null default 'notice'
                  check (category in ('notice', 'event', 'update', 'winner')),
  title         text not null,
  content       text,
  summary       text,
  author        text not null default '관리자',
  is_banner     boolean not null default false,
  is_highlighted boolean not null default false,
  target_all    boolean not null default true,
  target_tier_id    text,
  target_tier_label text,
  target_tier_exact boolean not null default false,
  source        text not null default 'admin',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- updated_at 자동 갱신 트리거
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notices_set_updated_at on public.notices;
create trigger notices_set_updated_at
  before update on public.notices
  for each row execute procedure public.set_updated_at();

-- ── RLS ────────────────────────────────────────────
alter table public.notices enable row level security;

-- 누구나 읽기 가능 (티어 필터링은 클라이언트에서 처리)
create policy "notices_select_public"
  on public.notices for select
  using (true);

-- 인증된 사용자만 작성·수정·삭제 (관리자 여부는 프런트에서 추가 검증)
create policy "notices_insert_auth"
  on public.notices for insert
  with check (auth.role() = 'authenticated');

create policy "notices_update_auth"
  on public.notices for update
  using (auth.role() = 'authenticated');

create policy "notices_delete_auth"
  on public.notices for delete
  using (auth.role() = 'authenticated');

-- ── 인덱스 ──────────────────────────────────────────
create index if not exists notices_created_at_idx on public.notices (created_at desc);
create index if not exists notices_category_idx   on public.notices (category);
create index if not exists notices_is_banner_idx  on public.notices (is_banner);
