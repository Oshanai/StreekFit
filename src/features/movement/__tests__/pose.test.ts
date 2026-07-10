import { jointAngle, midpoint, segmentInclination, visible } from '../pose';

const lm = (x: number, y: number, visibility = 1) => ({ x, y, visibility });

describe('jointAngle', () => {
  it('returns 90° for a right angle', () => {
    // elbow at origin, shoulder straight up, wrist straight right
    expect(jointAngle(lm(0, -1), lm(0, 0), lm(1, 0))).toBeCloseTo(90, 5);
  });

  it('returns 180° for a straight line', () => {
    expect(jointAngle(lm(-1, 0), lm(0, 0), lm(1, 0))).toBeCloseTo(180, 5);
  });

  it('returns small angle for a deep fold', () => {
    // wrist nearly back at the shoulder
    expect(jointAngle(lm(0, -1), lm(0, 0), lm(0.05, -1))).toBeLessThan(10);
  });

  it('degrades safely on coincident points', () => {
    expect(jointAngle(lm(0, 0), lm(0, 0), lm(1, 0))).toBe(180);
  });
});

describe('segmentInclination', () => {
  it('0° for horizontal, 90° for vertical', () => {
    expect(segmentInclination(lm(0, 0), lm(1, 0))).toBeCloseTo(0, 5);
    expect(segmentInclination(lm(0, 0), lm(0, 1))).toBeCloseTo(90, 5);
  });

  it('~45° for a diagonal', () => {
    expect(segmentInclination(lm(0, 0), lm(1, 1))).toBeCloseTo(45, 5);
  });
});

describe('visibility helpers', () => {
  it('midpoint carries the weakest visibility', () => {
    const m = midpoint(lm(0, 0, 0.9), lm(2, 2, 0.4));
    expect(m).toEqual({ x: 1, y: 1, visibility: 0.4 });
  });

  it('visible() fails if any landmark is below threshold', () => {
    expect(visible(lm(0, 0, 0.9), lm(1, 1, 0.6))).toBe(true);
    expect(visible(lm(0, 0, 0.9), lm(1, 1, 0.3))).toBe(false);
  });
});
