-- Phase 7 (TZ §8): badge catalog (6 silhouettes × 5 tiers) + server-side
-- awarding. Clients can only READ achievements; unlocks are validated and
-- inserted by the claim RPC — thresholds can't be cheated from a device.

-- One code per silhouette, five tier rows each.
alter table public.achievements drop constraint if exists achievements_code_key;
create unique index if not exists achievements_code_tier_key
  on public.achievements (code, tier);

-- Metrics the catalog needs that aren't stored yet:
-- best single set within a session (за раз) and daily steps (объём шагов).
alter table public.sessions
  add column if not exists best_set integer check (best_set >= 0);
alter table public.daily_scores
  add column if not exists steps integer not null default 0 check (steps >= 0);

-- ------------------------------------------------------------ catalog seed
insert into public.achievements (code, tier, category, threshold, sort) values
  ('volume_pushups', 1, 'volume',   100, 1),
  ('volume_pushups', 2, 'volume',  1000, 1),
  ('volume_pushups', 3, 'volume',  5000, 1),
  ('volume_pushups', 4, 'volume', 10000, 1),
  ('volume_pushups', 5, 'volume', 25000, 1),
  ('volume_squats',  1, 'volume',   150, 2),
  ('volume_squats',  2, 'volume',  1500, 2),
  ('volume_squats',  3, 'volume',  7500, 2),
  ('volume_squats',  4, 'volume', 15000, 2),
  ('volume_squats',  5, 'volume', 30000, 2),
  ('single_pushups', 1, 'single',    20, 3),
  ('single_pushups', 2, 'single',    30, 3),
  ('single_pushups', 3, 'single',    50, 3),
  ('single_pushups', 4, 'single',    75, 3),
  ('single_pushups', 5, 'single',   100, 3),
  ('single_squats',  1, 'single',    25, 4),
  ('single_squats',  2, 'single',    40, 4),
  ('single_squats',  3, 'single',    60, 4),
  ('single_squats',  4, 'single',    85, 4),
  ('single_squats',  5, 'single',   120, 4),
  ('streak_days',    1, 'streak',     7, 5),
  ('streak_days',    2, 'streak',    30, 5),
  ('streak_days',    3, 'streak',    60, 5),
  ('streak_days',    4, 'streak',   100, 5),
  ('streak_days',    5, 'streak',   365, 5),
  ('volume_steps',   1, 'volume',    70000, 6),
  ('volume_steps',   2, 'volume',   350000, 6),
  ('volume_steps',   3, 'volume',  1000000, 6),
  ('volume_steps',   4, 'volume',  3000000, 6),
  ('volume_steps',   5, 'volume', 10000000, 6)
on conflict (code, tier) do nothing;

-- ------------------------------------------------------------ claim RPC
-- Recomputes the caller's lifetime metrics and unlocks every badge whose
-- threshold is met. Returns the NEWLY unlocked achievement ids.
create or replace function public.claim_achievements()
returns setof uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_pushups bigint;
  v_squats bigint;
  v_best_pushups int;
  v_best_squats int;
  v_best_streak int;
  v_steps bigint;
begin
  if me is null then
    return;
  end if;

  select coalesce(sum(valid_reps) filter (where type = 'pushups'), 0),
         coalesce(sum(valid_reps) filter (where type = 'squats'), 0),
         coalesce(max(best_set) filter (where type = 'pushups'), 0),
         coalesce(max(best_set) filter (where type = 'squats'), 0)
    into v_pushups, v_squats, v_best_pushups, v_best_squats
  from sessions where user_id = me;

  select coalesce(max(streak_count), 0), coalesce(sum(steps), 0)
    into v_best_streak, v_steps
  from daily_scores where user_id = me;

  return query
  insert into user_achievements (user_id, achievement_id)
  select me, a.id
  from achievements a
  where (a.code = 'volume_pushups' and v_pushups      >= a.threshold)
     or (a.code = 'volume_squats'  and v_squats       >= a.threshold)
     or (a.code = 'volume_steps'   and v_steps        >= a.threshold)
     or (a.code = 'single_pushups' and v_best_pushups >= a.threshold)
     or (a.code = 'single_squats'  and v_best_squats  >= a.threshold)
     or (a.code = 'streak_days'    and v_best_streak  >= a.threshold)
  on conflict (user_id, achievement_id) do nothing
  returning achievement_id;
end;
$$;

revoke execute on function public.claim_achievements() from anon;
