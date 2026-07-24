/**
 * Today's steps from the SYSTEM aggregate (TZ §4: harder to fake than any
 * in-app counter). iOS: CMPedometer via expo-sensors. Android arrives with
 * Health Connect later — the same hook shape will absorb it.
 */

import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';

export type StepsStatus = 'loading' | 'unavailable' | 'denied' | 'ready';

export type StepsState = {
  status: StepsStatus;
  /** Steps since local midnight. 0 until 'ready'. */
  steps: number;
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function readTodaySteps(): Promise<StepsState> {
  if (Platform.OS === 'web') return { status: 'unavailable', steps: 0 };
  try {
    const available = await Pedometer.isAvailableAsync();
    if (!available) return { status: 'unavailable', steps: 0 };
    const permission = await Pedometer.requestPermissionsAsync();
    if (!permission.granted) return { status: 'denied', steps: 0 };
    const { steps } = await Pedometer.getStepCountAsync(startOfToday(), new Date());
    return { status: 'ready', steps };
  } catch {
    // Sensor hiccup — treat as unavailable rather than crashing the screen.
    return { status: 'unavailable', steps: 0 };
  }
}

const REFRESH_INTERVAL_MS = 60_000;

/** Today's step count, refreshed on foreground and every minute while mounted. */
export function useTodaySteps(): StepsState & { refresh: () => void } {
  const [state, setState] = useState<StepsState>({ status: 'loading', steps: 0 });

  const refresh = useCallback(() => {
    void readTodaySteps().then(setState);
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [refresh]);

  return { ...state, refresh };
}
