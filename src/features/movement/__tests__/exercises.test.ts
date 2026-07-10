import { pushupSample, squatSample } from '../exercises';
import { LM, type Landmark } from '../pose';

const lm = (x: number, y: number, visibility = 0.9): Landmark => ({ x, y, visibility });

/** 33-landmark pose, everything invisible by default. */
function makePose(overrides: Partial<Record<number, Landmark>>): Landmark[] {
  const pose = Array.from({ length: 33 }, () => lm(0, 0, 0));
  for (const [idx, landmark] of Object.entries(overrides)) {
    pose[Number(idx)] = landmark!;
  }
  return pose;
}

/**
 * Side-view plank, left side facing camera. Horizontal body: head right,
 * feet left; y grows downward (image coords).
 */
function sideViewPushupPose(opts?: {
  elbowY?: number;
  farSideVisibility?: number;
  farShoulder?: Landmark;
  hipSag?: number;
}): Landmark[] {
  const farVis = opts?.farSideVisibility ?? 0.2;
  const hipSag = opts?.hipSag ?? 0;
  return makePose({
    [LM.leftShoulder]: lm(0.7, 0.5),
    [LM.rightShoulder]: opts?.farShoulder ?? lm(0.7, 0.52, farVis),
    [LM.leftElbow]: lm(0.7, opts?.elbowY ?? 0.65),
    [LM.leftWrist]: lm(0.7, 0.8),
    [LM.leftHip]: lm(0.45, 0.52 + hipSag),
    [LM.rightHip]: lm(0.45, 0.54, farVis),
    [LM.leftAnkle]: lm(0.2, 0.55),
  });
}

describe('pushupSample', () => {
  it('judges a side-view plank with occluded far side using the near side only', () => {
    // far-side shoulder/hip are garbage coordinates with low visibility
    const pose = sideViewPushupPose({
      farShoulder: lm(0.1, 0.9, 0.2), // garbage — must be ignored
    });
    const sample = pushupSample(pose, 1000);
    expect(sample).not.toBeNull();
    expect(sample!.formOk).toBe(true); // near-side torso is horizontal
  });

  it('returns null when the elbow side is not visible', () => {
    const pose = sideViewPushupPose();
    pose[LM.leftElbow] = lm(0.7, 0.65, 0.2);
    expect(pushupSample(pose, 0)).toBeNull();
  });

  it('returns null for a frontal/overhead view (torso x-extent collapses)', () => {
    const pose = sideViewPushupPose();
    // camera at head: shoulder and hip project to nearly the same x
    pose[LM.leftShoulder] = lm(0.5, 0.3);
    pose[LM.leftHip] = lm(0.51, 0.6);
    expect(pushupSample(pose, 0)).toBeNull();
  });

  it('flags sagging hips via the body line gate', () => {
    const pose = sideViewPushupPose({ hipSag: 0.12 });
    const sample = pushupSample(pose, 0);
    expect(sample).not.toBeNull();
    expect(sample!.formOk).toBe(false);
  });

  it('treats NaN visibility as not visible (no NaN poisoning)', () => {
    const pose = sideViewPushupPose();
    pose[LM.leftWrist] = lm(NaN, NaN, NaN);
    expect(pushupSample(pose, 0)).toBeNull();
  });
});

describe('squatSample', () => {
  it('measures the knee angle on the visible side', () => {
    const pose = makePose({
      [LM.leftHip]: lm(0.5, 0.4),
      [LM.leftKnee]: lm(0.52, 0.6),
      [LM.leftAnkle]: lm(0.5, 0.8),
    });
    const sample = squatSample(pose, 0);
    expect(sample).not.toBeNull();
    expect(sample!.angle).toBeGreaterThan(160); // near-straight leg
  });

  it('returns null when no knee is visible', () => {
    expect(squatSample(makePose({}), 0)).toBeNull();
  });
});
