-- 기존 notices 테이블에 티어 열람 방식 컬럼 추가 (한 번만 실행)
-- false: 대상 티어 이상 열람 | true: 해당 티어만 열람

alter table public.notices
  add column if not exists target_tier_exact boolean not null default false;

comment on column public.notices.target_tier_exact is
  '특정 티어 공지 시: false=해당 티어 이상, true=해당 티어만';
