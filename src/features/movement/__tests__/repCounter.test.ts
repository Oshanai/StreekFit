import {
  PUSHUP_CONFIG,
  SQUAT_CONFIG,
  createRepCounter,
  updateRepCounter,
  type RepEvent,
} from '../repCounter';

/**
 * Feed a sequence of (angle, tMs) samples; collect events.
 * NOTE: sequences must be camera-realistic — any human-speed descent at
 * 15+ fps passes through the hysteresis band before reaching depth, and the
 * FSM's glitch protection relies on that (teleports to depth are ignored).
 */
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
      [89, 300], // first depth frame arms the band tracker
      [91, 400], // jitter back up — hysteresis band, no state flip
      [88, 500], // confirmed descent
      [92, 600],
      [87, 700],
      [165, 1100], // one rep, not three
    ]);
    expect(events.filter((e) => e === 'rep')).toHaveLength(1);
    expect(events.filter((e) => e === 'descent')).toHaveLength(1);
    expect(s.validReps).toBe(1);
  });

  it('rejects a single-frame glitch below threshold (teleport protection)', () => {
    const s = createRepCounter(PUSHUP_CONFIG);
    const events = run(s, [
      [175, 0],
      [70, 100], // pose glitch: extension → depth with no band frame
      [170, 150],
    ]);
    expect(s.validReps).toBe(0);
    expect(events).not.toContain('rep');
    expect(events).not.toContain('descent');
  });

  it('rejects a multi-frame occlusion flicker at 15fps (teleport + dwell)', () => {
    const s = createRepCounter(PUSHUP_CONFIG);
    // 3 frames at depth (~66ms apart), no band frames — classic occlusion
    const events = run(s, [
      [170, 0],
      [85, 67],
      [85, 133],
      [85, 200],
      [168, 267],
    ]);
    expect(s.validReps).toBe(0);
    expect(events).not.toContain('rep');
  });

  it('rejects impossibly fast reps AND re-arms the anchor (no bounce farming)', () => {
    const s = createRepCounter(PUSHUP_CONFIG);
    const events = run(s, [
      // rep 1 — legit
      [175, 0],
      [120, 200],
      [85, 400],
      [165, 1000],
      // sustained 300ms full-ROM bouncing
      [120, 1050],
      [85, 1100],
      [165, 1300], // 300ms after rep 1 → rejected, anchor → 1300
      [120, 1350],
      [85, 1400],
      [165, 1600], // 300ms after anchor → rejected again, anchor → 1600
      [120, 1650],
      [85, 1700],
      [165, 1900], // still bouncing → rejected (old code would count this!)
    ]);
    expect(events.filter((e) => e === 'rep')).toHaveLength(1);
    expect(events.filter((e) => e === 'rejectedTooFast')).toHaveLength(3);
    expect(s.validReps).toBe(1);
  });

  it('rejects the rep when form breaks mid-descent (hysteresis band, before depth)', () => {
    const s = createRepCounter(PUSHUP_CONFIG);
    const events = run(s, [
      [175, 0],
      [120, 300, false], // hips sag on the way down
      [105, 500, false],
      [85, 700, true], // momentarily reads OK exactly at the crossing
      [80, 900, true],
      [165, 1500, true],
    ]);
    expect(s.validReps).toBe(0);
    expect(events).toContain('rejectedForm');
  });

  it('rejects the rep when form breaks at the bottom', () => {
    const s = createRepCounter(PUSHUP_CONFIG);
    const events = run(s, [
      [175, 0],
      [120, 200],
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
      [120, 200],
      [85, 400, false],
      [165, 1200], // rejectedForm
    ]);
    const events = run(s, [
      [120, 1800],
      [85, 2000],
      [165, 2800],
    ]);
    expect(events).toContain('rep');
    expect(s.validReps).toBe(1);
  });

  it('emits nearLockout when stalling just below full extension', () => {
    const s = createRepCounter(PUSHUP_CONFIG);
    const events = run(s, [
      [175, 0],
      [120, 200],
      [85, 500], // descent
      [150, 900], // pushes up but stalls at 150-153°
      [152, 1400],
      [153, 2200], // stalled ≥1200ms → feedback
      [151, 2600], // no repeat spam
    ]);
    expect(events).toContain('nearLockout');
    expect(events.filter((e) => e === 'nearLockout')).toHaveLength(1);
    expect(s.validReps).toBe(0);
  });

  it('skips non-finite samples without corrupting state', () => {
    const s = createRepCounter(PUSHUP_CONFIG);
    const events = run(s, [
      [175, 0],
      [120, 200],
      [NaN, 300],
      [85, 400],
      [Number.POSITIVE_INFINITY, 500],
      [165, 1000],
    ]);
    expect(events.filter((e) => e === 'rep')).toHaveLength(1);
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
      [130, 400],
      [95, 700], // to parallel
      [170, 1600], // full stand → rep
      [120, 2300], // half squat
      [172, 3000], // partial feedback
    ]);
    expect(events.filter((e) => e === 'rep')).toHaveLength(1);
    expect(events).toContain('partial');
    expect(s.validReps).toBe(1);
  });

  it('soft-knee stand short of 160 gets nearLockout feedback, not silence', () => {
    const s = createRepCounter(SQUAT_CONFIG);
    const events = run(s, [
      [178, 0],
      [130, 400],
      [95, 800],
      [157, 1500], // stands up with soft knees — just under threshold
      [156, 2200],
      [157, 2900], // ≥1200ms in the stall band → feedback
    ]);
    expect(events).toContain('nearLockout');
    expect(s.validReps).toBe(0);
  });
});
