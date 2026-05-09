-- =============================================
-- VICS — V-Card 스토리「축하하기」집계
-- =============================================
-- 카드 주인(owner)당 시청자(clapper) 1회만 기록됩니다.
-- Supabase SQL Editor에서 실행하세요.

create table if not exists public.vcard_story_claps (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  clapper_user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint vcard_story_claps_owner_clapper_unique unique (owner_user_id, clapper_user_id),
  constraint vcard_story_claps_no_self_clap check (owner_user_id <> clapper_user_id)
);

create index if not exists vcard_story_claps_owner_idx on public.vcard_story_claps (owner_user_id);

alter table public.vcard_story_claps enable row level security;

-- 직접 SELECT 금지 (행 노출 최소화). 집계는 아래 RPC만 사용합니다.
drop policy if exists vcard_story_claps_select_deny on public.vcard_story_claps;
create policy vcard_story_claps_select_deny on public.vcard_story_claps for select to authenticated using (false);

drop policy if exists vcard_story_claps_select_deny_anon on public.vcard_story_claps;
create policy vcard_story_claps_select_deny_anon on public.vcard_story_claps for select to anon using (false);

drop policy if exists vcard_story_claps_insert_clapper on public.vcard_story_claps;
create policy vcard_story_claps_insert_clapper on public.vcard_story_claps for insert to authenticated
  with check (
    auth.uid() = clapper_user_id
    and auth.uid() <> owner_user_id
  );

grant insert on public.vcard_story_claps to authenticated;

-- 집계: 총 축하 수 + 현재 로그인 시청자의 축하 여부 (비로그인 시 has_clapped = false)
create or replace function public.vcard_clap_stats (p_owner uuid)
returns table (total_claps bigint, viewer_has_clapped boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::bigint from public.vcard_story_claps c where c.owner_user_id = p_owner),
    coalesce(
      (
        select exists (
          select 1
          from public.vcard_story_claps c
          where c.owner_user_id = p_owner
            and c.clapper_user_id = auth.uid()
        )
      ),
      false
    );
$$;

revoke all on function public.vcard_clap_stats (uuid) from public;
grant execute on function public.vcard_clap_stats (uuid) to anon, authenticated;
