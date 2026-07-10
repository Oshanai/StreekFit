import type { Session } from '@supabase/supabase-js';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { supabase } from '@/lib/supabase/client';

export type Profile = {
  id: string;
  name: string | null;
  age: number | null;
  gender: 'male' | 'female' | 'other' | null;
  country: string | null;
  city: string | null;
  avatar_url: string | null;
  frame_id: string | null;
  featured_achievements: string[];
  base_level: number;
};

export type UserTargets = {
  user_id: string;
  pushup_target: number;
  squat_target: number;
  steps_target: number;
};

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  targets: UserTargets | null;
  /** True until the initial session AND profile fetch settle. */
  loading: boolean;
  /** Registration + calibration finished → main app unlocked. */
  onboardingComplete: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [targets, setTargets] = useState<UserTargets | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const [profileRes, targetsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('user_targets').select('*').eq('user_id', userId).maybeSingle(),
    ]);
    setProfile((profileRes.data as Profile | null) ?? null);
    setTargets((targetsRes.data as UserTargets | null) ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      if (mounted) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession) {
        await loadProfile(newSession.user.id);
      } else {
        setProfile(null);
        setTargets(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (session) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      targets,
      loading,
      onboardingComplete: Boolean(profile?.name && targets),
      refreshProfile,
      signOut,
    }),
    [session, profile, targets, loading, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
