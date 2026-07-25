/**
 * Run history data access: past run sessions with their stored polylines.
 */

import { supabase } from '@/lib/supabase/client';

export type RunRecord = {
  id: string;
  performedAt: string;
  minutes: number;
  distanceM: number;
  track: [number, number][] | null;
};

export type RunListItem = {
  id: string;
  performedAt: string;
  minutes: number;
  distanceM: number;
  hasTrack: boolean;
};

/**
 * List needs metadata only — full polylines (≤200 points each × 50 runs)
 * would dominate the payload. `track->1` (second point) is non-null exactly
 * when the polyline is drawable; the map screen fetches the full track by id.
 */
export async function fetchRunHistory(limit = 50): Promise<RunListItem[]> {
  const { data: auth } = await supabase.auth.getSession();
  const me = auth.session?.user.id;
  if (!me) return [];

  const { data } = await supabase
    .from('sessions')
    .select('id, performed_at, minutes, distance_m, second_point:track->1')
    .eq('user_id', me)
    .eq('type', 'run')
    .order('performed_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    performedAt: r.performed_at as string,
    minutes: Number(r.minutes ?? 0),
    distanceM: (r.distance_m as number | null) ?? 0,
    hasTrack: (r as { second_point?: unknown }).second_point != null,
  }));
}

export async function fetchRun(id: string): Promise<RunRecord | null> {
  const { data } = await supabase
    .from('sessions')
    .select('id, performed_at, minutes, distance_m, track')
    .eq('id', id)
    .maybeSingle();
  if (data == null) return null;
  return {
    id: data.id as string,
    performedAt: data.performed_at as string,
    minutes: Number(data.minutes ?? 0),
    distanceM: (data.distance_m as number | null) ?? 0,
    track: (data.track as [number, number][] | null) ?? null,
  };
}
