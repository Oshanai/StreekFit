/**
 * Subscription gate (TZ §7/§10): the social layer is paid. Until RevenueCat
 * arrives in Phase 9, an active/grace row in `subscriptions` unlocks it —
 * and dev builds are always unlocked so the owner can test.
 */

import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase/client';

export function usePremium(): { premium: boolean; loading: boolean } {
  const [state, setState] = useState({ premium: __DEV__, loading: !__DEV__ });

  useEffect(() => {
    if (__DEV__) return;
    let alive = true;
    void (async () => {
      const { data: auth } = await supabase.auth.getSession();
      const me = auth.session?.user.id;
      if (!me) {
        if (alive) setState({ premium: false, loading: false });
        return;
      }
      const { data } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', me)
        .maybeSingle();
      const status = (data?.status as string | undefined) ?? 'none';
      if (alive) setState({ premium: status === 'active' || status === 'grace', loading: false });
    })();
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
