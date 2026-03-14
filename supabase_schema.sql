-- =============================================
-- VICS Platform - Supabase Database Schema
-- =============================================

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- =============================================
-- 1. PROFILES (사용자 프로필)
-- =============================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  nickname text unique not null,
  email text,
  avatar_url text,
  birthdate date,
  gender text check (gender in ('male', 'female', 'other')),
  points integer default 0,
  total_matchups integer default 0,
  total_votes_received integer default 0,
  wins integer default 0,
  losses integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- 2. MATCHUPS (매치업)
-- =============================================
create table if not exists public.matchups (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,

  -- 좌측 콘텐츠
  left_type text check (left_type in ('image', 'video', 'text')) not null,
  left_url text,
  left_text text,
  left_thumbnail_url text,
  left_label text,

  -- 우측 콘텐츠
  right_type text check (right_type in ('image', 'video', 'text')),
  right_url text,
  right_text text,
  right_thumbnail_url text,
  right_label text,

  -- 투표 집계 (캐시)
  left_votes integer default 0,
  right_votes integer default 0,
  total_votes integer default 0,

  -- 상태
  status text default 'active' check (status in ('draft', 'active', 'closed')),
  is_complete boolean default false,
  winner text check (winner in ('left', 'right', 'draw')),

  -- 좋아요/댓글 수 캐시
  likes_count integer default 0,
  comments_count integer default 0,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- 3. VOTES (투표)
-- =============================================
create table if not exists public.votes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  matchup_id uuid references public.matchups(id) on delete cascade not null,
  side text check (side in ('left', 'right')) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, matchup_id)
);

-- =============================================
-- 4. COMMENTS (댓글)
-- =============================================
create table if not exists public.comments (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  matchup_id uuid references public.matchups(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- 5. LIKES (좋아요)
-- =============================================
create table if not exists public.likes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  matchup_id uuid references public.matchups(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, matchup_id)
);

-- =============================================
-- 6. NOTIFICATIONS (알림)
-- =============================================
create table if not exists public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in ('vote', 'comment', 'like', 'match_complete', 'ranking')),
  title text not null,
  body text,
  related_matchup_id uuid references public.matchups(id) on delete set null,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- =============================================
-- INDEXES (성능 최적화)
-- =============================================
create index if not exists matchups_user_id_idx on public.matchups(user_id);
create index if not exists matchups_created_at_idx on public.matchups(created_at desc);
create index if not exists matchups_total_votes_idx on public.matchups(total_votes desc);
create index if not exists matchups_status_idx on public.matchups(status);
create index if not exists votes_matchup_id_idx on public.votes(matchup_id);
create index if not exists votes_user_id_idx on public.votes(user_id);
create index if not exists comments_matchup_id_idx on public.comments(matchup_id);
create index if not exists likes_matchup_id_idx on public.likes(matchup_id);
create index if not exists profiles_points_idx on public.profiles(points desc);
create index if not exists notifications_user_id_idx on public.notifications(user_id);

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- 투표 시 matchup의 vote 카운트 업데이트
create or replace function update_matchup_votes()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update public.matchups
    set
      left_votes = case when new.side = 'left' then left_votes + 1 else left_votes end,
      right_votes = case when new.side = 'right' then right_votes + 1 else right_votes end,
      total_votes = total_votes + 1,
      updated_at = now()
    where id = new.matchup_id;

  elsif TG_OP = 'UPDATE' then
    -- 투표 변경 (left → right 또는 right → left)
    update public.matchups
    set
      left_votes = case
        when new.side = 'left' then left_votes + 1
        when old.side = 'left' then left_votes - 1
        else left_votes end,
      right_votes = case
        when new.side = 'right' then right_votes + 1
        when old.side = 'right' then right_votes - 1
        else right_votes end,
      updated_at = now()
    where id = new.matchup_id;

  elsif TG_OP = 'DELETE' then
    update public.matchups
    set
      left_votes = case when old.side = 'left' then left_votes - 1 else left_votes end,
      right_votes = case when old.side = 'right' then right_votes - 1 else right_votes end,
      total_votes = total_votes - 1,
      updated_at = now()
    where id = old.matchup_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

create or replace trigger on_vote_change
  after insert or update or delete on public.votes
  for each row execute function update_matchup_votes();

-- 댓글 수 업데이트
create or replace function update_comments_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update public.matchups set comments_count = comments_count + 1 where id = new.matchup_id;
  elsif TG_OP = 'DELETE' then
    update public.matchups set comments_count = comments_count - 1 where id = old.matchup_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

create or replace trigger on_comment_change
  after insert or delete on public.comments
  for each row execute function update_comments_count();

-- 좋아요 수 업데이트
create or replace function update_likes_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update public.matchups set likes_count = likes_count + 1 where id = new.matchup_id;
  elsif TG_OP = 'DELETE' then
    update public.matchups set likes_count = likes_count - 1 where id = old.matchup_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

create or replace trigger on_like_change
  after insert or delete on public.likes
  for each row execute function update_likes_count();

-- 신규 유저 프로필 자동 생성
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, nickname)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- updated_at 자동 갱신
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger update_profiles_updated_at before update on public.profiles
  for each row execute function update_updated_at_column();
create or replace trigger update_matchups_updated_at before update on public.matchups
  for each row execute function update_updated_at_column();
create or replace trigger update_votes_updated_at before update on public.votes
  for each row execute function update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
alter table public.profiles enable row level security;
alter table public.matchups enable row level security;
alter table public.votes enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.notifications enable row level security;

-- profiles RLS
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- matchups RLS
create policy "Matchups are viewable by everyone" on public.matchups for select using (true);
create policy "Authenticated users can create matchups" on public.matchups for insert with check (auth.uid() = user_id);
create policy "Users can update own matchups" on public.matchups for update using (auth.uid() = user_id);
create policy "Users can delete own matchups" on public.matchups for delete using (auth.uid() = user_id);

-- votes RLS
create policy "Votes are viewable by everyone" on public.votes for select using (true);
create policy "Authenticated users can vote" on public.votes for insert with check (auth.uid() = user_id);
create policy "Users can change own vote" on public.votes for update using (auth.uid() = user_id);
create policy "Users can delete own vote" on public.votes for delete using (auth.uid() = user_id);

-- comments RLS
create policy "Comments are viewable by everyone" on public.comments for select using (true);
create policy "Authenticated users can comment" on public.comments for insert with check (auth.uid() = user_id);
create policy "Users can delete own comments" on public.comments for delete using (auth.uid() = user_id);

-- likes RLS
create policy "Likes are viewable by everyone" on public.likes for select using (true);
create policy "Authenticated users can like" on public.likes for insert with check (auth.uid() = user_id);
create policy "Users can unlike" on public.likes for delete using (auth.uid() = user_id);

-- notifications RLS
create policy "Users can view own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "System can create notifications" on public.notifications for insert with check (true);
create policy "Users can mark own notifications read" on public.notifications for update using (auth.uid() = user_id);
