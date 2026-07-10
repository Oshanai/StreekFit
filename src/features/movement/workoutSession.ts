/**
 * Per-frame workout glue, worklet-safe: landmarks → exercise sample →
 * rep counter → set tracker, in one call. Owns no I/O and no timers —
 * the camera worklet feeds it and mirrors results into shared values.
 */

import { pushupSample, squatSample } from './exercises';
import type { Landmark } from './pose';
import {
  PUSHUP_CONFIG,
  SQUAT_CONFIG,
  createRepCounter,
  updateRepCounter,
  type RepCounterState,
  type RepEvent,
} from './repCounter';
import {
  createSetTracker,
  defaultSetConfig,
  endSet,
  recordRep,
  startSet,
  type SetEvent,
  type SetTrackerState,
} from './setTracker';

export type WorkoutExercise = 'pushups' | 'squats';

export type WorkoutSession = {
  exercise: WorkoutExercise;
  reps: RepCounterState;
  sets: SetTrackerState;
};

export function createWorkoutSession(
  exercise: WorkoutExercise,
  targetReps: number,
): WorkoutSession {
  'worklet';
  return {
    exercise,
    reps: createRepCounter(exercise === 'pushups' ? PUSHUP_CONFIG : SQUAT_CONFIG),
    sets: createSetTracker(defaultSetConfig(targetReps)),
  };
}

export type FrameOutcome = {
  /** What the rep FSM saw this frame ('none' when the pose was unusable). */
  repEvent: RepEvent;
  /** What the set tracker did in response. */
  setEvent: SetEvent;
  /** False when landmarks were too unreliable to judge this frame. */
  poseUsable: boolean;
};

/**
 * Feed one frame of landmarks (BlazePose-indexed slots) at `timestampMs`.
 * Skips gracefully when the pose is not judgeable — never guesses.
 */
export function processFrame(
  session: WorkoutSession,
  landmarks: readonly Landmark[],
  timestampMs: number,
): FrameOutcome {
  'worklet';
  const sample =
    session.exercise === 'pushups'
      ? pushupSample(landmarks, timestampMs)
      : squatSample(landmarks, timestampMs);

  if (sample === null) {
    return { repEvent: 'none', setEvent: 'none', poseUsable: false };
  }

  const repEvent = updateRepCounter(session.reps, sample);
  const setEvent =
    repEvent === 'rep' ? recordRep(session.sets, timestampMs) : 'none';

  return { repEvent, setEvent, poseUsable: true };
}

/** UI intent: begin a set (from idle or resting). */
export function beginSet(session: WorkoutSession): SetEvent {
  'worklet';
  return startSet(session.sets);
}

/** UI intent: stop the current set early (registers at ≥ floor, else discards). */
export function stopSet(session: WorkoutSession, timestampMs: number): SetEvent {
  'worklet';
  return endSet(session.sets, timestampMs);
}
