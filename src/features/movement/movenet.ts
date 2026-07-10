/**
 * MoveNet SinglePose → engine landmarks, worklet-safe.
 *
 * The model (assets/models/movenet_lightning_int8.tflite) takes a 192×192×3
 * RGB uint8 tensor and returns [1,1,17,3] float32 of (y, x, score) tuples in
 * COCO keypoint order, normalized to the square input.
 *
 * The engine (pose.ts) indexes landmarks by the BlazePose 33-point layout, so
 * the 17 COCO points are scattered into a 33-slot array; slots MoveNet does
 * not produce keep visibility 0 and are treated as «not visible» downstream.
 *
 * The input square is produced by aspect-preserving letterbox (frameTensor.ts),
 * so angles computed on model coordinates are geometrically correct without
 * any un-mapping. Overlay code maps square-space points back to frame space
 * with {@link letterboxTransform}.
 */

import type { Landmark } from './pose';

export const MOVENET_INPUT_SIZE = 192;
export const MOVENET_KEYPOINTS = 17;
export const POSE_SLOTS = 33;

/**
 * COCO keypoint index → BlazePose slot. -1 = the engine never reads it
 * (face points); they are still written into their nearest BlazePose slots
 * for potential overlay use where a mapping exists.
 */
const COCO_TO_BLAZEPOSE: readonly number[] = [
  0, // 0 nose            → nose
  2, // 1 left eye        → left eye
  5, // 2 right eye       → right eye
  7, // 3 left ear        → left ear
  8, // 4 right ear       → right ear
  11, // 5 left shoulder
  12, // 6 right shoulder
  13, // 7 left elbow
  14, // 8 right elbow
  15, // 9 left wrist
  16, // 10 right wrist
  23, // 11 left hip
  24, // 12 right hip
  25, // 13 left knee
  26, // 14 right knee
  27, // 15 left ankle
  28, // 16 right ankle
];

/** Preallocate the 33-slot landmark array reused across frames (no per-frame GC). */
export function createLandmarkSlots(): Landmark[] {
  'worklet';
  const slots: Landmark[] = [];
  for (let i = 0; i < POSE_SLOTS; i += 1) {
    slots.push({ x: 0, y: 0, visibility: 0 });
  }
  return slots;
}

/**
 * Scatter MoveNet output into the BlazePose-indexed slots (mutates `slots`).
 * `output` is the flat [1,1,17,3] float32 tensor data: (y, x, score) triples.
 */
export function movenetToLandmarks(
  output: ArrayLike<number>,
  slots: Landmark[],
): void {
  'worklet';
  // Reset so stale points from a previous frame can never leak through.
  for (let i = 0; i < slots.length; i += 1) slots[i].visibility = 0;

  for (let k = 0; k < MOVENET_KEYPOINTS; k += 1) {
    const slot = COCO_TO_BLAZEPOSE[k];
    const base = k * 3;
    const lm = slots[slot];
    lm.y = output[base];
    lm.x = output[base + 1];
    lm.visibility = output[base + 2];
  }
}

export type LetterboxTransform = {
  /** Multiply square-space coords by this to get content scale. */
  scale: number;
  /** Horizontal letterbox padding in square space (0..1). */
  offsetX: number;
  /** Vertical letterbox padding in square space (0..1). */
  offsetY: number;
};

/**
 * How a `srcW`×`srcH` frame sits inside the letterboxed square:
 * content is centered and scaled to fit, padding fills the short side.
 */
export function letterboxTransform(srcW: number, srcH: number): LetterboxTransform {
  'worklet';
  const maxDim = srcW > srcH ? srcW : srcH;
  const contentW = srcW / maxDim;
  const contentH = srcH / maxDim;
  return {
    scale: 1 / maxDim,
    offsetX: (1 - contentW) / 2,
    offsetY: (1 - contentH) / 2,
  };
}

/**
 * Square-space normalized point → frame-space normalized point (0..1 in the
 * original frame). Used by the skeleton overlay.
 */
export function squareToFrame(
  x: number,
  y: number,
  t: LetterboxTransform,
  srcW: number,
  srcH: number,
): { x: number; y: number } {
  'worklet';
  const maxDim = srcW > srcH ? srcW : srcH;
  return {
    x: ((x - t.offsetX) * maxDim) / srcW,
    y: ((y - t.offsetY) * maxDim) / srcH,
  };
}
