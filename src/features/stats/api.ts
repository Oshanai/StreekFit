/**
 * Stats data access (TZ §17): weekly report with deltas + all-time analytics.
 * Everything aggregates client-side from daily_scores/sessions — history is
 * small (≤365 rows); server-side pre-aggregation comes with scale.
 */

import { supabase } from '@/lib/supabase/client';

import {
  addDays,
  bestDay,
  bestPeriod,
  groupByMonth,
  groupByWeek,
  localDateKey,
  mondayOf,
  parseDateKey,
  type DayRow,
  type PeriodTotals,
} from './period';

export type WeekTotals = {
  score: number;
  steps: number;
  pushups: number;
  squats: number;
  runKm: number;
  fullDays: number;
};

export type WeeklyReport = {
  /** Monday of the reported (previous) week. */
  weekStart: string;
  totals: WeekTotals;
  /** Против позапрошлой недели; null — сравнивать не с чем. */
  delta: WeekTotals | null;
};

const EMPTY_WEEK: WeekTotals = { score: 0, steps: 0, pushups: 0, squats: 0, runKm: 0, fullDays: 0 };

type SessionRow = {
  type: string;
  valid_reps: number | null;
  distance_m: number | null;
  performed_at: string;
};

function weekTotalsFor(
  weekStart: string,
  scores: { date: string; score: number; steps: number; status: string }[],
  sessions: SessionRow[],
): WeekTotals {
  const end = addDays(weekStart, 7);
  const totals = { ...EMPTY_WEEK };
  for (const r of scores) {
    if (r.date < weekStart || r.date >= end) continue;
    totals.score += r.score;
    totals.steps += r.steps;
    if (r.status === 'full') totals.fullDays += 1;
  }
  for (const s of sessions) {
    // Bucket by LOCAL day — an evening workout must not slip into UTC's next day.
    const day = localDateKey(new Date(s.performed_at));
    if (day < weekStart || day >= end) continue;
    if (s.type === 'pushups') totals.pushups += s.valid_reps ?? 0;
    if (s.type === 'squats') totals.squats += s.valid_reps ?? 0;
    if (s.type === 'run') totals.runKm += (s.distance_m ?? 0) / 1000;
  }
  totals.runKm = Math.round(totals.runKm * 10) / 10;
  return totals;
}

/**
 * Report for the week that just ended (previous Mon–Sun) with deltas against
 * the week before it. Null when the previous week has no activity at all.
 */
export async function fetchWeeklyReport(now = new Date()): Promise<WeeklyReport | null> {
  const { data: auth } = await supabase.auth.getSession();
  const me = auth.session?.user.id;
  if (!me) return null;

  const thisMonday = mondayOf(localDateKey(now));
  const lastMonday = addDays(thisMonday, -7);
  const prevMonday = addDays(thisMonday, -14);

  const [{ data: scoreRows }, { data: sessionRows }] = await Promise.all([
    supabase
      .from('daily_scores')
      .select('date, score, steps, status')
      .eq('user_id', me)
      .gte('date', prevMonday)
      .lt('date', thisMonday),
    supabase
      .from('sessions')
      .select('type, valid_reps, distance_m, performed_at')
      .eq('user_id', me)
      // ±1 day of slack for the UTC↔local shift; exact filter is local, above.
      .gte('performed_at', parseDateKey(addDays(prevMonday, -1)).toISOString())
      .lt('performed_at', parseDateKey(addDays(thisMonday, 1)).toISOString()),
  ]);

  const scores = (scoreRows ?? []).map((r) => ({
    date: r.date as string,
    score: (r.score as number | null) ?? 0,
    steps: (r.steps as number | null) ?? 0,
    status: (r.status as string | null) ?? 'none',
  }));
  const sessions = (sessionRows ?? []) as SessionRow[];

  const last = weekTotalsFor(lastMonday, scores, sessions);
  const prev = weekTotalsFor(prevMonday, scores, sessions);

  const lastHasData =
    last.score > 0 || last.steps > 0 || last.pushups > 0 || last.squats > 0 || last.runKm > 0;
  if (!lastHasData) return null;

  const prevHasData =
    prev.score > 0 || prev.steps > 0 || prev.pushups > 0 || prev.squats > 0 || prev.runKm > 0;

  return {
    weekStart: lastMonday,
    totals: last,
    delta: prevHasData
      ? {
          score: last.score - prev.score,
          steps: last.steps - prev.steps,
          pushups: last.pushups - prev.pushups,
          squats: last.squats - prev.squats,
          runKm: Math.round((last.runKm - prev.runKm) * 10) / 10,
          fullDays: last.fullDays - prev.fullDays,
        }
      : null,
  };
}

export type AllTimeStats = {
  totalScore: number;
  totalSteps: number;
  totalWorkouts: number;
  totalRunKm: number;
  best: {
    day: DayRow | null;
    week: PeriodTotals | null;
    month: PeriodTotals | null;
  };
  /** Ascending; capped for the bars. */
  weeks: PeriodTotals[];
  months: PeriodTotals[];
};

export async function fetchAllTimeStats(): Promise<AllTimeStats | null> {
  const { data: auth } = await supabase.auth.getSession();
  const me = auth.session?.user.id;
  if (!me) return null;

  const [{ data: scoreRows }, { data: sessionRows }] = await Promise.all([
    supabase
      .from('daily_scores')
      .select('date, score, steps')
      .eq('user_id', me)
      .order('date', { ascending: true })
      .limit(366),
    supabase
      .from('sessions')
      .select('type, distance_m')
      .eq('user_id', me)
      .in('type', ['pushups', 'squats', 'run'])
      .limit(2000),
  ]);

  const days: DayRow[] = (scoreRows ?? []).map((r) => ({
    date: r.date as string,
    score: (r.score as number | null) ?? 0,
    steps: (r.steps as number | null) ?? 0,
  }));

  let totalWorkouts = 0;
  let totalRunM = 0;
  for (const s of sessionRows ?? []) {
    if (s.type === 'run') totalRunM += (s.distance_m as number | null) ?? 0;
    else totalWorkouts += 1;
  }

  const weeks = groupByWeek(days);
  const months = groupByMonth(days);

  return {
    totalScore: days.reduce((sum, d) => sum + d.score, 0),
    totalSteps: days.reduce((sum, d) => sum + d.steps, 0),
    totalWorkouts,
    totalRunKm: Math.round(totalRunM / 100) / 10,
    best: { day: bestDay(days), week: bestPeriod(weeks), month: bestPeriod(months) },
    weeks: weeks.slice(-8),
    months: months.slice(-6),
  };
}
