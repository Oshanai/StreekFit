/**
 * Current streak for display surfaces that don't run the full daily sync
 * (profile, future leaderboards). Reads own daily_scores history on focus.
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { supabase } from '@/lib/supabase/client';

import { computeStreak, type DayRecord, type DayStatus } from './streak';

function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function useCurrentStreak(): number {
  const [streak, setStreak] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        const { data: auth } = await supabase.auth.getSession();
        const userId = auth.session?.user.id;
        if (!userId) return;
        const { data } = await supabase
          .from('daily_scores')
          .select('date, status')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(31);
        if (!alive || data == null) return;
        const records: DayRecord[] = data.map((r) => ({
          date: r.date as string,
          status: r.status as DayStatus,
        }));
        setStreak(computeStreak(records, todayDateString()));
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  return streak;
}
