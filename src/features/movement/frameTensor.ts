/**
 * Camera frame → MoveNet input tensor, worklet-safe.
 *
 * Nearest-neighbour letterbox resize straight off the camera pixel buffer
 * into a reusable 192×192×3 RGB uint8 tensor. Aspect ratio is preserved
 * (padding stays black), so joint angles measured on model output are
 * geometrically correct — a stretched square would bend every angle.
 *
 * Runs inside the frame worklet: ~110k byte writes per analysed frame,
 * well under a frame interval on target devices, zero allocations after
 * the first call (buffers are created once per runtime and reused).
 */

import { MOVENET_INPUT_SIZE } from './movenet';

/** Channel layouts VisionCamera can deliver for target pixelFormat 'rgb'. */
export type RgbLayout = 'rgb-bgra-8-bit' | 'rgb-rgba-8-bit' | 'rgb-rgb-8-bit';

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
 * Fill `scratch.tensor` from a camera pixel buffer.
 * Returns false (leaving the tensor untouched) for layouts we cannot read.
 */
export function frameToTensor(
  pixels: Uint8Array,
  srcW: number,
  srcH: number,
  bytesPerRow: number,
  layout: string,
  scratch: TensorScratch,
): boolean {
  'worklet';
  let bpp: number;
  let rOff: number;
  let gOff: number;
  let bOff: number;
  if (layout === 'rgb-bgra-8-bit') {
    bpp = 4;
    rOff = 2;
    gOff = 1;
    bOff = 0;
  } else if (layout === 'rgb-rgba-8-bit') {
    bpp = 4;
    rOff = 0;
    gOff = 1;
    bOff = 2;
  } else if (layout === 'rgb-rgb-8-bit') {
    bpp = 3;
    rOff = 0;
    gOff = 1;
    bOff = 2;
  } else {
    return false;
  }

  const size = MOVENET_INPUT_SIZE;
  const out = scratch.tensor;
  const maxDim = srcW > srcH ? srcW : srcH;
  // Content box inside the square, in output pixels.
  const contentW = Math.round((srcW / maxDim) * size);
  const contentH = Math.round((srcH / maxDim) * size);
  const padX = (size - contentW) >> 1;
  const padY = (size - contentH) >> 1;

  out.fill(0);

  for (let oy = 0; oy < contentH; oy += 1) {
    // Nearest-neighbour source row for this output row.
    let sy = Math.floor(((oy + 0.5) * srcH) / contentH);
    if (sy >= srcH) sy = srcH - 1;
    const srcRow = sy * bytesPerRow;
    const outRow = ((oy + padY) * size + padX) * 3;

    for (let ox = 0; ox < contentW; ox += 1) {
      let sx = Math.floor(((ox + 0.5) * srcW) / contentW);
      if (sx >= srcW) sx = srcW - 1;
      const src = srcRow + sx * bpp;
      const dst = outRow + ox * 3;
      out[dst] = pixels[src + rOff];
      out[dst + 1] = pixels[src + gOff];
      out[dst + 2] = pixels[src + bOff];
    }
  }

  return true;
}
