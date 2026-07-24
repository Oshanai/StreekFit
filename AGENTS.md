# Streek Fit — agent guide

> Expo HAS CHANGED: read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing Expo-API code.

Fitness movement & competition app (KZ → CIS → world). Camera-verified push-ups/squats,
steps, GPS runs → one daily score → streak → city/friends leaderboards → story sharing.
Full spec and phase checklist: `TZ_fitness_app.md` (single source of truth, work top-down by phases).

## Stack
- Expo SDK 57 **dev client** (not managed/Expo Go), TypeScript strict, expo-router, React Compiler on
- Reanimated 4 (all animations), react-native-svg (icons — never emoji)
- Supabase (auth/db/storage) — client in `src/lib/supabase/client.ts`, env in `.env` (never commit)
- i18n: i18next, languages **kk / ru / en** — NO hardcoded UI strings, keys only
- Design system: `design-system/MASTER.md` is law; tokens in `src/shared/ui/tokens.ts`
- Design intelligence: **UI/UX Pro Max** skill (global, `~/.claude/skills/ui-ux-pro-max`) drives all design
  decisions. Before UI work query it:
  `python3 ~/.claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system` (or `--domain ux|style|color|typography|chart`).
  Apply results ONLY through MASTER.md + semantic tokens (MASTER.md itself is generated via this skill).
  Its font picks must pass the Kazakh cyrillic-ext check below — Barlow was already rejected for this.

## Layout
- `src/app` — expo-router routes only (thin wrappers)
- `src/features/{auth,profile,movement,leaderboard,achievements}` — feature code
- `src/shared/ui` — design-system components (AppText, Button, Card, Screen, states…)
- `src/i18n` — init + locales + LanguageTransition (crossfade on language change)
- `supabase/migrations` — SQL, RLS on every table, session aggregates only (never per-rep rows)

## Rules
- Fonts MUST support Kazakh cyrillic-ext (ә ғ қ ң ө ұ ү і) — current pair: Oswald + Inter
- Dark theme first; both themes must pass contrast (body ≥4.5:1)
- Never use raw hex in components — semantic tokens only
- Camera frame processing stays on native/worklet thread (Phase 2) — no per-frame JS-bridge hops
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`

## Checks
- typecheck: `npm run typecheck`
- lint: `npx eslint src`
- web smoke test: `npx expo start --web`
