/**
 * Exercise adapters: BlazePose landmarks → RepSample for the counter FSM.
 * Worklet-safe. Returns null when the pose is not reliable enough to judge —
 * the caller should skip the frame (never guess on low-confidence data).
 *
 * Camera assumption: SIDE VIEW (the camera screen instructs placement).
 * pushupSample rejects frames whose torso projection says the view is
 * frontal/overhead — 2D joint angles are meaningless there.
 */

import { LM, jointAngle, midpoint, segmentInclination, visible, type Landmark } from './pose';
import type { RepSample } from './repCounter';

/** Max torso deviation from horizontal for a valid push-up plank (deg). */
const PUSHUP_MAX_TORSO_INCLINATION = 40;
/**
 * Min shoulder-hip-ankle straightness — catches sagging/piking hips (deg).
 * Review calibration: 140° only tripped at ~24 cm of hip sag; 155° rejects
 * ~12-15 cm sags while tolerating landmark noise on honest planks (≥170°).
 */
const PUSHUP_MIN_BODY_LINE = 155;
/**
 * Side-view sanity: in a plank filmed from the side the shoulder→hip segment
 * is mostly horizontal. If its x-extent collapses relative to its length the
 * camera is frontal/overhead — angles are unjudgeable, skip the frame.
 */
const PUSHUP_MIN_TORSO_X_RATIO = 0.3;

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

  // Torso line: use both-side midpoints ONLY when the far side is trustworthy;
  // in the usual side view the far side is occluded garbage — use the near side.
  const farSideTrusted = visible(
    pose[LM.leftShoulder],
    pose[LM.rightShoulder],
    pose[LM.leftHip],
    pose[LM.rightHip],
  );
  const torsoTop = farSideTrusted
    ? midpoint(pose[LM.leftShoulder], pose[LM.rightShoulder])
    : shoulder;
  const torsoBottom = farSideTrusted ? midpoint(pose[LM.leftHip], pose[LM.rightHip]) : hip;

  // Frontal/overhead camera → torso x-extent collapses → can't judge, skip.
  const dx = Math.abs(torsoBottom.x - torsoTop.x);
  const dy = Math.abs(torsoBottom.y - torsoTop.y);
  const torsoLen = Math.sqrt(dx * dx + dy * dy);
  if (torsoLen === 0 || dx / torsoLen < PUSHUP_MIN_TORSO_X_RATIO) return null;

  const torsoInclination = segmentInclination(torsoTop, torsoBottom);
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
 * NOTE: 2D knee angle needs a side-ish view; the camera screen instructs it.
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
