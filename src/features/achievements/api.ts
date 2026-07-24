/**
 * Achievements data access: read-only catalog + my unlocks (awarding is
 * server-side via claim_achievements in dailySync) and the 3 featured
 * slots on the profile (TZ §8 / §2.3).
 */

import { supabase } from '@/lib/supabase/client';

import { isBadgeCode, type CatalogRow, type Tier } from './catalog';

export async function fetchCatalog(): Promise<CatalogRow[]> {
  const { data, error } = await supabase
    .from('achievements')
    .select('id, code, tier, threshold, sort')
    .order('sort')
    .order('tier');
  if (error) throw error;
  return (data ?? [])
    .filter((r) => isBadgeCode(r.code as string))
    .map((r) => ({
      id: r.id as string,
      code: r.code as CatalogRow['code'],
      tier: r.tier as Tier,
      threshold: r.threshold as number,
    }));
}

export type UnlockedMap = Map<string, string>; // achievement_id → unlocked_at

export async function fetchMyUnlocks(): Promise<UnlockedMap> {
  const { data: auth } = await supabase.auth.getSession();
  const me = auth.session?.user.id;
  if (!me) return new Map();
  const { data } = await supabase
    .from('user_achievements')
    .select('achievement_id, unlocked_at')
    .eq('user_id', me);
  return new Map(
    (data ?? []).map((r) => [r.achievement_id as string, r.unlocked_at as string]),
  );
}

/** Toggle a badge in the 3 featured slots; returns the new array. */
export async function toggleFeatured(
  current: string[],
  achievementId: string,
): Promise<string[]> {
  const { data: auth } = await supabase.auth.getSession();
  const me = auth.session?.user.id;
  if (!me) return current;

  let next: string[];
  if (current.includes(achievementId)) {
    next = current.filter((id) => id !== achievementId);
  } else {
    next = [...current, achievementId].slice(-3); // keep the newest three
  }
  const { error } = await supabase
    .from('profiles')
    .update({ featured_achievements: next })
    .eq('id', me);
  if (error) throw error;
  return next;
}
