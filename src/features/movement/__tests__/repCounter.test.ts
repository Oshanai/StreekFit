import {
  PUSHUP_CONFIG,
  SQUAT_CONFIG,
  createRepCounter,
  updateRepCounter,
  type RepEvent,
} from '../repCounter';

/** Feed a sequence of (angle, tMs) samples with perfect form; collect events. */
function run(
  state: ReturnType<typeof createRepCounter>,
  frames: [angle: number, tMs: number, formOk?: boolean][],
): RepEvent[] {
  return frames.map(([angle, timestampMs, formOk = true]) =>
    updateRepCounter(state, { angle, formOk, timestampMs }),
  );
}

describe('rep counter FSM (push-up config: down ≤90, up ≥160)', () => {
  it('counts a full-amplitude rep exactly once', () => {
    const s = createRepCounter(PUSHUP_CONFIG);
    const events = run(s, [
      [175, 0],
      [120, 200],
      [85, 400], // descent
      [80, 600],
      [120, 800],
      [165, 1000], // full extension → rep
    ]);
    expect(events).toContain('descent');
    expect(events.filter((e) => e === 'rep')).toHaveLength(1);
    expect(s.validReps).toBe(1);
  });

  it('does not count a partial rep and flags a near-depth attempt softly', () => {
    const s = createRepCounter(PUSHUP_CONFIG);
    // dips to 100° — within 25° of the 90° target, but never through it
    const events = run(s, [
      [175, 0],
      [130, 300],
      [100, 600],
      [130, 900],
      [170, 1200],
    ]);
    expect(s.validReps).toBe(0);
    expect(events).toContain('partial');
    expect(events).not.toContain('rep');
  });

  it('ignores shallow wobbles entirely (no partial spam)', () => {
    const s = createRepCounter(PUSHUP_CONFIG);
    // dips only to 140° — far from depth, just noise/shifting
    const events = run(s, [
      [175, 0],
      [140, 300],
      [172, 600],
    ]);
    expect(events).not.toContain('partial');
    expect(events).not.toContain('rep');
  });

  it('hysteresis: jitter around the down threshold cannot double-count', () => {
    const s = createRepCounter(PUSHUP_CONFIG);
    const events = run(s, [
      [175, 0],
      [89, 300], // descent
      [91, 400], // jitter back up — still in hysteresis band, phase stays down
      [88, 500],
      [92, 600],
      [87, 700],
      [165, 1100], // one rep, not three
    ]);
    expect(events.filter((e) => e === 'rep')).toHaveLength(1);
    expect(events.filter((e) => e === 'descent')).toHaveLength(1);
    expect(s.validReps).toBe(1);
  });

  it('rejects a single-frame glitch below threshold (dwell filter)', () => {
    const s = createRepCounter(PUSHUP_CONFIG);
    const events = run(s, [
      [175, 0],
      [70, 100], // pose-detection glitch: one frame at depth
      [170, 150], // back up 50ms later — impossible descent
    ]);
    expect(s.validReps).toBe(0);
    expect(events).not.toContain('rep');
  });

  it('rejects impossibly fast reps (tempo sanity)', () => {
    const s = createRepCounter(PUSHUP_CONFIG);
    const events = run(s, [
      // rep 1 — legit
      [175, 0],
      [85, 400],
      [165, 1000],
      // rep 2 — peaks only 300ms after rep 1 (< 700ms interval)
      [85, 1100],
      [165, 1300],
    ]);
    expect(events.filter((e) => e === 'rep')).toHaveLength(1);
    expect(events).toContain('rejectedTooFast');
    expect(s.validReps).toBe(1);
  });

  it('rejects the rep when form breaks mid-descent', () => {
    const s = createRepCounter(PUSHUP_CONFIG);
    const events = run(s, [
      [175, 0],
      [85, 400], // descent, form ok
      [80, 600, false], // hips sag
      [165, 1200],
    ]);
    expect(s.validReps).toBe(0);
    expect(events).toContain('rejectedForm');
  });

  it('recovers after a rejected rep — next clean rep counts', () => {
    const s = createRepCounter(PUSHUP_CONFIG);
    run(s, [
      [175, 0],
      [85, 400, false],
      [165, 1200], // rejectedForm
    ]);
    const events = run(s, [
      [85, 2000],
      [165, 2800],
    ]);
    expect(events).toContain('rep');
    expect(s.validReps).toBe(1);
  });

  it('counts a realistic 5-rep set at steady tempo', () => {
    const s = createRepCounter(PUSHUP_CONFIG);
    const frames: [number, number][] = [];
    for (let i = 0; i < 5; i++) {
      const base = i * 2000;
      frames.push([170, base], [120, base + 500], [82, base + 900], [125, base + 1400], [168, base + 1900]);
    }
    run(s, frames);
    expect(s.validReps).toBe(5);
  });
});

describe('squat config (down ≤100, up ≥160)', () => {
  it('counts a full squat and ignores a half squat', () => {
    const s = createRepCounter(SQUAT_CONFIG);
    const events = run(s, [
      [178, 0],
      [95, 700], // to parallel
      [170, 1600], // full stand → rep
      [120, 2300], // half squat
      [172, 3000], // partial feedback
    ]);
    expect(events.filter((e) => e === 'rep')).toHaveLength(1);
    expect(events).toContain('partial');
    expect(s.validReps).toBe(1);
  });
});
