/**
 * Client-side badge metadata (TZ §8). The AUTHORITATIVE catalog (ids,
 * thresholds) lives in the `achievements` table; this module maps codes to
 * i18n keys and display order. 6 silhouettes × 5 tiers.
 */

export const BADGE_CODES = [
  'volume_pushups',
  'volume_squats',
  'single_pushups',
  'single_squats',
  'streak_days',
  'volume_steps',
] as const;

export type BadgeCode = (typeof BADGE_CODES)[number];

export const TIERS = [1, 2, 3, 4, 5] as const;
export type Tier = (typeof TIERS)[number];

export type CatalogRow = {
  id: string;
  code: BadgeCode;
  tier: Tier;
  threshold: number;
};

export function badgeNameKey(code: BadgeCode): string {
  return `ach.badge.${code}`;
}

export function tierNameKey(tier: Tier): string {
  return `ach.tier.${tier}`;
}

/** 25 000 → «25 тыс.» style compaction is left to i18n; raw grouping here. */
export function formatThreshold(threshold: number): string {
  if (threshold >= 1_000_000) return `${threshold / 1_000_000}M`;
  if (threshold >= 10_000) return `${Math.round(threshold / 1000)}k`;
  return String(threshold);
}

export function isBadgeCode(value: string): value is BadgeCode {
  return (BADGE_CODES as readonly string[]).includes(value);
}
