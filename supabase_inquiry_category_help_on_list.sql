-- 카테고리 도움말: 유저 노출(on_list=true) vs 관리자 풀(on_list=false, 추가 가능 영역)
alter table public.inquiry_category_help
  add column if not exists on_list boolean not null default true;

update public.inquiry_category_help set on_list = true where on_list is null;

create index if not exists idx_inquiry_category_help_slug_list_order
  on public.inquiry_category_help (category_slug, on_list, sort_order);
