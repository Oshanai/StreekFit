/**
 * Background run tracking (TZ §5). expo-location delivers fixes to a
 * TaskManager task even when the app is backgrounded; the OS-level
 * timeInterval/distanceInterval options ARE the write throttle. Accepted
 * points live in a module buffer that the run screen polls at 1 Hz —
 * no per-fix React re-renders.
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { appendPoint, type GeoPoint } from './geo';

const TASK_NAME = 'streekfit-run-tracking';

/** Module-level run buffer — survives screen remounts, not app restarts. */
const buffer: { track: GeoPoint[]; distanceM: number; active: boolean } = {
  track: [],
  distanceM: 0,
  active: false,
};

type TaskFix = {
  coords: { latitude: number; longitude: number; accuracy: number | null };
  timestamp: number;
};
type TaskBody = { locations: TaskFix[] };

TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  if (error != null || data == null || !buffer.active) return;
  const { locations } = data as TaskBody;
  for (const loc of locations) {
    buffer.distanceM += appendPoint(buffer.track, {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy ?? 999,
      timestamp: loc.timestamp,
    });
  }
});

export type RunPermission = 'granted' | 'foreground-only' | 'denied';

/** Foreground first (required), then background (nice to have). */
export async function requestRunPermissions(): Promise<RunPermission> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return 'denied';
  const bg = await Location.requestBackgroundPermissionsAsync();
  return bg.granted ? 'granted' : 'foreground-only';
}

export async function startRun(): Promise<void> {
  buffer.track = [];
  buffer.distanceM = 0;
  buffer.active = true;
  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.BestForNavigation,
    // The GPS write throttle (TZ: троттлинг записи точек).
    timeInterval: 3000,
    distanceInterval: 5,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'Streek Fit',
      notificationBody: 'Recording your run',
    },
  });
}

export async function stopRun(): Promise<{ track: GeoPoint[]; distanceM: number }> {
  buffer.active = false;
  const started = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
  if (started) await Location.stopLocationUpdatesAsync(TASK_NAME);
  return { track: [...buffer.track], distanceM: buffer.distanceM };
}

/** Live snapshot for the 1 Hz HUD poll. */
export function runSnapshot(): { track: GeoPoint[]; distanceM: number; active: boolean } {
  return { track: buffer.track, distanceM: buffer.distanceM, active: buffer.active };
}

export async function isRunActive(): Promise<boolean> {
  if (buffer.active) return true;
  return Location.hasStartedLocationUpdatesAsync(TASK_NAME);
}
