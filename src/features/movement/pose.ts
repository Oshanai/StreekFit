/**
 * Pose types + geometry, worklet-safe (pure functions, no imports from RN).
 * Landmark indices follow MediaPipe BlazePose (33-point) so the frame
 * processor can feed model output straight in.
 */

export type Landmark = {
  x: number;
  y: number;
  /** Model confidence 0..1 (BlazePose `visibility`). */
  visibility: number;
};

/** BlazePose landmark indices we rely on. */
export const LM = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

/** Inner angle at joint `b` formed by segments b→a and b→c, in degrees (0..180). */
export function jointAngle(a: Landmark, b: Landmark, c: Landmark): number {
  'worklet';
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const magAB = Math.sqrt(abx * abx + aby * aby);
  const magCB = Math.sqrt(cbx * cbx + cby * cby);
  if (magAB === 0 || magCB === 0) return 180;
  const cos = Math.min(1, Math.max(-1, dot / (magAB * magCB)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * Angle of the segment a→b versus horizontal, in degrees (0 = horizontal, 90 = vertical).
 * Used for the push-up "body stays plank-horizontal" rule.
 */
export function segmentInclination(a: Landmark, b: Landmark): number {
  'worklet';
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  if (dx === 0 && dy === 0) return 0;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/** Mean of two landmarks (e.g. midpoint of both shoulders). */
export function midpoint(a: Landmark, b: Landmark): Landmark {
  'worklet';
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    visibility: Math.min(a.visibility, b.visibility),
  };
}

/** Lowest acceptable model confidence for a landmark to be trusted. */
export const MIN_VISIBILITY = 0.5;

export function visible(...landmarks: Landmark[]): boolean {
  'worklet';
  for (const lm of landmarks) {
    if (lm.visibility < MIN_VISIBILITY) return false;
  }
  return true;
}
