-- 기존 DB에 적용: 카테고리 도움말에 요약·단계·바로가기·일러스트 (FAQ 상세와 동일 구조)
alter table public.inquiry_category_help add column if not exists answer text not null default '';
alter table public.inquiry_category_help add column if not exists steps jsonb not null default '[]'::jsonb;
alter table public.inquiry_category_help add column if not exists actions jsonb not null default '[]'::jsonb;
alter table public.inquiry_category_help add column if not exists illustration text;

-- 예전 한 덩어리 본문(body)만 있던 행 → 요약(answer)으로 옮기고, 단계가 비었을 때만
update public.inquiry_category_help
set answer = body,
    body = ''
where trim(coalesce(answer, '')) = ''
  and trim(coalesce(body, '')) != ''
  and coalesce(steps, '[]'::jsonb) = '[]'::jsonb;
