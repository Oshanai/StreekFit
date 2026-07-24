-- Phase 6 (TZ §7): city/friends leaderboards + friend lookup by code.
-- Points = sum of daily_scores.score for the current ISO week (UTC).
-- City boards are PRECOMPUTED into leaderboard_snapshots and refreshed at
-- most every 15 minutes (TZ §12.1: never live-sort everyone per request);
-- friends boards are live — the member set is tiny.

-- ------------------------------------------------------------ city (snapshot)
create or replace function public.city_leaderboard(target_city text, top_n int default 50)
returns table (
  rank int,
  points int,
  user_id uuid,
  name text,
  avatar_url text,
  frame_id text,
  is_me boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  fresh_exists boolean;
  me uuid := auth.uid();
begin
  if target_city is null or length(trim(target_city)) = 0 then
    return;
  end if;

  select exists (
    select 1
    from leaderboard_snapshots s
    where s.scope = 'city'
      and s.scope_key = target_city
      and s.snapshot_at > now() - interval '15 minutes'
    limit 1
  ) into fresh_exists;

  if not fresh_exists then
    delete from leaderboard_snapshots s
    where s.scope = 'city' and s.scope_key = target_city;

    insert into leaderboard_snapshots (scope, scope_key, user_id, rank, points, snapshot_at)
    select 'city', target_city, w.user_id,
           rank() over (order by w.points desc, w.user_id),
           w.points, now()
    from (
      select d.user_id, sum(d.score)::int as points
      from daily_scores d
      join profiles p on p.id = d.user_id
      where p.city = target_city
        and d.date >= (date_trunc('week', now() at time zone 'utc'))::date
        and d.score > 0
      group by d.user_id
    ) w;
  end if;

  return query
  (
    select s.rank::int, s.points::int, s.user_id, p.name, p.avatar_url, p.frame_id,
           (me is not null and s.user_id = me)
    from leaderboard_snapshots s
    join profiles p on p.id = s.user_id
    where s.scope = 'city' and s.scope_key = target_city
    order by s.rank
    limit top_n
  )
  union all
  (
    select s.rank::int, s.points::int, s.user_id, p.name, p.avatar_url, p.frame_id, true
    from leaderboard_snapshots s
    join profiles p on p.id = s.user_id
    where s.scope = 'city' and s.scope_key = target_city
      and me is not null and s.user_id = me and s.rank > top_n
  );
end;
$$;

-- ------------------------------------------------------------ friends (live)
create or replace function public.friends_leaderboard()
returns table (
  rank int,
  points int,
  user_id uuid,
  name text,
  avatar_url text,
  frame_id text,
  is_me boolean
)
language sql
security definer
set search_path = public
stable
as $$
  with my_friends as (
    select case when f.user_id = auth.uid() then f.friend_id else f.user_id end as fid
    from friendships f
    where f.status = 'accepted'
      and auth.uid() in (f.user_id, f.friend_id)
  ),
  members as (
    select fid from my_friends
    union
    select auth.uid() as fid
  ),
  weekly as (
    select d.user_id, sum(d.score)::int as points
    from daily_scores d
    where d.user_id in (select fid from members)
      and d.date >= (date_trunc('week', now() at time zone 'utc'))::date
    group by d.user_id
  )
  select
    (rank() over (order by coalesce(w.points, 0) desc, m.fid))::int,
    coalesce(w.points, 0),
    m.fid,
    p.name,
    p.avatar_url,
    p.frame_id,
    (m.fid = auth.uid())
  from members m
  join profiles p on p.id = m.fid
  left join weekly w on w.user_id = m.fid
  order by 1;
$$;

-- ------------------------------------------------------------ friend code
-- The friend code is simply the first 8 chars of the profile uuid.
create or replace function public.find_profile_by_code(code text)
returns table (user_id uuid, name text, city text, avatar_url text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.name, p.city, p.avatar_url
  from profiles p
  where length(trim(code)) >= 6
    and lower(p.id::text) like lower(trim(code)) || '%'
    and p.id <> auth.uid()
  limit 5;
$$;

-- Leaderboards are for signed-in users only.
revoke execute on function public.city_leaderboard(text, int) from anon;
revoke execute on function public.friends_leaderboard() from anon;
revoke execute on function public.find_profile_by_code(text) from anon;
