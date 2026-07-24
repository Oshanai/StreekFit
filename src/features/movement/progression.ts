/**
 * Progressive load (TZ §6.3): targets grow gently, recovery is scheduled.
 *
 * - Every 3rd consecutive FULL day earns a target change.
 * - Changes 1..3 are increases (+1 to both exercises).
 * - Every 4th change is a DELOAD: −15% (rounded, floor 5) — a built-in wave
 *   so the athlete never rides the ceiling for weeks (§0: долгосрочная
 *   адаптация через постоянство И отдых).
 *
 * Pure decision function — the caller persists the result.
 */

import type { DayRecord } from './streak';

export type ProgressionState = {
  pushupTarget: number;
  squatTarget: number;
  /** Total target changes applied so far (from user_targets.increases_count). */
  increasesCount: number;
};

export type ProgressionDecision =
  | { type: 'none' }
  | { type: 'increase'; pushupTarget: number; squatTarget: number; increasesCount: number }
  | { type: 'deload'; pushupTarget: number; squatTarget: number; increasesCount: number };

export const TARGET_MAX = 500;
export const TARGET_MIN = 5;
/** Consecutive full days per change. */
export const FULL_DAYS_PER_CHANGE = 3;
/** Every Nth change is a deload instead of an increase. */
export const DELOAD_EVERY = 4;
export const DELOAD_FACTOR = 0.85;

/**
 * Decide what happens after a day closes FULL with `fullRun` consecutive
 * full days ending today. Fires only on exact multiples of the cadence, so
 * one decision per 3-day block.
 */
export function progressionDecision(
  state: ProgressionState,
  fullRun: number,
): ProgressionDecision {
  if (fullRun < FULL_DAYS_PER_CHANGE || fullRun % FULL_DAYS_PER_CHANGE !== 0) {
    return { type: 'none' };
  }

  const changeNumber = state.increasesCount + 1;
  if (changeNumber % DELOAD_EVERY === 0) {
    return {
      type: 'deload',
      pushupTarget: Math.max(TARGET_MIN, Math.round(state.pushupTarget * DELOAD_FACTOR)),
      squatTarget: Math.max(TARGET_MIN, Math.round(state.squatTarget * DELOAD_FACTOR)),
      increasesCount: changeNumber,
    };
  }
  return {
    type: 'increase',
    pushupTarget: Math.min(TARGET_MAX, state.pushupTarget + 1),
    squatTarget: Math.min(TARGET_MAX, state.squatTarget + 1),
    increasesCount: changeNumber,
  };
}

/**
 * Consecutive CALENDAR full days ending at `todayDate` (a rest day between
 * full days ends the run — «подряд» means every single day). Records may
 * arrive in any order with gaps; missing dates count as not-full.
 */
export function consecutiveFullDays(records: readonly DayRecord[], todayDate: string): number {
  const byDate = new Map<string, DayRecord>();
  for (const r of records) byDate.set(r.date, r);

  let run = 0;
  let cursor = todayDate;
  for (;;) {
    const rec = byDate.get(cursor);
    if (rec == null || rec.status !== 'full') break;
    run += 1;
    // step one calendar day back from `cursor`
    const [y, m, d] = cursor.split('-').map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d - 1));
    cursor = prev.toISOString().slice(0, 10);
  }
  return run;
}
