-- Streek Fit — initial schema (Phase 1, TZ §2.1)
-- Principles: RLS on EVERY table from day one; session aggregates only
-- (never per-rep rows); leaderboards are precomputed snapshots.

-- ============================================================ enums

create type public.movement_type as enum ('pushups', 'squats', 'steps', 'run');
create type public.friendship_status as enum ('pending', 'accepted', 'blocked');
create type public.leaderboard_scope as enum ('city', 'friends');
create type public.subscription_status as enum ('active', 'grace', 'expired', 'none');

-- ============================================================ profiles

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  age smallint check (age between 5 and 120),
  gender text check (gender in ('male', 'female', 'other')),
  country text,
  city text,
  avatar_url text,
  frame_id text,
  -- exactly the 3 featured achievement slots from the TZ
  featured_achievements uuid[] not null default '{}'::uuid[]
    check (cardinality(featured_achievements) <= 3),
  base_level smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_city_idx on public.profiles (city);

alter table public.profiles enable row level security;

-- visible to signed-in users (leaderboards, friend profiles)
create policy "profiles are readable by authenticated"
  on public.profiles for select to authenticated using (true);

create policy "users insert own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "users update own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================ user_targets

create table public.user_targets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  pushup_target smallint not null default 5 check (pushup_target between 1 and 500),
  squat_target smallint not null default 5 check (squat_target between 1 and 500),
  steps_target integer not null default 7000 check (steps_target between 1000 and 100000),
  updated_at timestamptz not null default now()
);

alter table public.user_targets enable row level security;

create policy "users manage own targets"
  on public.user_targets for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ============================================================ sessions
-- One row per finished SET/session — never per rep.

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.movement_type not null,
  valid_reps integer check (valid_reps >= 0),
  minutes numeric(6, 2) check (minutes >= 0),
  distance_m integer check (distance_m >= 0),
  sets_done smallint not null default 1,
  verified boolean not null default false,
  -- client-side timestamp: offline sessions sync later
  performed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index sessions_user_date_idx on public.sessions (user_id, performed_at desc);

alter table public.sessions enable row level security;

create policy "users manage own sessions"
  on public.sessions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ============================================================ daily_scores
-- Aggregate per day: single score number + streak counter.

create table public.daily_scores (
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  score integer not null default 0 check (score >= 0),
  streak_count integer not null default 0 check (streak_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

create index daily_scores_date_idx on public.daily_scores (date);

alter table public.daily_scores enable row level security;

create policy "daily scores readable by authenticated"
  on public.daily_scores for select to authenticated using (true);

create policy "users write own daily scores"
  on public.daily_scores for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users update own daily scores"
  on public.daily_scores for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ============================================================ achievements

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                 -- e.g. 'volume_pushups'
  tier smallint not null check (tier between 1 and 5),  -- bronze..legend
  category text not null check (category in ('volume', 'single', 'streak', 'rank', 'seasonal')),
  threshold integer not null,
  sort smallint not null default 0
);

alter table public.achievements enable row level security;

create policy "achievements readable by authenticated"
  on public.achievements for select to authenticated using (true);
-- no client writes: seeded/managed via service role only

create table public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table public.user_achievements enable row level security;

-- badges are public bragging rights inside the app
create policy "user achievements readable by authenticated"
  on public.user_achievements for select to authenticated using (true);
-- unlocks are granted server-side (edge function / service role), not by clients

-- ============================================================ friendships

create table public.friendships (
  user_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create index friendships_friend_idx on public.friendships (friend_id);

alter table public.friendships enable row level security;

create policy "users see friendships they are part of"
  on public.friendships for select to authenticated
  using ((select auth.uid()) in (user_id, friend_id));

create policy "users create own friend requests"
  on public.friendships for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "participants update friendship"
  on public.friendships for update to authenticated
  using ((select auth.uid()) in (user_id, friend_id))
  with check ((select auth.uid()) in (user_id, friend_id));

create policy "users delete friendships they are part of"
  on public.friendships for delete to authenticated
  using ((select auth.uid()) in (user_id, friend_id));

-- ============================================================ leaderboard_snapshots
-- Precomputed by cron/edge function — never live-sorted per request.

create table public.leaderboard_snapshots (
  id bigint generated always as identity primary key,
  scope public.leaderboard_scope not null,
  scope_key text not null,                   -- city name or owner user_id
  user_id uuid not null references public.profiles (id) on delete cascade,
  rank integer not null check (rank > 0),
  points integer not null default 0,
  snapshot_at timestamptz not null default now()
);

create index leaderboard_lookup_idx
  on public.leaderboard_snapshots (scope, scope_key, snapshot_at desc, rank);

alter table public.leaderboard_snapshots enable row level security;

create policy "leaderboards readable by authenticated"
  on public.leaderboard_snapshots for select to authenticated using (true);
-- written only by service role / edge functions

-- ============================================================ subscriptions

create table public.subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  status public.subscription_status not null default 'none',
  plan text,                                 -- monthly / season / yearly
  source text,                               -- revenuecat / kaspi_web / other
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "users read own subscription"
  on public.subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);
-- written only by RevenueCat webhook via service role

-- ============================================================ updated_at helper

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger user_targets_updated_at before update on public.user_targets
  for each row execute function public.set_updated_at();
create trigger daily_scores_updated_at before update on public.daily_scores
  for each row execute function public.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();
