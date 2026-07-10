/**
 * Drains the offline session queue whenever sync has a chance to succeed:
 * on sign-in and every time the app returns to the foreground.
 * Mount once under AuthProvider (root layout).
 */

import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';

import { flushSessionQueue } from './sessionQueue';

export function useSessionSync(): void {
  const { session } = useAuth();

  useEffect(() => {
    if (!session) return;

    void flushSessionQueue();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void flushSessionQueue();
    });
    return () => sub.remove();
  }, [session]);
}
