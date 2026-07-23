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

// ---------------------------------------------------------------- smart crop
// MoveNet is built to see a person FILLING the input; Google's reference
// pipeline always crops around the subject and so do we: search the whole
// frame first, then track with a square crop around the confident joints.
// All slot coordinates downstream of the mapping helpers are PIXELS in the
// upright frame — pixel space is aspect-true, so joint angles stay correct.

/** Square tracking window in upright-frame PIXELS. */
export type CropRegion = { x: number; y: number; size: number };

/** Body slots that vote for the crop (face points excluded on purpose). */
const CROP_SLOTS: readonly number[] = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const CROP_MIN_JOINT_VIS = 0.4;
const CROP_MIN_JOINTS = 4;
/** Expansion of the joint bbox — room for the next movement phase. */
const CROP_EXPAND = 1.9;
/** Never tighter than this fraction of the short side (whole person visible). */
const CROP_MIN_FRACTION = 0.4;

/** Model square coords → upright pixels for a full-frame letterboxed input. Mutates slots. */
export function landmarksToPixelsFromSquare(slots: Landmark[], uw: number, uh: number): void {
  'worklet';
  const maxDim = uw > uh ? uw : uh;
  const offX = (1 - uw / maxDim) / 2;
  const offY = (1 - uh / maxDim) / 2;
  for (let i = 0; i < slots.length; i += 1) {
    const lm = slots[i];
    lm.x = (lm.x - offX) * maxDim;
    lm.y = (lm.y - offY) * maxDim;
  }
}

/** Model square coords → upright pixels for a cropped input. Mutates slots. */
export function landmarksToPixelsFromCrop(slots: Landmark[], crop: CropRegion): void {
  'worklet';
  for (let i = 0; i < slots.length; i += 1) {
    const lm = slots[i];
    lm.x = crop.x + lm.x * crop.size;
    lm.y = crop.y + lm.y * crop.size;
  }
}

/**
 * Next tracking window from the confident joints (slots in upright pixels),
 * or null when the person is not reliable enough — caller falls back to the
 * full-frame search.
 */
export function computeNextCrop(slots: Landmark[], uw: number, uh: number): CropRegion | null {
  'worklet';
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = 0;
  for (let i = 0; i < CROP_SLOTS.length; i += 1) {
    const lm = slots[CROP_SLOTS[i]];
    if (lm.visibility < CROP_MIN_JOINT_VIS) continue;
    found += 1;
    if (lm.x < minX) minX = lm.x;
    if (lm.y < minY) minY = lm.y;
    if (lm.x > maxX) maxX = lm.x;
    if (lm.y > maxY) maxY = lm.y;
  }
  if (found < CROP_MIN_JOINTS) return null;

  const shortSide = uw < uh ? uw : uh;
  const bboxW = maxX - minX;
  const bboxH = maxY - minY;
  let size = (bboxW > bboxH ? bboxW : bboxH) * CROP_EXPAND;
  const minSize = shortSide * CROP_MIN_FRACTION;
  if (size < minSize) size = minSize;
  if (size > shortSide) size = shortSide;

  let x = (minX + maxX) / 2 - size / 2;
  let y = (minY + maxY) / 2 - size / 2;
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + size > uw) x = uw - size;
  if (y + size > uh) y = uh - size;
  return { x, y, size };
}

/** Blend toward the new window to keep the crop from jittering. */
export function smoothCrop(prev: CropRegion | null, next: CropRegion): CropRegion {
  'worklet';
  if (prev === null) return next;
  const k = 0.3;
  return {
    x: prev.x + (next.x - prev.x) * k,
    y: prev.y + (next.y - prev.y) * k,
    size: prev.size + (next.size - prev.size) * k,
  };
}

export type SensorRect = { x0: number; y0: number; x1: number; y1: number };

/**
 * Upright-space crop → sensor-space rectangle for Image.crop, which runs
 * BEFORE the counter-rotation by `deg` (0|90|180|270 CW).
 */
export function uprightCropToSensorRect(
  crop: CropRegion,
  deg: number,
  sensorW: number,
  sensorH: number,
): SensorRect {
  'worklet';
  const x0 = crop.x;
  const y0 = crop.y;
  const x1 = crop.x + crop.size;
  const y1 = crop.y + crop.size;
  if (deg === 90) {
    // upright = sensor rotated 90° CW: (ux, uy) ← (sh - sy, sx)
    return { x0: y0, y0: sensorH - x1, x1: y1, y1: sensorH - x0 };
  }
  if (deg === 180) {
    return { x0: sensorW - x1, y0: sensorH - y1, x1: sensorW - x0, y1: sensorH - y0 };
  }
  if (deg === 270) {
    // upright = sensor rotated 270° CW: (ux, uy) ← (sy, sw - sx)
    return { x0: sensorW - y1, y0: x0, x1: sensorW - y0, y1: x1 };
  }
  return { x0, y0, x1, y1 };
}
