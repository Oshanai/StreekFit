/**
 * Tiny dependency-free bridge: the session queue announces «new activity
 * synced», dailySync listens and drops its throttle cache. Keeping it in a
 * separate module breaks the sessionQueue ↔ dailySync require cycle.
 */

let listener: (() => void) | null = null;

export function onNewActivitySynced(cb: () => void): void {
  listener = cb;
}

export function notifyNewActivitySynced(): void {
  listener?.();
}
