# Streek Fit

Движение → счёт дня → стрик → рейтинг города. Отжимания и приседания считает камера,
шаги — HealthKit/Health Connect, бег — GPS. Казахстан → СНГ → мир. Три языка: kk / ru / en.

Полное ТЗ и чеклист фаз: [TZ_fitness_app.md](./TZ_fitness_app.md)

## Стек

- **Expo SDK 57** (dev client) + TypeScript + expo-router
- **Supabase** — auth / Postgres (RLS everywhere) / storage
- **Reanimated 4** — все анимации; **i18next** — kk/ru/en с кроссфейдом
- Дизайн-система: [design-system/MASTER.md](./design-system/MASTER.md)

## Запуск

```bash
npm install
cp .env.example .env   # заполнить ключами Supabase
npx expo start         # dev server (iOS dev client / web)
```

## Проверки

```bash
npm run typecheck
npx eslint src
```
