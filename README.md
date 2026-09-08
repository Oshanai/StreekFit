<p align="center">
  <img src="assets/images/logo-glow.png" width="120" alt="Streek Fit">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Expo-SDK%2057-000020?logo=expo&logoColor=white" alt="Expo SDK 57">
  <img src="https://img.shields.io/badge/React%20Native-0.86-61DAFB?logo=react&logoColor=black" alt="React Native 0.86">
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript strict">
  <img src="https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ECF8E?logo=supabase&logoColor=white" alt="Supabase">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT">
</p>
# Streek Fit

Movement → daily score → streak → city leaderboard.

A mobile fitness app where the phone camera counts your push-ups and squats, the motion sensor counts steps, and GPS tracks your runs — all folded into a single number per day. Miss a day and the streak resets.

Built for Kazakhstan first, then CIS. Three languages: Kazakh, Russian, English.

🇷🇺 [README на русском](./README.ru.md) · 📋 [Full spec and phase checklist](./TZ_fitness_app.md) (ru)

> **Status:** in active development.

## How it works

- **Camera rep counting** — on-device pose estimation (MoveNet Lightning, TFLite). Video is processed on the native thread and never leaves the phone; only session aggregates reach the server.
- **Steps** — HealthKit / Health Connect through the device motion sensor.
- **Runs** — GPS track with distance, pace and route drawn via MapLibre.
- **Daily score** — reps, steps and distance combined into one number that drives the streak.
- **Leaderboards** — city, friends and clans.

## Stack

| Layer | Choice |
|---|---|
| App | Expo SDK 57 (dev client), React Native 0.86, TypeScript strict |
| Routing | expo-router |
| Backend | Supabase — Postgres, auth, storage; RLS on all 12 tables |
| On-device ML | TensorFlow Lite, MoveNet Lightning int8 |
| Animation | Reanimated 4 |
| i18n | i18next — kk / ru / en with crossfade on language switch |

## Running locally

Requires Node LTS and an Expo **dev client** — Expo Go will not work, the app depends on native modules.

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL and anon key
npm run start
```

The database schema lives in `supabase/migrations/`. Apply it with the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
npm test            # jest — 13 test suites
```

## Layout

```
src/app/         expo-router routes (thin wrappers)
src/features/    movement, run, auth, leaderboard, achievements, clans, stats, share
src/shared/ui/   design-system components
src/i18n/        kk / ru / en locales
supabase/        SQL migrations
design-system/   MASTER.md — tokens and component rules
```

## License

MIT — see [LICENSE](./LICENSE).
