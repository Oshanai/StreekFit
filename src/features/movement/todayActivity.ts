/**
 * Today's strength volume: synced sessions from Supabase merged with the
 * still-pending offline queue (rows leave the queue on sync, and ids are
 * client-generated — so a set counted twice is impossible).
 */

import { supabase } from '@/lib/supabase/client';

import { readQueue } from './sessionQueue';

export type TodayActivity = {
  pushupReps: number;
  squatReps: number;
  pushupSets: number;
  squatSets: number;
  runMinutes: number;
};

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function fetchTodayActivity(): Promise<TodayActivity> {
  const totals: TodayActivity = {
    pushupReps: 0,
    squatReps: 0,
    pushupSets: 0,
    squatSets: 0,
    runMinutes: 0,
  };
  const seenIds = new Set<string>();
  const since = startOfTodayIso();

  try {
    const { data } = await supabase
      .from('sessions')
      .select('id, type, valid_reps, sets_done, minutes')
      .gte('performed_at', since);
    for (const row of data ?? []) {
      seenIds.add(row.id as string);
      const reps = (row.valid_reps as number | null) ?? 0;
      const sets = (row.sets_done as number | null) ?? 0;
      if (row.type === 'pushups') {
        totals.pushupReps += reps;
        totals.pushupSets += sets;
      }
      if (row.type === 'squats') {
        totals.squatReps += reps;
        totals.squatSets += sets;
      }
      if (row.type === 'run') totals.runMinutes += Number(row.minutes ?? 0);
    }
  } catch {
    // Offline — the queue below still carries today's local sessions.
  }

  const queued = await readQueue();
  for (const row of queued) {
    if (seenIds.has(row.id)) continue;
    if (row.performedAt < since) continue;
    const reps = row.validReps ?? 0;
    if (row.type === 'pushups') {
      totals.pushupReps += reps;
      totals.pushupSets += row.setsDone;
    }
    if (row.type === 'squats') {
      totals.squatReps += reps;
      totals.squatSets += row.setsDone;
    }
    if (row.type === 'run') totals.runMinutes += row.minutes ?? 0;
  }

  return totals;
}
