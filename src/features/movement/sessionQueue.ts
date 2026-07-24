/**
 * Offline-first session persistence (TZ §3.2: «сессия считается без сети,
 * синкается позже» + §2.1: write session AGGREGATES, never per-rep rows).
 *
 * Flow: a finished camera session becomes one PendingSession in an
 * AsyncStorage queue, then a flush upserts every queued row to Supabase.
 * The id is generated on the client, so retries are idempotent — a row that
 * reached the server but failed to confirm can never duplicate.
 *
 * Failure policy:
 * - No signed-in user / network error / 5xx → keep queued, retry later.
 * - Permanent Postgres rejections (constraint, RLS, bad data) → drop the row;
 *   retrying a row the server will always refuse would poison the queue.
 *
 * Runs on the JS thread (storage + network) — nothing here is worklet code.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

import { supabase } from '@/lib/supabase/client';

export type MovementType = 'pushups' | 'squats' | 'steps' | 'run';

export type SessionInput = {
  type: MovementType;
  validReps?: number;
  minutes?: number;
  distanceM?: number;
  /** Biggest single set of the session («за раз» achievements). */
  bestSet?: number;
  setsDone: number;
  /** Camera-verified sessions set this true. */
  verified: boolean;
  /** Client clock at session end — the server timestamp arrives at sync. */
  performedAt: string;
};

export type PendingSession = SessionInput & { id: string };

const QUEUE_KEY = 'streekfit.sessionQueue.v1';

export async function readQueue(): Promise<PendingSession[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingSession[]) : [];
  } catch {
    // Corrupted storage — recover by starting clean rather than crashing.
    return [];
  }
}

async function writeQueue(queue: PendingSession[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// Queue writes are read-modify-write; serialize them so two rapid sessions
// (or a flush racing an enqueue) can never overwrite each other's update.
let storageLock: Promise<unknown> = Promise.resolve();
function withQueueLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = storageLock.then(fn, fn);
  storageLock = run.catch(() => undefined);
  return run;
}

async function appendToQueue(row: PendingSession): Promise<void> {
  await withQueueLock(async () => {
    const queue = await readQueue();
    await writeQueue([...queue, row]);
  });
}

async function removeFromQueue(ids: ReadonlySet<string>): Promise<void> {
  await withQueueLock(async () => {
    // Re-read before writing: a session enqueued mid-flush must survive.
    const current = await readQueue();
    await writeQueue(current.filter((row) => !ids.has(row.id)));
  });
}

/**
 * Queue a finished session and try to sync immediately. Always resolves —
 * offline just means the row waits for the next flush.
 */
export async function enqueueSession(input: SessionInput): Promise<PendingSession> {
  const row: PendingSession = { ...input, id: randomUUID() };
  await appendToQueue(row);
  void flushSessionQueue().catch(() => {
    // Sync is best-effort here; the row is safely queued.
  });
  return row;
}

/**
 * SQLSTATE classes the server will refuse forever: integrity violations (23),
 * malformed data (22), and RLS/privilege denials (42501). Everything else —
 * network throws, 5xx, expired tokens — is worth retrying.
 */
function isPermanentRejection(code: string | undefined): boolean {
  if (!code) return false;
  return code.startsWith('23') || code.startsWith('22') || code === '42501';
}

let flushing = false;

/**
 * Push every queued session to Supabase. Single-flight: concurrent calls
 * (app foregrounded while a flush runs) collapse into one. Returns how many
 * rows were synced this call.
 */
export async function flushSessionQueue(): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return 0; // signed out — keep everything queued

    const queue = await readQueue();
    if (queue.length === 0) return 0;

    const synced = new Set<string>();
    const dropped = new Set<string>();

    for (const row of queue) {
      try {
        const { error } = await supabase.from('sessions').upsert({
          id: row.id,
          user_id: userId,
          type: row.type,
          valid_reps: row.validReps ?? null,
          minutes: row.minutes ?? null,
          distance_m: row.distanceM ?? null,
          best_set: row.bestSet ?? null,
          sets_done: row.setsDone,
          verified: row.verified,
          performed_at: row.performedAt,
        });

        if (!error) {
          synced.add(row.id);
        } else if (isPermanentRejection(error.code)) {
          dropped.add(row.id);
        } else {
          break; // transient (offline, 5xx) — stop, keep order, retry later
        }
      } catch {
        break; // fetch threw — no network, retry later
      }
    }

    if (synced.size > 0 || dropped.size > 0) {
      await removeFromQueue(new Set([...synced, ...dropped]));
    }
    return synced.size;
  } finally {
    flushing = false;
  }
}
