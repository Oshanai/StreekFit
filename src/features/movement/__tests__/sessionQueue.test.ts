import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase/client';

import {
  enqueueSession,
  flushSessionQueue,
  readQueue,
  type SessionInput,
} from '../sessionQueue';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- official AsyncStorage jest mock pattern
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `uuid-${(n += 1)}` };
});

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
  },
}));

const getSession = supabase.auth.getSession as jest.Mock;
const from = supabase.from as unknown as jest.Mock;

/** Let fire-and-forget flushes started by enqueueSession fully settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function signedIn(userId = 'user-1') {
  getSession.mockResolvedValue({ data: { session: { user: { id: userId } } } });
}

function signedOut() {
  getSession.mockResolvedValue({ data: { session: null } });
}

/** Mock the sessions table; upsert resolves per the provided implementation. */
function mockUpsert(impl: (row: Record<string, unknown>) => Promise<{ error: unknown }>) {
  const upsert = jest.fn(impl);
  from.mockImplementation((table: string) => {
    if (table !== 'sessions') throw new Error(`unexpected table ${table}`);
    return { upsert };
  });
  return upsert;
}

const PUSHUPS: SessionInput = {
  type: 'pushups',
  validReps: 27,
  setsDone: 3,
  verified: true,
  performedAt: '2026-07-11T09:30:00.000Z',
};

beforeEach(async () => {
  await AsyncStorage.clear();
  signedOut();
  mockUpsert(async () => ({ error: null }));
});

describe('session queue (TZ §3.2 — offline first, aggregates only)', () => {
  it('keeps the session queued while signed out / offline', async () => {
    const row = await enqueueSession(PUSHUPS);
    await settle();

    expect(row.id).toMatch(/^uuid-/);
    const queue = await readQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ type: 'pushups', validReps: 27, setsDone: 3 });
  });

  it('syncs queued sessions once signed in and clears the queue', async () => {
    const first = await enqueueSession(PUSHUPS);
    await enqueueSession({ ...PUSHUPS, type: 'squats', validReps: 30 });
    await settle();

    signedIn();
    const upsert = mockUpsert(async () => ({ error: null }));
    const synced = await flushSessionQueue();

    expect(synced).toBe(2);
    expect(await readQueue()).toHaveLength(0);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[0][0]).toMatchObject({
      id: first.id,
      user_id: 'user-1',
      type: 'pushups',
      valid_reps: 27,
      sets_done: 3,
      verified: true,
      performed_at: PUSHUPS.performedAt,
    });
  });

  it('retries with the SAME id (idempotent upsert, no duplicates)', async () => {
    signedIn();
    let failFirst = true;
    const upsert = mockUpsert(async () => {
      if (failFirst) {
        failFirst = false;
        throw new Error('network down');
      }
      return { error: null };
    });

    const row = await enqueueSession(PUSHUPS); // background flush throws → row stays
    await settle();
    expect(await readQueue()).toHaveLength(1);

    await flushSessionQueue(); // network back → same row, same id
    expect(await readQueue()).toHaveLength(0);
    expect(upsert.mock.calls.map((c) => c[0].id)).toEqual([row.id, row.id]);
  });

  it('stops at a transient error and preserves queue order', async () => {
    await enqueueSession(PUSHUPS);
    await enqueueSession({ ...PUSHUPS, type: 'squats' });
    await settle();

    signedIn();
    mockUpsert(async () => ({ error: { code: undefined, message: '503' } }));
    const synced = await flushSessionQueue();

    expect(synced).toBe(0);
    const queue = await readQueue();
    expect(queue.map((r) => r.type)).toEqual(['pushups', 'squats']);
  });

  it('drops rows the server permanently rejects instead of poisoning the queue', async () => {
    await enqueueSession({ ...PUSHUPS, validReps: -1 }); // violates check constraint
    await enqueueSession({ ...PUSHUPS, type: 'squats' });
    await settle();

    signedIn();
    const upsert = mockUpsert(async (row) =>
      (row.valid_reps as number) < 0
        ? { error: { code: '23514', message: 'check violation' } }
        : { error: null },
    );
    const synced = await flushSessionQueue();

    expect(synced).toBe(1);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(await readQueue()).toHaveLength(0); // bad row dropped, good row synced
  });

  it('a session enqueued during a flush survives the queue cleanup', async () => {
    const first = await enqueueSession(PUSHUPS);
    await settle();

    signedIn();
    let releaseUpsert: (() => void) | undefined;
    mockUpsert(
      (row) =>
        new Promise((resolve) => {
          if (row.id === first.id) {
            releaseUpsert = () => resolve({ error: null });
          } else {
            resolve({ error: null });
          }
        }),
    );

    const flushPromise = flushSessionQueue(); // hangs on uuid-1
    await settle();
    signedOut(); // keep the mid-flight enqueue's own background flush inert
    const enqueuePromise = enqueueSession({ ...PUSHUPS, type: 'squats' });
    await settle();

    releaseUpsert?.();
    await flushPromise;
    await enqueuePromise;
    await settle();

    const queue = await readQueue();
    expect(queue.map((r) => r.type)).toEqual(['squats']); // synced row gone, new row kept
  });

  it('recovers from corrupted storage by starting clean', async () => {
    await AsyncStorage.setItem('streekfit.sessionQueue.v1', '{not json[');
    expect(await readQueue()).toEqual([]);
  });
});
