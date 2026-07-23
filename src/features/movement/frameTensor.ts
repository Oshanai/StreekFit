/**
 * Resized pixels → MoveNet input tensor, worklet-safe.
 *
 * Scaling and rotation happen NATIVELY (nitro-image resize/rotate on the
 * camera worklet thread) — JS only shuffles channels of the already-small
 * content box (≤192×192) into the letterboxed 192×192×3 RGB uint8 tensor.
 * Padding stays black; aspect ratio was preserved by the native resize, so
 * joint angles measured on model output are geometrically correct.
 */

import { MOVENET_INPUT_SIZE } from './movenet';

export type TensorScratch = {
  /** 192*192*3 uint8 RGB, letterboxed. Feed straight into runSync. */
  tensor: Uint8Array;
};

export function createTensorScratch(): TensorScratch {
  'worklet';
  return {
    tensor: new Uint8Array(MOVENET_INPUT_SIZE * MOVENET_INPUT_SIZE * 3),
  };
}

/**
 * Channel offsets per nitro-image RawPixelData.pixelFormat.
 * Returns [bytesPerPixel, rOffset, gOffset, bOffset] or null when unreadable.
 */
function channelLayout(format: string): [number, number, number, number] | null {
  'worklet';
  switch (format) {
    case 'RGBA':
    case 'RGBX':
      return [4, 0, 1, 2];
    case 'BGRA':
    case 'BGRX':
      return [4, 2, 1, 0];
    case 'ARGB':
    case 'XRGB':
      return [4, 1, 2, 3];
    case 'ABGR':
    case 'XBGR':
      return [4, 3, 2, 1];
    case 'RGB':
      return [3, 0, 1, 2];
    case 'BGR':
      return [3, 2, 1, 0];
    default:
      return null;
  }
}

/**
 * Pack an already-resized content box (srcW×srcH ≤ 192×192, upright) into
 * the center of the letterboxed tensor. Returns false for unknown layouts —
 * the caller should skip the frame rather than guess channels.
 */
export function packPixelsToTensor(
  pixels: Uint8Array,
  srcW: number,
  srcH: number,
  pixelFormat: string,
  scratch: TensorScratch,
): boolean {
  'worklet';
  const layout = channelLayout(pixelFormat);
  if (layout === null) return false;

  const size = MOVENET_INPUT_SIZE;
  if (srcW > size || srcH > size) return false;

  const bpp = layout[0];
  const rOff = layout[1];
  const gOff = layout[2];
  const bOff = layout[3];

  const out = scratch.tensor;
  const padX = (size - srcW) >> 1;
  const padY = (size - srcH) >> 1;

  out.fill(0);

  for (let y = 0; y < srcH; y += 1) {
    const srcRow = y * srcW * bpp;
    const outRow = ((y + padY) * size + padX) * 3;
    for (let x = 0; x < srcW; x += 1) {
      const src = srcRow + x * bpp;
      const dst = outRow + x * 3;
      out[dst] = pixels[src + rOff];
      out[dst + 1] = pixels[src + gOff];
      out[dst + 2] = pixels[src + bOff];
    }
  }

  return true;
}
