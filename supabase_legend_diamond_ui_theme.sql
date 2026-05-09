-- 다이아 팬덤 레전더리 UI — 전역 셸 테마 끄기(선택)
alter table public.profiles
  add column if not exists legend_diamond_theme_disabled boolean not null default false;

comment on column public.profiles.legend_diamond_theme_disabled is
  'true면 다이아 등급이어도 기본(라이트) 앱 셸 사용';
