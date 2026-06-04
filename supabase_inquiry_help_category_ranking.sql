-- 문의하기 — 「랭킹」 카테고리 + 시즌제 FAQ 도움말 slug 정리
-- (faqData FAQ id 7 ↔ category_slug `ranking` 연동)

insert into public.inquiry_help_categories (slug, label, sort_order)
select 'ranking', '랭킹', 3
where not exists (
  select 1 from public.inquiry_help_categories where slug = 'ranking'
);

-- 잘못 matchup 으로 들어간 동일 제목 행이 있으면 ranking 으로 이동
update public.inquiry_category_help
set category_slug = 'ranking'
where trim(title) = '시즌제 랭킹이 무엇인가요?'
  and category_slug is distinct from 'ranking';
