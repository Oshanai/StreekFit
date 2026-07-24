import { BADGE_CODES, TIERS, formatThreshold, isBadgeCode } from '../catalog';

describe('achievements catalog metadata', () => {
  it('has exactly 6 silhouettes × 5 tiers (TZ §8: ~30 badges)', () => {
    expect(BADGE_CODES).toHaveLength(6);
    expect(TIERS).toHaveLength(5);
  });

  it('recognises only known badge codes', () => {
    expect(isBadgeCode('streak_days')).toBe(true);
    expect(isBadgeCode('rank_city')).toBe(false);
  });

  it('formats thresholds compactly', () => {
    expect(formatThreshold(100)).toBe('100');
    expect(formatThreshold(7000)).toBe('7000');
    expect(formatThreshold(25000)).toBe('25k');
    expect(formatThreshold(350000)).toBe('350k');
    expect(formatThreshold(10000000)).toBe('10M');
  });
});
