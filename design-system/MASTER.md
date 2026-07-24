# Streek Fit — Design System (MASTER, Source of Truth)

> Generated via UX/UI Pro Max skill (profile: Fitness/Gym App). All UI work must follow this file.
> Page-specific overrides live in `design-system/pages/<page>.md` and take priority over this file.

## Identity
- **Pattern:** Feature-Rich + Data (progress rings, streaks, leaderboards)
- **Style:** Vibrant & Block-based + Dark Mode first (near-OLED)
- **Vibe:** energetic, premium, motivating; gamification is core (streak flame, achievement unlocks, rank movement)
- **Anti-patterns:** static design without gamification; AI purple/pink gradients; neon overload; emoji as icons; light-gray-on-gray text

## Color tokens (semantic — never raw hex in components)
| Token | Dark (default) | Light |
|---|---|---|
| `bg` | `#0D0F14` | `#F8FAFC` |
| `surface` | `#161A22` | `#FFFFFF` |
| `surfaceRaised` | `#1F2530` | `#FFFFFF` |
| `border` | `#2A3140` | `#E2E8F0` |
| `textPrimary` | `#F8FAFC` | `#0F172A` |
| `textSecondary` | `#94A3B8` | `#475569` |
| `textDisabled` | `#5B6572` | `#94A3B8` |
| `primary` | `#F97316` | `#EA580C` |
| `onPrimary` | `#0D0F14` | `#FFFFFF` |
| `primarySoft` | `rgba(249,115,22,0.14)` | `rgba(234,88,12,0.10)` |
| `info` | `#2DD4BF` | `#0D9488` |
| `infoSoft` | `rgba(45,212,191,0.14)` | `rgba(13,148,136,0.12)` |
| `success` | `#22C55E` | `#16A34A` |
| `error` | `#EF4444` | `#DC2626` |
| `warning` | `#FBBF24` | `#D97706` |
| `streakFlame` | `#FB923C` | `#F97316` |
| `overlay` | `rgba(0,0,0,0.55)` | `rgba(15,23,42,0.45)` |

Contrast: body text ≥ 4.5:1, secondary ≥ 3:1 in BOTH themes. Functional colors always paired with icon/text.

**Accent duet:** orange = усилие/огонь (тренировки, стрик, CTA), teal `info` = движение-фон (шаги, темп бега, лёгкие дни календаря). Никогда не смешивать роли: у каждого экрана оранжевый доминирует, teal поддерживает.

## Typography — Oswald (display) + Inter (body)
> ⚠️ Font choice is constrained by Kazakh: cyrillic-ext glyphs (ә ғ қ ң ө ұ ү і) are REQUIRED.
> Barlow was rejected — Latin-only. Any future font must be checked against kk text first.
- Display / big numbers / screen titles: **Oswald_600SemiBold / _700Bold**
- Body: **Inter_400Regular**, labels/buttons **Inter_600SemiBold**, emphasis **Inter_500Medium**
- Scale (pt): `display 40` · `h1 32` · `h2 24` · `h3 20` · `body 16` · `caption 14` · `micro 12`
- Oswald tracking: display +0.4, h1 +0.3, h2 +0.2 (открывает кондэнс-формы)
- Tab bar labels: 11pt — самые длинные казахские подписи («Марапаттар») должны жить в одну строку на 5 табах
- Line-height ×1.5 body, ×1.15 display. Numbers in scores/timers: tabular via `fontVariant: ['tabular-nums']`

## Spacing / radii / elevation
- Spacing 4pt scale: `4 8 12 16 24 32 48`
- Radii: `sm 8` · `md 12` · `lg 16` · `xl 24` · `pill 999`
- Elevation: cards flat on dark (border + surface contrast), raised sheets use `surfaceRaised` + shadow only in light theme

## Motion (Reanimated, shared layer `src/shared/ui/motion.ts`)
- Durations: `fast 150` · `base 220` · `slow 300`; exit ≈ 0.7 × enter
- Easing: ease-out enter, ease-in exit; springs for tap feedback (scale 0.97)
- Language change: cross-fade 180/240ms (already in `LanguageTransition`)
- Every animation expresses cause→effect; respect reduced motion; never block input
- Stagger lists 30–50ms/item

## Components (src/shared/ui)
Button (primary/secondary/ghost, loading state, min height 48), Card, Input (visible label, error below field), Badge (achievement silhouette-in-circle + tier slot), Avatar (frame slot), Screen (safe area + bg), AppText (typed variants), states: Spinner / EmptyState / ErrorState (every screen type must have all three).

## Hard rules
- Touch targets ≥ 44×44pt, spacing between ≥ 8pt
- NO hardcoded UI strings — i18n keys only (kk/ru/en)
- NO emoji icons — vector only (single family, consistent stroke)
- One primary CTA per screen
- Tab bar ≤ 5 items, icon + label
- Safe areas respected everywhere (notch, home indicator)
