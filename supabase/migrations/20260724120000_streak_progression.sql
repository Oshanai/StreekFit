-- Phase 5 (TZ §6): streak day status + progression counters.

-- How the day closed: 'full' = 3 push-up sets + 3 squat sets + steps goal,
-- 'light' = steps goal only (легкий день), 'none' = not closed.
alter table public.daily_scores
  add column if not exists status text not null default 'none'
    check (status in ('none', 'light', 'full'));

-- Progression state (TZ §6.3): targets grow +1 after 3 consecutive FULL days;
-- every 4th increase is a deload (-15%, floor 5) for sustainability.
alter table public.user_targets
  add column if not exists full_days_count integer not null default 0 check (full_days_count >= 0),
  add column if not exists increases_count integer not null default 0 check (increases_count >= 0);
