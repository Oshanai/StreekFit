/**
 * Streak rules (TZ §6.2), deliberately gentle (§0: комфорт, не насилие):
 *
 * - FULL day  = 3 push-up sets + 3 squat sets + the steps goal.
 * - LIGHT day = the steps goal alone keeps the chain alive («лёгкий день»).
 * - One rest day between closed days does NOT break the chain (recovery is
 *   part of the plan) — two consecutive empty days do.
 *
 * Pure date/status math over 'YYYY-MM-DD' strings; everything is testable.
 */

export type DayStatus = 'none' | 'light' | 'full';

export type DayInput = {
  pushupSets: number;
  squatSets: number;
  steps: number;
  stepsTarget: number;
};

export function evaluateDay(input: DayInput): DayStatus {
  if (input.steps < input.stepsTarget) return 'none';
  if (input.pushupSets >= 3 && input.squatSets >= 3) return 'full';
  return 'light';
}

export type DayRecord = { date: string; status: DayStatus };

/** Whole days between two 'YYYY-MM-DD' dates (b - a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/**
 * Current streak as of `todayDate`, given day records sorted ANY way
 * (deduped by date, today's record may be present or absent).
 *
 * The chain walks back from the most recent closed day, tolerating single-day
 * gaps between closed days. It is still "alive" (shown to the user) while
 * today could yet extend it — i.e. the last closed day is at most 2 days ago.
 */
export function computeStreak(records: DayRecord[], todayDate: string): number {
  const closed = records
    .filter((r) => r.status !== 'none' && daysBetween(r.date, todayDate) >= 0)
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
  if (closed.length === 0) return 0;

  const newest = closed[0];
  // Dead chain: the last closed day is too far back to save by closing today.
  if (daysBetween(newest.date, todayDate) > 2) return 0;

  let streak = 1;
  for (let i = 1; i < closed.length; i += 1) {
    const gap = daysBetween(closed[i].date, closed[i - 1].date);
    if (gap <= 2) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}
