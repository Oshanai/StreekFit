/**
 * Set tracking on top of the rep counter — worklet-safe.
 *
 * TZ rules it encodes (§3.2):
 * - A set CLOSES automatically when the personal rep target is reached
 *   (targets come from calibration and grow with progression, Phase 5).
 * - A manually-ended set REGISTERS only at ≥ MIN_REPS_TO_REGISTER valid
 *   reps; below the floor it is softly discarded («не в счёт», no penalty).
 * - After a registered set a rest timer starts. Rest is advisory — sets can
 *   be spread across the whole day, so the timer expiring never forces or
 *   forbids anything; it only tells the UI when the athlete is recovered.
 * - Reps land only while a set is active. After auto-close the athlete is
 *   resting by design (comfort over volume — philosophy §0), extra bounces
 *   between sets never inflate the day.
 *
 * Same shape as repCounter: plain object + pure functions, explicit `now`
 * timestamps (no Date.now inside) so Reanimated worklets can own the state
 * and tests stay deterministic.
 */

export type SetTrackerConfig = {
  /** Personal target from calibration/progression — reaching it closes the set. */
  targetReps: number;
  /** Sets ended below this floor are softly discarded (TZ: 5). */
  minRepsToRegister: number;
  /** Suggested recovery between sets; advisory only. */
  restDurationMs: number;
};

export type SetPhase = 'idle' | 'active' | 'resting';

export type SetTrackerState = {
  config: SetTrackerConfig;
  phase: SetPhase;
  /** Valid reps in the in-progress set (0 when not active). */
  currentReps: number;
  /** Valid-rep count of each registered set, in completion order. */
  completedSets: number[];
  /** When the current rest began (0 when phase !== 'resting'). */
  restStartedAt: number;
};

export type SetEvent =
  | 'none'
  /** A new set is now live. */
  | 'setStarted'
  /** A valid rep landed in the active set. */
  | 'repCounted'
  /** Target reached — set auto-closed and registered, rest started. */
  | 'setCompleted'
  /** Manual stop at or above the floor — registered, rest started. */
  | 'setRegistered'
  /** Manual stop below the floor — softly not counted, back to idle. */
  | 'setDiscarded';

export function createSetTracker(config: SetTrackerConfig): SetTrackerState {
  'worklet';
  return {
    config,
    phase: 'idle',
    currentReps: 0,
    completedSets: [],
    restStartedAt: 0,
  };
}

/**
 * Begin a set. Allowed from idle OR resting — rest is advisory and sets may
 * be spread across the day, so starting early is the athlete's call.
 */
export function startSet(state: SetTrackerState): SetEvent {
  'worklet';
  if (state.phase === 'active') return 'none';
  state.phase = 'active';
  state.currentReps = 0;
  state.restStartedAt = 0;
  return 'setStarted';
}

// Defined before its callers: the worklet transform turns function
// declarations into const assignments, so hoisting cannot be relied on.
function registerCurrentSet(state: SetTrackerState, now: number): void {
  'worklet';
  state.completedSets.push(state.currentReps);
  state.currentReps = 0;
  state.phase = 'resting';
  state.restStartedAt = now;
}

/**
 * Feed one VALID rep (the caller forwards only 'rep' events from the rep
 * counter). Auto-closes and registers the set when the target is reached.
 */
export function recordRep(state: SetTrackerState, now: number): SetEvent {
  'worklet';
  if (state.phase !== 'active') return 'none';

  state.currentReps += 1;
  if (state.currentReps >= state.config.targetReps) {
    registerCurrentSet(state, now);
    return 'setCompleted';
  }
  return 'repCounted';
}

/**
 * Athlete stops early. At or above the floor the set still registers
 * (rest starts); below it the set is softly discarded — no penalty, no rest
 * lock, straight back to idle.
 */
export function endSet(state: SetTrackerState, now: number): SetEvent {
  'worklet';
  if (state.phase !== 'active') return 'none';

  if (state.currentReps >= state.config.minRepsToRegister) {
    registerCurrentSet(state, now);
    return 'setRegistered';
  }

  state.phase = 'idle';
  state.currentReps = 0;
  return 'setDiscarded';
}

/** Remaining suggested rest in ms; 0 when rest is over or not resting. */
export function restRemainingMs(state: SetTrackerState, now: number): number {
  'worklet';
  if (state.phase !== 'resting') return 0;
  const elapsed = now - state.restStartedAt;
  const remaining = state.config.restDurationMs - elapsed;
  return remaining > 0 ? remaining : 0;
}

/**
 * Session summary for persistence — one aggregate row per camera session
 * (TZ §2.1: never per-rep, never per-frame). Sets spread across the day
 * simply produce several summaries.
 */
export function sessionSummary(state: SetTrackerState): {
  validReps: number;
  setsDone: number;
  /** Biggest single set — feeds the «за раз» achievements (TZ §8). */
  bestSet: number;
} {
  'worklet';
  let total = 0;
  let best = 0;
  for (let i = 0; i < state.completedSets.length; i += 1) {
    total += state.completedSets[i];
    if (state.completedSets[i] > best) best = state.completedSets[i];
  }
  return { validReps: total, setsDone: state.completedSets.length, bestSet: best };
}

/** TZ §3.2 floor: a set needs at least 5 valid reps to register. */
export const MIN_REPS_TO_REGISTER = 5;

/** Default suggested rest between strength sets (comfort-first, §0). */
export const DEFAULT_REST_MS = 90_000;

export function defaultSetConfig(targetReps: number): SetTrackerConfig {
  'worklet';
  return {
    targetReps,
    minRepsToRegister: MIN_REPS_TO_REGISTER,
    restDurationMs: DEFAULT_REST_MS,
  };
}
