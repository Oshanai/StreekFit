import { createTensorScratch, frameToTensor } from '../frameTensor';
import {
  MOVENET_INPUT_SIZE,
  MOVENET_KEYPOINTS,
  createLandmarkSlots,
  letterboxTransform,
  movenetToLandmarks,
  squareToFrame,
} from '../movenet';
import { LM } from '../pose';
import { beginSet, createWorkoutSession, processFrame } from '../workoutSession';

/** Build a flat [17,3] MoveNet output with every keypoint at (y, x, score). */
function movenetOutput(points: Partial<Record<number, [number, number, number]>>) {
  const out = new Float32Array(MOVENET_KEYPOINTS * 3);
  for (let k = 0; k < MOVENET_KEYPOINTS; k += 1) {
    const [y, x, s] = points[k] ?? [0, 0, 0];
    out[k * 3] = y;
    out[k * 3 + 1] = x;
    out[k * 3 + 2] = s;
  }
  return out;
}

/** Float32Array rounds values (0.9 → 0.8999…), so compare with tolerance. */
function expectLm(
  lm: { x: number; y: number; visibility: number },
  x: number,
  y: number,
  visibility: number,
) {
  expect(lm.x).toBeCloseTo(x, 5);
  expect(lm.y).toBeCloseTo(y, 5);
  expect(lm.visibility).toBeCloseTo(visibility, 5);
}

describe('movenetToLandmarks — COCO 17 → BlazePose slots', () => {
  it('routes body keypoints to the slots the engine reads', () => {
    const slots = createLandmarkSlots();
    // COCO: 5 lShoulder, 7 lElbow, 9 lWrist, 11 lHip, 13 lKnee, 15 lAnkle
    const out = movenetOutput({
      5: [0.2, 0.3, 0.9],
      7: [0.4, 0.5, 0.8],
      9: [0.6, 0.7, 0.7],
      11: [0.5, 0.55, 0.95],
      13: [0.7, 0.6, 0.85],
      15: [0.9, 0.65, 0.75],
    });
    movenetToLandmarks(out, slots);

    expectLm(slots[LM.leftShoulder], 0.3, 0.2, 0.9);
    expectLm(slots[LM.leftElbow], 0.5, 0.4, 0.8);
    expectLm(slots[LM.leftWrist], 0.7, 0.6, 0.7);
    expectLm(slots[LM.leftHip], 0.55, 0.5, 0.95);
    expectLm(slots[LM.leftKnee], 0.6, 0.7, 0.85);
    expectLm(slots[LM.leftAnkle], 0.65, 0.9, 0.75);
    // right side got nothing this frame → not visible
    expect(slots[LM.rightShoulder].visibility).toBe(0);
  });

  it('clears stale visibility from the previous frame', () => {
    const slots = createLandmarkSlots();
    movenetToLandmarks(movenetOutput({ 5: [0.1, 0.1, 0.9] }), slots);
    expect(slots[LM.leftShoulder].visibility).toBeCloseTo(0.9, 5);

    movenetToLandmarks(movenetOutput({}), slots); // person left the frame
    expect(slots[LM.leftShoulder].visibility).toBe(0);
  });
});

describe('letterbox geometry', () => {
  it('is identity for a square frame', () => {
    const t = letterboxTransform(1080, 1080);
    expect(t.offsetX).toBe(0);
    expect(t.offsetY).toBe(0);
    const p = squareToFrame(0.25, 0.75, t, 1080, 1080);
    expect(p.x).toBeCloseTo(0.25);
    expect(p.y).toBeCloseTo(0.75);
  });

  it('pads the short side and maps square points back to frame space', () => {
    // Landscape 2:1 → vertical padding of 1/4 on top and bottom.
    const t = letterboxTransform(200, 100);
    expect(t.offsetX).toBe(0);
    expect(t.offsetY).toBeCloseTo(0.25);

    // Center stays center; frame top-left corner sits at square (0, 0.25).
    expect(squareToFrame(0.5, 0.5, t, 200, 100).y).toBeCloseTo(0.5);
    const corner = squareToFrame(0, 0.25, t, 200, 100);
    expect(corner.x).toBeCloseTo(0);
    expect(corner.y).toBeCloseTo(0);
  });

  it('keeps angles undistorted (aspect preserved)', () => {
    // A 45° segment in a 16:9 frame must stay 45° after square mapping.
    const srcW = 1920;
    const srcH = 1080;
    const t = letterboxTransform(srcW, srcH);
    // Segment (100,100)px → (600,600)px in frame space, i.e. 45°.
    // In square space both axes divide by maxDim, so dx === dy there too.
    const aSq = { x: 100 / srcW, y: 100 / srcH };
    const bSq = { x: 600 / srcW, y: 600 / srcH };
    // frame → square: x*contentW + offX etc. contentW = 1, contentH = 9/16
    const contentH = srcH / srcW;
    const a = { x: aSq.x, y: aSq.y * contentH + t.offsetY };
    const b = { x: bSq.x, y: bSq.y * contentH + t.offsetY };
    expect(b.x - a.x).toBeCloseTo(b.y - a.y); // 45° preserved in square space
  });
});

describe('frameToTensor — letterbox resize into 192×192×3', () => {
  it('samples BGRA pixels into RGB and letterboxes a landscape frame', () => {
    const srcW = 8;
    const srcH = 4; // 2:1 → contentH = 96, padY = 48
    const bytesPerRow = srcW * 4;
    const pixels = new Uint8Array(srcH * bytesPerRow);
    // Fill the whole frame with BGRA = (10, 20, 30, 255) → RGB (30, 20, 10)
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 10;
      pixels[i + 1] = 20;
      pixels[i + 2] = 30;
      pixels[i + 3] = 255;
    }

    const scratch = createTensorScratch();
    const ok = frameToTensor(pixels, srcW, srcH, bytesPerRow, 'rgb-bgra-8-bit', scratch);
    expect(ok).toBe(true);

    const size = MOVENET_INPUT_SIZE;
    const px = (x: number, y: number) => {
      const i = (y * size + x) * 3;
      return [scratch.tensor[i], scratch.tensor[i + 1], scratch.tensor[i + 2]];
    };
    expect(px(96, 96)).toEqual([30, 20, 10]); // center = content
    expect(px(96, 10)).toEqual([0, 0, 0]); // top letterbox padding
    expect(px(96, 185)).toEqual([0, 0, 0]); // bottom letterbox padding
    expect(px(0, 96)).toEqual([30, 20, 10]); // content spans full width
  });

  it('respects row stride padding and rgba layout', () => {
    const srcW = 4;
    const srcH = 4;
    const bytesPerRow = srcW * 4 + 16; // padded stride
    const pixels = new Uint8Array(srcH * bytesPerRow);
    for (let y = 0; y < srcH; y += 1) {
      for (let x = 0; x < srcW; x += 1) {
        const i = y * bytesPerRow + x * 4;
        pixels[i] = 200; // R
        pixels[i + 1] = 100; // G
        pixels[i + 2] = 50; // B
        pixels[i + 3] = 255;
      }
    }
    const scratch = createTensorScratch();
    expect(frameToTensor(pixels, srcW, srcH, bytesPerRow, 'rgb-rgba-8-bit', scratch)).toBe(true);
    const c = (MOVENET_INPUT_SIZE / 2) | 0;
    const i = (c * MOVENET_INPUT_SIZE + c) * 3;
    expect([scratch.tensor[i], scratch.tensor[i + 1], scratch.tensor[i + 2]]).toEqual([
      200, 100, 50,
    ]);
  });

  it('refuses unknown layouts instead of guessing channels', () => {
    const scratch = createTensorScratch();
    expect(frameToTensor(new Uint8Array(16), 2, 2, 8, 'yuv-420-8-bit-full', scratch)).toBe(false);
  });
});

describe('workout session glue', () => {
  /** Landmarks for a squat at a given knee angle, side view, all visible. */
  function squatPose(kneeAngleDeg: number) {
    const slots = createLandmarkSlots();
    const set = (i: number, x: number, y: number) => {
      slots[i].x = x;
      slots[i].y = y;
      slots[i].visibility = 0.9;
    };
    // hip above knee; knee→ankle is the up vector rotated by the requested
    // inner angle, so 180° = straight standing leg, 90° = shin horizontal
    const rad = (kneeAngleDeg * Math.PI) / 180;
    set(LM.leftHip, 0.5, 0.4);
    set(LM.leftKnee, 0.5, 0.6);
    set(LM.leftAnkle, 0.5 + Math.sin(rad) * 0.2, 0.6 - Math.cos(rad) * 0.2);
    return slots;
  }

  it('counts a full squat rep end-to-end through set tracking', () => {
    const session = createWorkoutSession('squats', 10);
    expect(session.sets.phase).toBe('idle');
    // UI starts the set
    expect(beginSet(session)).toBe('setStarted');

    const frames: [number, number][] = [
      [175, 0],
      [140, 300], // through the hysteresis band (arms the descent)
      [95, 600], // below downThreshold → descent
      [90, 900],
      [130, 1200],
      [170, 1500], // full stand → rep
    ];
    const events = frames.map(([angle, t]) => processFrame(session, squatPose(angle), t));
    expect(events.map((e) => e.repEvent)).toContain('rep');
    expect(session.reps.validReps).toBe(1);
    expect(session.sets.currentReps).toBe(1);
  });

  it('skips unusable poses without touching the FSM', () => {
    const session = createWorkoutSession('squats', 10);
    beginSet(session);
    const blind = createLandmarkSlots(); // all visibility 0
    const outcome = processFrame(session, blind, 100);
    expect(outcome.poseUsable).toBe(false);
    expect(outcome.repEvent).toBe('none');
  });
});
