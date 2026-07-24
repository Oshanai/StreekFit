/**
 * The day's heartbeat: fold today's activity into daily_scores (score,
 * status, streak) and apply target progression when a FULL day lands.
 * Called from the Today screen on focus/steps changes; all writes are
 * idempotent upserts keyed by (user_id, date) and skipped when unchanged.
 */

import { supabase } from '@/lib/supabase/client';

import { computeDayScore } from './dayScore';
import { consecutiveFullDays, progressionDecision, type ProgressionDecision } from './progression';
import { computeStreak, evaluateDay, type DayRecord, type DayStatus } from './streak';
import { fetchTodayActivity } from './todayActivity';

export type DailySyncResult = {
  score: number;
  status: DayStatus;
  streak: number;
  progression: ProgressionDecision;
  pushupSets: number;
  squatSets: number;
  pushupReps: number;
  squatReps: number;
  /** Achievement ids unlocked by this sync (server-validated). */
  newAchievements: string[];
};

export type DailySyncTargets = {
  pushup_target: number;
  squat_target: number;
  steps_target: number;
  full_days_count?: number;
  increases_count?: number;
};

function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

let lastWrite = { date: '', score: -1, status: '' as string, streak: -1 };

export async function syncToday(
  targets: DailySyncTargets,
  steps: number,
): Promise<DailySyncResult | null> {
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId) return null;

  const activity = await fetchTodayActivity();
  const today = todayDateString();

  const status = evaluateDay({
    pushupSets: activity.pushupSets,
    squatSets: activity.squatSets,
    steps,
    stepsTarget: targets.steps_target,
  });
  const score = computeDayScore({
    pushupReps: activity.pushupReps,
    squatReps: activity.squatReps,
    steps,
    runMinutes: 0,
  }).total;

  // Recent history for streak + progression (a month is plenty for both).
  const { data: historyRows } = await supabase
    .from('daily_scores')
    .select('date, status')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(31);
  const history: DayRecord[] = (historyRows ?? [])
    .filter((r) => r.date !== today)
    .map((r) => ({ date: r.date as string, status: r.status as DayStatus }));

  const records = [...history, { date: today, status }];
  const streak = computeStreak(records, today);

  let newAchievements: string[] = [];
  if (
    lastWrite.date !== today ||
    lastWrite.score !== score ||
    lastWrite.status !== status ||
    lastWrite.streak !== streak
  ) {
    const { error } = await supabase.from('daily_scores').upsert({
      user_id: userId,
      date: today,
      score,
      status,
      streak_count: streak,
      steps: Math.max(0, Math.round(steps)),
    });
    if (!error) {
      lastWrite = { date: today, score, status, streak };
      // Metrics moved — let the server hand out anything newly earned.
      const { data: unlocked } = await supabase.rpc('claim_achievements');
      newAchievements = ((unlocked ?? []) as { claim_achievements?: string }[] | string[]).map(
        (row) => (typeof row === 'string' ? row : String(Object.values(row)[0])),
      );
    }
  }

  // Progression fires only when today is FULL, once per calendar day
  // (user_targets.updated_at is the same-day guard).
  let progression: ProgressionDecision = { type: 'none' };
  if (status === 'full') {
    const { data: targetRow } = await supabase
      .from('user_targets')
      .select('pushup_target, squat_target, increases_count, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (targetRow != null) {
      const updatedToday = String(targetRow.updated_at ?? '').slice(0, 10) === today;
      const fullRun = consecutiveFullDays(records, today);
      if (!updatedToday) {
        progression = progressionDecision(
          {
            pushupTarget: targetRow.pushup_target as number,
            squatTarget: targetRow.squat_target as number,
            increasesCount: (targetRow.increases_count as number | null) ?? 0,
          },
          fullRun,
        );
        if (progression.type !== 'none') {
          await supabase
            .from('user_targets')
            .update({
              pushup_target: progression.pushupTarget,
              squat_target: progression.squatTarget,
              increases_count: progression.increasesCount,
            })
            .eq('user_id', userId);
        }
      }
    }
  }

  return {
    score,
    status,
    streak,
    progression,
    pushupSets: activity.pushupSets,
    squatSets: activity.squatSets,
    pushupReps: activity.pushupReps,
    squatReps: activity.squatReps,
    newAchievements,
  };
}
