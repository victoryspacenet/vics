-- 문의하기 — 카테고리별 도움말 상단 탭(슬러그·표시명·순서)
-- 기존 DB: inquiry_category_help 의 category_slug 체크 제거 후 적용 (아래 DO 블록)

create table if not exists public.inquiry_help_categories (
  slug       text primary key
    check (slug ~ '^[a-z0-9][a-z0-9-]*$' and char_length(slug) <= 64),
  label      text not null
    check (char_length(trim(label)) > 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inquiry_help_categories_sort
  on public.inquiry_help_categories (sort_order);

create or replace function public.update_inquiry_help_categories_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_inquiry_help_categories_updated_at on public.inquiry_help_categories;
create trigger trg_inquiry_help_categories_updated_at
  before update on public.inquiry_help_categories
  for each row execute function public.update_inquiry_help_categories_updated_at();

alter table public.inquiry_help_categories enable row level security;

drop policy if exists "inquiry_help_categories_select" on public.inquiry_help_categories;
create policy "inquiry_help_categories_select" on public.inquiry_help_categories
  for select using (true);

drop policy if exists "inquiry_help_categories_insert" on public.inquiry_help_categories;
create policy "inquiry_help_categories_insert" on public.inquiry_help_categories
  for insert with check (auth.uid() is not null);

drop policy if exists "inquiry_help_categories_update" on public.inquiry_help_categories;
create policy "inquiry_help_categories_update" on public.inquiry_help_categories
  for update using (auth.uid() is not null);

drop policy if exists "inquiry_help_categories_delete" on public.inquiry_help_categories;
create policy "inquiry_help_categories_delete" on public.inquiry_help_categories
  for delete using (auth.uid() is not null);

insert into public.inquiry_help_categories (slug, label, sort_order)
select v.slug, v.label, v.sort_order
from (values
  ('matchup', '매치업', 0),
  ('account', '계정', 1),
  ('report', '신고', 2)
) as v(slug, label, sort_order)
where not exists (select 1 from public.inquiry_help_categories where inquiry_help_categories.slug = v.slug);

-- 기존 inquiry_category_help 의 category_slug enum 체크 제거 (신규 설치 create 문에 없으면 생략됨)
alter table public.inquiry_category_help
  drop constraint if exists inquiry_category_help_category_slug_check;
