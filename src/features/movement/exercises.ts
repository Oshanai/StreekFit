/**
 * Exercise adapters: BlazePose landmarks → RepSample for the counter FSM.
 * Worklet-safe. Returns null when the pose is not reliable enough to judge —
 * the caller should skip the frame (never guess on low-confidence data).
 */

import { LM, jointAngle, midpoint, segmentInclination, visible, type Landmark } from './pose';
import type { RepSample } from './repCounter';

/** Max torso deviation from horizontal for a valid push-up plank (deg). */
const PUSHUP_MAX_TORSO_INCLINATION = 40;
/** Min shoulder-hip-ankle straightness — catches sagging/piking hips (deg). */
const PUSHUP_MIN_BODY_LINE = 140;

type Pose = readonly Landmark[];

function bestSide(pose: Pose, left: number, right: number): 'left' | 'right' | null {
  'worklet';
  const leftOk = pose[left].visibility >= 0.5;
  const rightOk = pose[right].visibility >= 0.5;
  if (leftOk && rightOk) {
    return pose[left].visibility >= pose[right].visibility ? 'left' : 'right';
  }
  if (leftOk) return 'left';
  if (rightOk) return 'right';
  return null;
}

/**
 * Push-up: primary angle = elbow (shoulder–elbow–wrist) on the better-visible
 * side; form gate = torso near-horizontal AND body line straight.
 */
export function pushupSample(pose: Pose, timestampMs: number): RepSample | null {
  'worklet';
  const side = bestSide(pose, LM.leftElbow, LM.rightElbow);
  if (!side) return null;

  const shoulder = pose[side === 'left' ? LM.leftShoulder : LM.rightShoulder];
  const elbow = pose[side === 'left' ? LM.leftElbow : LM.rightElbow];
  const wrist = pose[side === 'left' ? LM.leftWrist : LM.rightWrist];
  const hip = pose[side === 'left' ? LM.leftHip : LM.rightHip];
  const ankle = pose[side === 'left' ? LM.leftAnkle : LM.rightAnkle];

  if (!visible(shoulder, elbow, wrist, hip, ankle)) return null;

  const torsoInclination = segmentInclination(
    midpoint(pose[LM.leftShoulder], pose[LM.rightShoulder]),
    midpoint(pose[LM.leftHip], pose[LM.rightHip]),
  );
  const bodyLine = jointAngle(shoulder, hip, ankle);

  return {
    angle: jointAngle(shoulder, elbow, wrist),
    formOk:
      torsoInclination <= PUSHUP_MAX_TORSO_INCLINATION && bodyLine >= PUSHUP_MIN_BODY_LINE,
    timestampMs,
  };
}

/**
 * Squat: primary angle = knee (hip–knee–ankle) on the better-visible side.
 * No extra form gate in v1 — depth + full stand carry the quality bar.
 */
export function squatSample(pose: Pose, timestampMs: number): RepSample | null {
  'worklet';
  const side = bestSide(pose, LM.leftKnee, LM.rightKnee);
  if (!side) return null;

  const hip = pose[side === 'left' ? LM.leftHip : LM.rightHip];
  const knee = pose[side === 'left' ? LM.leftKnee : LM.rightKnee];
  const ankle = pose[side === 'left' ? LM.leftAnkle : LM.rightAnkle];

  if (!visible(hip, knee, ankle)) return null;

  return {
    angle: jointAngle(hip, knee, ankle),
    formOk: true,
    timestampMs,
  };
}
