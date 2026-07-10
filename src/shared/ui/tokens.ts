/**
 * Streek Fit design tokens — single source of truth for all UI.
 * Mirrors design-system/MASTER.md. Never use raw hex in components.
 */

export const palette = {
  dark: {
    bg: '#0D0F14',
    surface: '#161A22',
    surfaceRaised: '#1F2530',
    border: '#2A3140',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textDisabled: '#5B6572',
    primary: '#F97316',
    onPrimary: '#0D0F14',
    primarySoft: 'rgba(249,115,22,0.14)',
    success: '#22C55E',
    error: '#EF4444',
    warning: '#FBBF24',
    streakFlame: '#FB923C',
    overlay: 'rgba(0,0,0,0.55)',
  },
  light: {
    bg: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    border: '#E2E8F0',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textDisabled: '#94A3B8',
    primary: '#EA580C',
    onPrimary: '#FFFFFF',
    primarySoft: 'rgba(234,88,12,0.10)',
    success: '#16A34A',
    error: '#DC2626',
    warning: '#D97706',
    streakFlame: '#F97316',
    overlay: 'rgba(15,23,42,0.45)',
  },
} as const;

export type ThemeName = keyof typeof palette;
export type ThemeColors = (typeof palette)[ThemeName];

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

// Oswald + Inter: both ship cyrillic-ext — required for Kazakh
// (ә, ғ, қ, ң, ө, ұ, ү, і). Never pick a font without checking kk glyphs.
export const fonts = {
  display: 'Oswald_700Bold',
  displaySemi: 'Oswald_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
} as const;

export const typeScale = {
  display: { fontSize: 40, lineHeight: 46, fontFamily: fonts.display },
  h1: { fontSize: 32, lineHeight: 37, fontFamily: fonts.display },
  h2: { fontSize: 24, lineHeight: 28, fontFamily: fonts.displaySemi },
  h3: { fontSize: 20, lineHeight: 26, fontFamily: fonts.bodySemiBold },
  body: { fontSize: 16, lineHeight: 24, fontFamily: fonts.body },
  bodyBold: { fontSize: 16, lineHeight: 24, fontFamily: fonts.bodySemiBold },
  caption: { fontSize: 14, lineHeight: 20, fontFamily: fonts.body },
  micro: { fontSize: 12, lineHeight: 16, fontFamily: fonts.bodyMedium },
} as const;

export type TextVariant = keyof typeof typeScale;

export const motion = {
  durations: { fast: 150, base: 220, slow: 300 },
  /** Exit animations run at ~70% of enter duration. */
  exitRatio: 0.7,
  pressScale: 0.97,
  listStaggerMs: 40,
} as const;

/** Minimum touch target per Apple HIG / Material. */
export const MIN_TOUCH = 44;

