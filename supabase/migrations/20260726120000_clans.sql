-- Phase 15 (TZ §16): clans — team competition on day scores.
-- One clan per user. Writes go through security-definer RPCs; direct table
-- access is read-only (search/browse). Cheers are preset phrases only (no
-- free text ⇒ no moderation surface before the App Store UGC plumbing).

-- ------------------------------------------------------------ tables
create table public.clans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 3 and 24),
  emblem text not null default 'flame'
    check (emblem in ('flame', 'bolt', 'mountain', 'wolf', 'star', 'crown')),
  join_code text not null unique default substr(md5(random()::text), 1, 6),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.clan_members (
  -- PK on user_id = "one clan per person" enforced by the schema itself.
  user_id uuid primary key references public.profiles (id) on delete cascade,
  clan_id uuid not null references public.clans (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now()
);

create index clan_members_clan_idx on public.clan_members (clan_id);

create table public.clan_cheers (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  phrase text not null
    check (phrase in ('go', 'fire', 'strong', 'beat', 'welcome', 'proud')),
  created_at timestamptz not null default now()
);

create index clan_cheers_clan_idx on public.clan_cheers (clan_id, created_at desc);

-- ------------------------------------------------------------ RLS
alter table public.clans enable row level security;
alter table public.clan_members enable row level security;
alter table public.clan_cheers enable row level security;

-- Clans and their member lists are browsable by any signed-in user
-- (search / "look before you join", same as the reference apps).
create policy clans_select on public.clans
  for select to authenticated using (true);

create policy clan_members_select on public.clan_members
  for select to authenticated using (true);

-- Cheers stay inside the clan: only members read, only members write as themselves.
create policy clan_cheers_select on public.clan_cheers
  for select to authenticated using (
    exists (
      select 1 from public.clan_members m
      where m.user_id = auth.uid() and m.clan_id = clan_cheers.clan_id
    )
  );

create policy clan_cheers_insert on public.clan_cheers
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.clan_members m
      where m.user_id = auth.uid() and m.clan_id = clan_cheers.clan_id
    )
  );

-- ------------------------------------------------------------ membership RPCs
create or replace function public.create_clan(clan_name text, clan_emblem text default 'flame')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  new_id uuid;
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  if exists (select 1 from clan_members where user_id = me) then
    raise exception 'already in a clan';
  end if;

  insert into clans (name, emblem, created_by)
  values (trim(clan_name), clan_emblem, me)
  returning id into new_id;

  insert into clan_members (user_id, clan_id, role) values (me, new_id, 'owner');
  return new_id;
end;
$$;

create or replace function public.join_clan(target_clan uuid default null, code text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  target uuid := target_clan;
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  if exists (select 1 from clan_members where user_id = me) then
    raise exception 'already in a clan';
  end if;
  if target is null and code is not null then
    select c.id into target from clans c where c.join_code = lower(trim(code));
  end if;
  if target is null then
    raise exception 'clan not found';
  end if;

  insert into clan_members (user_id, clan_id, role) values (me, target, 'member');
  return target;
end;
$$;

create or replace function public.leave_clan()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  my_clan uuid;
  my_role text;
  next_owner uuid;
begin
  select clan_id, role into my_clan, my_role from clan_members where user_id = me;
  if my_clan is null then
    return;
  end if;

  delete from clan_members where user_id = me;

  if my_role = 'owner' then
    -- Hand the clan to the longest-standing member; empty clan dissolves.
    select m.user_id into next_owner
    from clan_members m
    where m.clan_id = my_clan
    order by m.joined_at
    limit 1;

    if next_owner is null then
      delete from clans where id = my_clan;
    else
      update clan_members set role = 'owner' where user_id = next_owner;
    end if;
  end if;
end;
$$;

-- ------------------------------------------------------------ read RPCs
-- Search doubles as the clan rating: empty query = top clans by 14-day points.
create or replace function public.clan_search(query text default '')
returns table (
  clan_id uuid,
  name text,
  emblem text,
  member_count int,
  points_14d int
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id,
    c.name,
    c.emblem,
    (select count(*) from clan_members m where m.clan_id = c.id)::int,
    coalesce((
      select sum(d.score)
      from clan_members m
      join daily_scores d on d.user_id = m.user_id
      where m.clan_id = c.id
        and d.date >= (current_date - interval '14 days')::date
    ), 0)::int
  from clans c
  where query is null
     or length(trim(query)) = 0
     or c.name ilike '%' || trim(query) || '%'
  order by 5 desc, 4 desc
  limit 50;
$$;

create or replace function public.clan_totals(target_clan uuid)
returns table (
  all_time int,
  last_14d int,
  member_count int
)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(sum(d.score), 0)::int,
    coalesce(sum(d.score) filter (where d.date >= (current_date - interval '14 days')::date), 0)::int,
    (select count(*) from clan_members m where m.clan_id = target_clan)::int
  from clan_members m
  join daily_scores d on d.user_id = m.user_id
  where m.clan_id = target_clan;
$$;

create or replace function public.clan_members_board(target_clan uuid)
returns table (
  user_id uuid,
  name text,
  avatar_url text,
  role text,
  contribution_14d int,
  streak int
)
language sql
security definer
set search_path = public
stable
as $$
  select
    m.user_id,
    p.name,
    p.avatar_url,
    m.role,
    coalesce((
      select sum(d.score)
      from daily_scores d
      where d.user_id = m.user_id
        and d.date >= (current_date - interval '14 days')::date
    ), 0)::int,
    coalesce((
      select ds.streak_count
      from daily_scores ds
      where ds.user_id = m.user_id
      order by ds.date desc
      limit 1
    ), 0)::int
  from clan_members m
  join profiles p on p.id = m.user_id
  where m.clan_id = target_clan
  order by 5 desc, m.joined_at
  limit 100;
$$;

-- Signed-in users only.
revoke execute on function public.create_clan(text, text) from anon;
revoke execute on function public.join_clan(uuid, text) from anon;
revoke execute on function public.leave_clan() from anon;
revoke execute on function public.clan_search(text) from anon;
revoke execute on function public.clan_totals(uuid) from anon;
revoke execute on function public.clan_members_board(uuid) from anon;
