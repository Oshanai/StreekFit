/**
 * Rep counting — hysteresis state machine, worklet-safe.
 *
 * TZ rules it encodes:
 * - A rep counts ONLY on full range of motion: angle must cross the low
 *   threshold (descent) and then the high threshold (full extension).
 * - Two thresholds = hysteresis: sensor jitter around one line can never
 *   produce double counts.
 * - Partial reps are softly flagged («не в счёт») — no penalty.
 * - Tempo sanity: impossibly fast reps are rejected.
 * - Form breaks during the rep (e.g. sagging hips in a push-up) reject that
 *   rep softly.
 *
 * Plain objects + pure functions (no classes) so Reanimated worklets can own
 * the state on the UI thread without bridge crossings.
 */

export type RepCounterConfig = {
  /** Crossing below this angle (deg) registers the descent. */
  downThreshold: number;
  /** Crossing back above this angle (deg) completes the rep. */
  upThreshold: number;
  /** Minimum time spent below downThreshold for a legit descent. */
  minDownDwellMs: number;
  /** Reps faster than this (rep-to-rep) are physically implausible. */
  minRepIntervalMs: number;
  /**
   * A dip that gets within this many degrees of downThreshold — but not
   * through it — is a recognizable attempt and gets 'partial' feedback.
   * Shallower wobbles are ignored as noise.
   */
  partialFeedbackBand: number;
};

export type RepPhase = 'up' | 'down';

export type RepCounterState = {
  config: RepCounterConfig;
  phase: RepPhase;
  validReps: number;
  /** Timestamp when the current descent crossed downThreshold. */
  downSince: number;
  /** Timestamp of the last counted rep (0 = none yet). */
  lastRepAt: number;
  /** Set false if form broke at any point of the current descent. */
  formOkThisRep: boolean;
  /** Lowest angle seen since last full extension (partial-attempt tracking). */
  minAngleSinceUp: number;
};

export type RepEvent =
  | 'none'
  /** Descent registered — UI can pulse the counter. */
  | 'descent'
  /** Full valid rep counted. */
  | 'rep'
  /** Full motion but implausibly fast — not counted. */
  | 'rejectedTooFast'
  /** Full motion but form broke during the rep — not counted. */
  | 'rejectedForm'
  /** Meaningful attempt that never reached depth — softly not counted. */
  | 'partial';

export type RepSample = {
  /** Primary joint angle in degrees (elbow for push-ups, knee for squats). */
  angle: number;
  /** Exercise-specific form gate for this frame (true = form acceptable). */
  formOk: boolean;
  /** Monotonic timestamp in ms (frame timestamp). */
  timestampMs: number;
};

export function createRepCounter(config: RepCounterConfig): RepCounterState {
  'worklet';
  return {
    config,
    phase: 'up',
    validReps: 0,
    downSince: 0,
    lastRepAt: 0,
    formOkThisRep: true,
    minAngleSinceUp: 180,
  };
}

/**
 * Feed one pose sample; mutates state, returns what happened this frame.
 * Between thresholds nothing counts — that band is the hysteresis zone.
 */
export function updateRepCounter(state: RepCounterState, sample: RepSample): RepEvent {
  'worklet';
  const { downThreshold, upThreshold, minDownDwellMs, minRepIntervalMs, partialFeedbackBand } =
    state.config;

  if (state.phase === 'up') {
    if (sample.angle <= downThreshold) {
      state.phase = 'down';
      state.downSince = sample.timestampMs;
      state.formOkThisRep = sample.formOk;
      state.minAngleSinceUp = sample.angle;
      return 'descent';
    }

    if (sample.angle < state.minAngleSinceUp) state.minAngleSinceUp = sample.angle;

    // Back at full extension after a dip that never reached depth?
    if (sample.angle >= upThreshold && state.minAngleSinceUp < upThreshold) {
      const attempted = state.minAngleSinceUp <= downThreshold + partialFeedbackBand;
      state.minAngleSinceUp = 180;
      return attempted ? 'partial' : 'none';
    }

    return 'none';
  }

  // phase === 'down'
  if (!sample.formOk) state.formOkThisRep = false;

  if (sample.angle >= upThreshold) {
    state.phase = 'up';
    state.minAngleSinceUp = 180;

    const dwellMs = sample.timestampMs - state.downSince;
    if (dwellMs < minDownDwellMs) {
      // single-frame glitch below threshold — treat as noise, not a partial
      return 'none';
    }

    if (!state.formOkThisRep) {
      state.formOkThisRep = true;
      return 'rejectedForm';
    }

    if (state.lastRepAt !== 0 && sample.timestampMs - state.lastRepAt < minRepIntervalMs) {
      return 'rejectedTooFast';
    }

    state.validReps += 1;
    state.lastRepAt = sample.timestampMs;
    return 'rep';
  }

  return 'none';
}

/** TZ §3.2 — push-up: elbow down ≤90°, up ≥160°. */
export const PUSHUP_CONFIG: RepCounterConfig = {
  downThreshold: 90,
  upThreshold: 160,
  minDownDwellMs: 150,
  minRepIntervalMs: 700,
  partialFeedbackBand: 25,
};

/** TZ §3.2 — squat: knee ~≤100° (hip to parallel), full stand ≥160°. */
export const SQUAT_CONFIG: RepCounterConfig = {
  downThreshold: 100,
  upThreshold: 160,
  minDownDwellMs: 200,
  minRepIntervalMs: 900,
  partialFeedbackBand: 25,
};
