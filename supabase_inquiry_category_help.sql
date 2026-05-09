-- 문의하기 — 카테고리별 도움말 (제목·본문 직접 등록, faqData와 독립)
create table if not exists public.inquiry_category_help (
  id              uuid primary key default gen_random_uuid(),
  category_slug   text not null,
  title           text not null,
  answer          text not null default '',
  steps           jsonb not null default '[]'::jsonb,
  actions         jsonb not null default '[]'::jsonb,
  illustration    text,
  body            text not null default '',
  on_list         boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_inquiry_category_help_slug_order
  on public.inquiry_category_help (category_slug, sort_order);

create index if not exists idx_inquiry_category_help_slug_list_order
  on public.inquiry_category_help (category_slug, on_list, sort_order);

create or replace function public.update_inquiry_category_help_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_inquiry_category_help_updated_at on public.inquiry_category_help;
create trigger trg_inquiry_category_help_updated_at
  before update on public.inquiry_category_help
  for each row execute function public.update_inquiry_category_help_updated_at();

alter table public.inquiry_category_help enable row level security;

drop policy if exists "inquiry_category_help_select" on public.inquiry_category_help;
create policy "inquiry_category_help_select" on public.inquiry_category_help
  for select using (true);

drop policy if exists "inquiry_category_help_insert" on public.inquiry_category_help;
create policy "inquiry_category_help_insert" on public.inquiry_category_help
  for insert with check (auth.uid() is not null);

drop policy if exists "inquiry_category_help_update" on public.inquiry_category_help;
create policy "inquiry_category_help_update" on public.inquiry_category_help
  for update using (auth.uid() is not null);

drop policy if exists "inquiry_category_help_delete" on public.inquiry_category_help;
create policy "inquiry_category_help_delete" on public.inquiry_category_help
  for delete using (auth.uid() is not null);

-- 기본 가상 도움말 5종 (faqData FAQ 1~5와 동일) — 동일 카테고리·제목이 없을 때만 삽입
insert into public.inquiry_category_help (
  category_slug, title, answer, steps, actions, illustration, body, on_list, sort_order
)
select
  v.category_slug,
  v.title,
  v.answer,
  v.steps::jsonb,
  v.actions::jsonb,
  nullif(trim(v.illustration), ''),
  coalesce(v.extra_body, ''),
  true,
  v.sort_order
from (values
  (
    'matchup',
    '승리 포인트는 언제 들어오나요?',
    '매치업 결과가 확정된 후 포인트가 지급됩니다.',
    '["매치업 결과가 확정되면 24시간 이내에 적중 시 포인트가 자동 지급됩니다.","마이페이지/랭킹페이지에서 내 포인트 현황을 확인할 수 있어요.","포인트는 시즌별로 집계되며, 시즌 종료 시 일부 리셋될 수 있습니다."]',
    '[{"text":"랭킹에서 포인트 확인하기","to":"/ranking"},{"text":"경쟁 참여하기","to":"/"}]',
    'points',
    '',
    0
  ),
  (
    'matchup',
    '투표는 어떻게 하나요?',
    '매치업 카드를 탭하고 선택지를 누르면 됩니다.',
    '["홈 또는 매치업 피드에서 원하는 매치업 카드를 탭합니다.","화면에 표시된 두 선택지 중 하나를 탭합니다.","투표가 완료되면 결과를 확인할 수 있어요."]',
    '[{"text":"경쟁 참여하기","to":"/"},{"text":"매치업 목록 보기","to":"/matchups"}]',
    'vote',
    '',
    1
  ),
  (
    'account',
    '닉네임 변경하고 싶어요!',
    '마이페이지에서 프로필을 수정할 수 있어요.',
    '["마이페이지로 이동합니다.","프로필 수정 버튼을 탭합니다.","닉네임을 변경하고 저장합니다.","변경 후 같은 시즌 동안 재변경이 제한됩니다. 한 시즌에 1회 변경 가능합니다."]',
    '[{"text":"프로필 수정하기","to":"/mypage/edit"},{"text":"마이페이지로 이동","to":"/mypage"}]',
    'profile',
    '',
    0
  ),
  (
    'account',
    '계정 삭제는 어떻게 하나요?',
    '마이페이지 설정에서 계정 삭제를 진행할 수 있어요.',
    '["마이페이지로 이동합니다.","프로필 수정 탭을 찾습니다.","회원탈퇴를 선택하고 안내에 따라 진행합니다.","삭제 시 모든 데이터가 영구 삭제되며 복구할 수 없습니다."]',
    '[{"text":"계정 삭제하기","to":"/mypage/delete"},{"text":"마이페이지로 이동","to":"/mypage"}]',
    'delete',
    '',
    1
  ),
  (
    'report',
    '주제와 상관없는 글 신고는 어디서?',
    '문의하기의 「1:1 문의하기」에서 카테고리 「신고」로 접수할 수 있어요.',
    '["문의하기 → 「1:1 문의하기」로 이동합니다.","카테고리에서 「신고」를 선택합니다.","신고 대상(매치업 링크·상황 설명 등)을 적고 제출하면 운영팀 검토 후 조치됩니다."]',
    '[{"text":"신고 접수하기 (1:1 문의)","to":"/inquiry/form?category=report"},{"text":"커뮤니티 가이드 보기","to":"/community-policy"}]',
    'report',
    '',
    0
  )
) as v(category_slug, title, answer, steps, actions, illustration, extra_body, sort_order)
where not exists (
  select 1
  from public.inquiry_category_help h
  where h.category_slug = v.category_slug
    and h.title = v.title
);
