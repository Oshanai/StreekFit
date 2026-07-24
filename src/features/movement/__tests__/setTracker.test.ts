import {
  DEFAULT_REST_MS,
  MIN_REPS_TO_REGISTER,
  createSetTracker,
  defaultSetConfig,
  endSet,
  recordRep,
  restRemainingMs,
  sessionSummary,
  startSet,
  type SetEvent,
} from '../setTracker';

/** Land n valid reps at 2s tempo starting from t0; return events + end time. */
function doReps(
  state: ReturnType<typeof createSetTracker>,
  n: number,
  t0: number,
): { events: SetEvent[]; endedAt: number } {
  const events: SetEvent[] = [];
  let t = t0;
  for (let i = 0; i < n; i += 1) {
    t += 2000;
    events.push(recordRep(state, t));
  }
  return { events, endedAt: t };
}

describe('set tracker (TZ §3.2 — set closure, floor, rest, day-spread)', () => {
  it('closes the set automatically when the personal target is reached', () => {
    const s = createSetTracker(defaultSetConfig(10));
    expect(startSet(s)).toBe('setStarted');

    const { events } = doReps(s, 10, 0);
    expect(events.filter((e) => e === 'repCounted')).toHaveLength(9);
    expect(events[9]).toBe('setCompleted');
    expect(s.phase).toBe('resting');
    expect(s.completedSets).toEqual([10]);
    expect(s.currentReps).toBe(0);
  });

  it('ignores reps outside an active set (idle and resting)', () => {
    const s = createSetTracker(defaultSetConfig(5));
    expect(recordRep(s, 1000)).toBe('none'); // idle — set not started

    startSet(s);
    const { endedAt } = doReps(s, 5, 1000); // auto-close → resting
    expect(recordRep(s, endedAt + 500)).toBe('none'); // bounce during rest
    expect(sessionSummary(s)).toEqual({ validReps: 5, setsDone: 1, bestSet: 5 });
  });

  it('registers a manually-ended set at the 5-rep floor', () => {
    const s = createSetTracker(defaultSetConfig(20));
    startSet(s);
    const { endedAt } = doReps(s, MIN_REPS_TO_REGISTER, 0);

    expect(endSet(s, endedAt + 1000)).toBe('setRegistered');
    expect(s.phase).toBe('resting');
    expect(s.completedSets).toEqual([5]);
  });

  it('softly discards a set below the floor — no penalty, no rest lock', () => {
    const s = createSetTracker(defaultSetConfig(20));
    startSet(s);
    const { endedAt } = doReps(s, 4, 0);

    expect(endSet(s, endedAt + 1000)).toBe('setDiscarded');
    expect(s.phase).toBe('idle');
    expect(s.completedSets).toEqual([]);
    expect(restRemainingMs(s, endedAt + 2000)).toBe(0);

    // the athlete can immediately try again
    expect(startSet(s)).toBe('setStarted');
  });

  it('counts down rest after a registered set and clamps at zero', () => {
    const s = createSetTracker(defaultSetConfig(5));
    startSet(s);
    const { endedAt } = doReps(s, 5, 0);

    expect(restRemainingMs(s, endedAt)).toBe(DEFAULT_REST_MS);
    expect(restRemainingMs(s, endedAt + 30_000)).toBe(DEFAULT_REST_MS - 30_000);
    expect(restRemainingMs(s, endedAt + DEFAULT_REST_MS + 1)).toBe(0);
    // rest expiring changes nothing by itself — advisory only
    expect(s.phase).toBe('resting');
  });

  it('allows starting the next set during rest (rest is advisory)', () => {
    const s = createSetTracker(defaultSetConfig(5));
    startSet(s);
    const { endedAt } = doReps(s, 5, 0);
    expect(s.phase).toBe('resting');

    expect(startSet(s)).toBe('setStarted');
    expect(s.phase).toBe('active');
    expect(restRemainingMs(s, endedAt + 1000)).toBe(0);
  });

  it('spreads sets across the day and aggregates one session summary', () => {
    const HOUR = 3_600_000;
    const s = createSetTracker(defaultSetConfig(10));

    startSet(s);
    doReps(s, 10, 8 * HOUR); // morning — auto-closed
    startSet(s);
    const midday = doReps(s, 10, 13 * HOUR); // midday — auto-closed

    // hours pass; rest expired long ago and nothing is invalidated
    expect(restRemainingMs(s, midday.endedAt + 5 * HOUR)).toBe(0);
    expect(s.phase).toBe('resting');

    startSet(s);
    doReps(s, 7, 20 * HOUR); // evening — stopped early, above floor
    endSet(s, 20 * HOUR + 15 * 60_000);

    expect(s.completedSets).toEqual([10, 10, 7]);
    expect(sessionSummary(s)).toEqual({ validReps: 27, setsDone: 3, bestSet: 10 });
  });

  it('is idempotent on double start and double end', () => {
    const s = createSetTracker(defaultSetConfig(5));
    expect(endSet(s, 0)).toBe('none'); // nothing active yet
    startSet(s);
    expect(startSet(s)).toBe('none'); // already active — reps survive
    doReps(s, 3, 0);
    expect(s.currentReps).toBe(3);
    endSet(s, 10_000);
    expect(endSet(s, 11_000)).toBe('none');
  });
});
