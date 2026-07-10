/**
 * Rep counting — hysteresis state machine, worklet-safe.
 *
 * TZ rules it encodes:
 * - A rep counts ONLY on full range of motion: angle must cross the low
 *   threshold (descent) and then the high threshold (full extension).
 * - Two thresholds = hysteresis: sensor jitter around one line can never
 *   produce double counts.
 * - Partial reps are softly flagged («не в счёт») — no penalty.
 * - Tempo sanity: impossibly fast reps are rejected, and each rejection
 *   re-arms the tempo anchor so sustained bouncing can't accrue reps.
 * - Form breaks anywhere between full extension and full extension
 *   (descent approach included) reject that rep softly.
 * - Teleport-to-depth protection: a descent only arms after at least one
 *   frame inside the hysteresis band — pose-detection flickers that jump
 *   straight from extension to depth are ignored (combined with the dwell
 *   filter this absorbs multi-frame occlusion glitches). Any human-speed
 *   descent at 15+ fps produces band frames, so real reps are unaffected.
 * - Stalled lockout feedback: if the athlete stops just short of full
 *   extension, the FSM emits 'nearLockout' instead of going silent.
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
  /**
   * While ascending, hovering within this many degrees below upThreshold
   * counts as a stalled lockout (see stallFeedbackMs).
   */
  stallBand: number;
  /** Hovering near lockout this long emits 'nearLockout' feedback. */
  stallFeedbackMs: number;
};

export type RepPhase = 'up' | 'down';

export type RepCounterState = {
  config: RepCounterConfig;
  phase: RepPhase;
  validReps: number;
  /** Timestamp when the current descent crossed downThreshold. */
  downSince: number;
  /** Tempo anchor: last counted OR too-fast-rejected completion. */
  lastRepAt: number;
  /** Whether the tempo anchor has ever been set. */
  tempoArmed: boolean;
  /** Set false if form broke anywhere during the current attempt. */
  formOkThisRep: boolean;
  /** Form accumulator for the descent approach (up phase, below upThreshold). */
  approachFormOk: boolean;
  /** Lowest angle seen since last full extension (partial + arming tracking). */
  minAngleSinceUp: number;
  /** Timestamp when the ascent entered the stall band (0 = not stalling). */
  nearTopSince: number;
  /** True once 'nearLockout' was emitted for the current stall. */
  stallNotified: boolean;
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
  | 'partial'
  /** Stuck just below full extension — prompt «выпрямись до конца». */
  | 'nearLockout';

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
    tempoArmed: false,
    formOkThisRep: true,
    approachFormOk: true,
    minAngleSinceUp: 180,
    nearTopSince: 0,
    stallNotified: false,
  };
}

/**
 * Feed one pose sample; mutates state, returns what happened this frame.
 * Between thresholds nothing counts — that band is the hysteresis zone.
 */
export function updateRepCounter(state: RepCounterState, sample: RepSample): RepEvent {
  'worklet';
  // Non-finite input (NaN/Infinity from degenerate landmarks) — skip frame.
  if (!Number.isFinite(sample.angle) || !Number.isFinite(sample.timestampMs)) return 'none';

  const {
    downThreshold,
    upThreshold,
    minDownDwellMs,
    minRepIntervalMs,
    partialFeedbackBand,
    stallBand,
    stallFeedbackMs,
  } = state.config;

  if (state.phase === 'up') {
    if (sample.angle >= upThreshold) {
      // Full extension: report a near-depth attempt, reset approach tracking.
      const dipped = state.minAngleSinceUp < upThreshold;
      const attempted = state.minAngleSinceUp <= downThreshold + partialFeedbackBand;
      state.minAngleSinceUp = 180;
      state.approachFormOk = true;
      return dipped && attempted ? 'partial' : 'none';
    }

    // Below upThreshold: a rep attempt is in progress — accumulate form.
    if (!sample.formOk) state.approachFormOk = false;

    const armed = state.minAngleSinceUp < upThreshold;
    if (sample.angle < state.minAngleSinceUp) state.minAngleSinceUp = sample.angle;

    if (sample.angle <= downThreshold) {
      if (!armed) {
        // Teleport from extension straight to depth — pose glitch, wait for
        // a confirming frame (real descents pass through the band first).
        return 'none';
      }
      state.phase = 'down';
      state.downSince = sample.timestampMs;
      state.formOkThisRep = state.approachFormOk;
      state.nearTopSince = 0;
      state.stallNotified = false;
      return 'descent';
    }

    return 'none';
  }

  // phase === 'down'
  if (!sample.formOk) state.formOkThisRep = false;

  if (sample.angle >= upThreshold) {
    state.phase = 'up';
    state.minAngleSinceUp = 180;
    state.approachFormOk = true;
    state.nearTopSince = 0;
    state.stallNotified = false;

    const dwellMs = sample.timestampMs - state.downSince;
    if (dwellMs < minDownDwellMs) {
      // single-frame glitch below threshold — treat as noise, not a partial
      return 'none';
    }

    if (!state.formOkThisRep) {
      state.formOkThisRep = true;
      return 'rejectedForm';
    }

    if (state.tempoArmed && sample.timestampMs - state.lastRepAt < minRepIntervalMs) {
      // Re-arm the anchor: sustained implausible bouncing accrues nothing.
      state.lastRepAt = sample.timestampMs;
      return 'rejectedTooFast';
    }

    state.validReps += 1;
    state.lastRepAt = sample.timestampMs;
    state.tempoArmed = true;
    return 'rep';
  }

  // Stalled just below lockout? Give feedback instead of silence.
  if (sample.angle >= upThreshold - stallBand) {
    if (state.nearTopSince === 0) {
      state.nearTopSince = sample.timestampMs;
    } else if (
      !state.stallNotified &&
      sample.timestampMs - state.nearTopSince >= stallFeedbackMs
    ) {
      state.stallNotified = true;
      return 'nearLockout';
    }
  } else {
    state.nearTopSince = 0;
    state.stallNotified = false;
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
  stallBand: 15,
  stallFeedbackMs: 1200,
};

/** TZ §3.2 — squat: knee ~≤100° (hip to parallel), full stand ≥160°. */
export const SQUAT_CONFIG: RepCounterConfig = {
  downThreshold: 100,
  upThreshold: 160,
  minDownDwellMs: 200,
  minRepIntervalMs: 900,
  partialFeedbackBand: 25,
  stallBand: 15,
  stallFeedbackMs: 1200,
};
